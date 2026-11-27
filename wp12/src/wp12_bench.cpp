// WP1-2 (Objectives 1 and 2): lookup latency, p99, throughput and index size on the four SOSD 200M-key datasets.
//
// Data: SOSD binary files (8-byte count, then that many sorted uint64 keys). Each file is checked for order and
// de-duplicated, as in Objective 4. Queries: Q keys drawn uniformly from the distinct keys (seed 7), as in
// learned-index-bench. Every index must return the right answer for every query, else the program exits with code 2.
//
// Indexes, each with a size sweep for Objective 2 (memory vs speed):
//   binary_search (std::lower_bound), binary_search_branchless (cmov), interpolation (8 probes, then binary search),
//   eytzinger (BFS layout + prefetch; a second copy of the keys), rmi (two-stage linear, code from bench.cpp; 6 leaf
//   counts), pgm (PGM-index c6fcf3d; 5 epsilons), radixspline (RadixSpline ab96aa5; 6 configs), btree (STX B+tree 0.9
//   over every s-th key, then binary search in the gap, as SOSD's BTree; 6 values of s), oracle (true position known).
//
// Per (dataset, index, config):
//   build_ms      wall time to build the index from the sorted keys
//   mean_ns       closed loop over all Q queries (independent lookups, so the core may overlap them); median of R
//                 passes after one warm-up pass. throughput_mops = 1000 / mean_ns, single thread.
//   p50/p99/p999  each of the first L queries timed alone between serializing rdtsc/rdtscp, so lookups cannot
//                 overlap; the median overhead of an empty lookup is subtracted. Median of 3 passes.
//
// Usage: wp12_bench <out.csv> --data DIR [--datasets a,b] [--pin] [--reps R=5] [--queries Q=2000000]
//                   [--lat-queries L=500000] [--sample N]   (--sample keeps N evenly spaced keys, for smoke tests)
#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <sched.h>
#include <sys/resource.h>
#endif
#include <x86intrin.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include "pgm/pgm_index.hpp"
#ifdef _WIN32
// RadixSpline's builder calls __builtin_clzl on a uint64_t. On Windows `long` is 32 bits, so the key range is
// truncated, the radix shift comes out wrong and the radix table is written out of bounds (a crash at 200M keys).
// The 64-bit builtin is what the library means; on Linux the two are the same.
#define __builtin_clzl(x) __builtin_clzll(x)
#endif
#include "rs/builder.h"
#include "rs/radix_spline.h"
#ifdef _WIN32
#undef __builtin_clzl
#endif
#include "stx/btree_map.h"

using u64 = uint64_t;
using clk = std::chrono::steady_clock;

// ---------------------------------------------------------------- copied from learned-index-bench/bench.cpp
struct Linear {
  double a = 0, b = 0;  // y = a * x + b
  double operator()(u64 x) const { return std::fma(a, (double)x, b); }
};

static Linear fit(const u64* keys, size_t lo, size_t hi, double y0, double ystep) {
  Linear m;
  size_t n = hi - lo;
  if (n == 0) return m;
  if (n == 1) { m.b = y0; return m; }
  long double mx = 0, my = 0;
  for (size_t i = lo; i < hi; i++) { mx += keys[i]; my += y0 + ystep * (i - lo); }
  mx /= n; my /= n;
  long double sxy = 0, sxx = 0;
  for (size_t i = lo; i < hi; i++) {
    long double dx = keys[i] - mx, dy = y0 + ystep * (i - lo) - my;
    sxy += dx * dy; sxx += dx * dx;
  }
  if (sxx == 0) { m.b = (double)my; return m; }
  m.a = (double)(sxy / sxx);
  m.b = (double)(my - m.a * mx);
  return m;
}

struct RMI {
  struct Leaf { Linear m; int32_t emin, emax; };
  Linear root;
  std::vector<Leaf> leaves;
  const u64* keys;
  size_t n;
  double log2err = 0;

  size_t leaf_of(u64 k) const {
    double p = root(k);
    if (p < 0) return 0;
    size_t l = (size_t)p;
    return l >= leaves.size() ? leaves.size() - 1 : l;
  }

  RMI(const std::vector<u64>& v, size_t num_leaves) : keys(v.data()), n(v.size()) {
    leaves.resize(num_leaves);
    root = fit(keys, 0, n, 0.0, (double)num_leaves / n);
    size_t start = 0;
    for (size_t l = 0; l < num_leaves; l++) {
      size_t end = start;
      while (end < n && leaf_of(keys[end]) == l) end++;
      Leaf& lf = leaves[l];
      if (end == start) {
        lf.m.a = 0; lf.m.b = (double)start; lf.emin = lf.emax = 0;
        continue;
      }
      lf.m = fit(keys, start, end, (double)start, 1.0);
      int64_t emin = INT64_MAX, emax = INT64_MIN;
      for (size_t i = start; i < end; i++) {
        int64_t e = (int64_t)i - (int64_t)lf.m(keys[i]);
        emin = std::min(emin, e); emax = std::max(emax, e);
      }
      lf.emin = (int32_t)emin; lf.emax = (int32_t)emax;
      log2err += (end - start) * std::log2((double)(emax - emin + 1));
      start = end;
    }
    log2err /= n;
  }

  size_t lookup(u64 k) const {
    const Leaf& lf = leaves[leaf_of(k)];
    int64_t p = (int64_t)lf.m(k);
    int64_t lo = std::max<int64_t>(0, p + lf.emin);
    int64_t hi = std::min<int64_t>((int64_t)n, p + lf.emax + 1);
    if (lo >= hi) return (size_t)std::min<int64_t>(std::max<int64_t>(lo, 0), n);
    return std::lower_bound(keys + lo, keys + hi, k) - keys;
  }

  size_t bytes() const { return sizeof(Linear) + leaves.size() * sizeof(Leaf); }
};

static size_t branchless_lower_bound(const u64* a, size_t n, u64 k) {
  const u64* base = a;
  while (n > 1) {
    size_t half = n / 2;
    base = (base[half] < k) ? base + half : base;
    n -= half;
  }
  return (size_t)(base - a) + (*base < k);
}

struct Eytzinger {
  std::vector<u64> raw;
  u64* b = nullptr;
  size_t n = 0;
  size_t fill(const u64* a, size_t i, size_t k) {
    if (k <= n) { i = fill(a, i, 2 * k); b[k] = a[i++]; i = fill(a, i, 2 * k + 1); }
    return i;
  }
  explicit Eytzinger(const std::vector<u64>& a) : raw(a.size() + 1 + 8), n(a.size()) {
    uintptr_t p = (uintptr_t)raw.data();
    b = (u64*)((p + 63) & ~(uintptr_t)63);
    fill(a.data(), 0, 1);
  }
  size_t lookup(u64 k) const {
    size_t i = 1;
    while (i <= n) { __builtin_prefetch(b + 8 * i); i = 2 * i + (b[i] < k); }
    return i >> __builtin_ffsll((long long)~i);
  }
  size_t bytes() const { return (n + 1) * sizeof(u64); }
};

static size_t interpolation_lower_bound(const u64* a, size_t n, u64 k) {
  size_t lo = 0, hi = n;
  for (int probe = 0; probe < 8 && hi - lo > 16; probe++) {
    u64 klo = a[lo], khi = a[hi - 1];
    if (k <= klo) return lo;
    if (k > khi) return hi;
    size_t mid = lo + (size_t)((double)(k - klo) / (double)(khi - klo) * (double)(hi - 1 - lo));
    if (a[mid] < k) lo = mid + 1; else hi = mid;
  }
  return (size_t)(std::lower_bound(a + lo, a + hi, k) - a);
}
// ---------------------------------------------------------------- end of copied code

static void pin_to_cpu0() {  // same as learned-index-bench --pin: logical CPU 0, high priority on Windows
#ifdef _WIN32
  SetThreadAffinityMask(GetCurrentThread(), 1);
  SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
#else
  cpu_set_t s;
  CPU_ZERO(&s);
  CPU_SET(0, &s);
  if (sched_setaffinity(0, sizeof(s), &s) != 0) perror("sched_setaffinity");
#endif
}

static double peak_gib() {
#ifdef _WIN32
  PROCESS_MEMORY_COUNTERS pmc;
  K32GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc));
  return pmc.PeakWorkingSetSize / 1073741824.0;
#else
  struct rusage ru;
  getrusage(RUSAGE_SELF, &ru);
  return ru.ru_maxrss / 1048576.0;
#endif
}

static void spin_up() {
  volatile u64 spin = 0;
  auto t_end = clk::now() + std::chrono::seconds(2);
  while (clk::now() < t_end) spin = spin + 1;
}

static double ms_since(clk::time_point t0) { return std::chrono::duration<double, std::milli>(clk::now() - t0).count(); }

static inline u64 tsc_begin() { _mm_lfence(); u64 t = __rdtsc(); _mm_lfence(); return t; }
static inline u64 tsc_end() { unsigned a; u64 t = __rdtscp(&a); _mm_lfence(); return t; }

static double g_tsc_per_ns = 1.0;
static double g_overhead_ticks = 0.0;

static void calibrate_tsc() {
  auto t0 = clk::now();
  u64 c0 = __rdtsc();
  while (ms_since(t0) < 300) {}
  u64 c1 = __rdtsc();
  g_tsc_per_ns = (double)(c1 - c0) / (ms_since(t0) * 1e6);
}

static std::vector<u64> load_sosd(const std::string& path, size_t& n_raw) {
  FILE* f = fopen(path.c_str(), "rb");
  if (!f) { perror(path.c_str()); exit(1); }
  u64 cnt = 0;
  if (fread(&cnt, 8, 1, f) != 1) { fprintf(stderr, "%s: no header\n", path.c_str()); exit(1); }
  std::vector<u64> k(cnt);
  for (size_t off = 0; off < cnt;) {  // chunked: one huge fread is slow or fails on some C runtimes
    size_t want = std::min<size_t>(cnt - off, (size_t)1 << 25);
    if (fread(k.data() + off, 8, want, f) != want) { fprintf(stderr, "%s: short read\n", path.c_str()); exit(1); }
    off += want;
  }
  fclose(f);
  n_raw = cnt;
  if (!std::is_sorted(k.begin(), k.end())) { fprintf(stderr, "%s: not sorted\n", path.c_str()); exit(1); }
  k.erase(std::unique(k.begin(), k.end()), k.end());
  // PGM-index reserves 2^64 - 1 as a sentinel and throws on it; fb contains it. Drop it for every index alike.
  if (!k.empty() && k.back() == UINT64_MAX) {
    k.pop_back();
    fprintf(stderr, "%s: removed the key 2^64-1 (PGM-index sentinel)\n", path.c_str());
  }
  k.shrink_to_fit();
  return k;
}

struct Stats { double mean = 0, mean_min = 0, mean_max = 0, p50 = 0, p99 = 0, p999 = 0, iso_mean = 0; };

static double pct(std::vector<double>& v, double p) {
  size_t i = std::min(v.size() - 1, (size_t)(p * v.size()));
  std::nth_element(v.begin(), v.begin() + i, v.end());
  return v[i];
}

// Closed-loop mean (R passes + warm-up) and isolated per-lookup percentiles (3 passes over the first L queries).
// `f(i)` answers query i (a key lookup for every index; the oracle reads the true position instead).
template <class F>
static Stats measure(F&& f, size_t nq, int reps, size_t lq, size_t& sink) {
  Stats s;
  std::vector<double> means;
  for (int r = 0; r <= reps; r++) {
    auto t0 = clk::now();
    size_t acc = 0;
    for (size_t i = 0; i < nq; i++) acc += f(i);
    double ns = std::chrono::duration<double, std::nano>(clk::now() - t0).count() / nq;
    sink += acc;
    if (r > 0) means.push_back(ns);
  }
  std::sort(means.begin(), means.end());
  s.mean = means[means.size() / 2]; s.mean_min = means.front(); s.mean_max = means.back();

  lq = std::min(lq, nq);
  std::vector<double> p50, p99, p999, im, lat(lq);
  for (int pass = 0; pass < 3; pass++) {
    double sum = 0;
    for (size_t i = 0; i < lq; i++) {
      asm volatile("" ::: "memory");
      u64 t0 = tsc_begin();
      size_t p = f(i);
      asm volatile("" : : "r"(p) : "memory");
      u64 t1 = tsc_end();
      sink += p;
      double ns = std::max(0.0, ((double)(t1 - t0) - g_overhead_ticks) / g_tsc_per_ns);
      lat[i] = ns; sum += ns;
    }
    im.push_back(sum / lq);
    p50.push_back(pct(lat, 0.50)); p99.push_back(pct(lat, 0.99)); p999.push_back(pct(lat, 0.999));
  }
  auto med = [](std::vector<double> v) { std::sort(v.begin(), v.end()); return v[v.size() / 2]; };
  s.p50 = med(p50); s.p99 = med(p99); s.p999 = med(p999); s.iso_mean = med(im);
  return s;
}

static void calibrate_overhead(const std::vector<u64>& qs) {
  std::vector<double> t(200000);
  size_t sink = 0;
  for (int pass = 0; pass < 2; pass++)
    for (size_t i = 0; i < t.size(); i++) {
      u64 q = qs[i % qs.size()];
      asm volatile("" ::: "memory");
      u64 t0 = tsc_begin();
      size_t p = (size_t)(q & 1);
      asm volatile("" : : "r"(p) : "memory");
      u64 t1 = tsc_end();
      sink += p;
      t[i] = (double)(t1 - t0);
    }
  g_overhead_ticks = pct(t, 0.5);
  double o99 = pct(t, 0.99), o999 = pct(t, 0.999);
  fprintf(stderr, "tsc %.4f ticks/ns, empty-lookup timer cost: p50 %.0f ticks (%.1f ns, subtracted), p99 %.1f ns, "
          "p99.9 %.1f ns [%zu]\n", g_tsc_per_ns, g_overhead_ticks, g_overhead_ticks / g_tsc_per_ns,
          o99 / g_tsc_per_ns, o999 / g_tsc_per_ns, sink & 1);
}

int main(int argc, char** argv) {
  const char* outp = nullptr;
  std::string dir;
  std::vector<std::string> datasets = {"books_200M_uint64", "fb_200M_uint64", "osm_cellids_200M_uint64",
                                       "wiki_ts_200M_uint64"};
  bool pin = false;
  int reps = 5;
  size_t nq = 2000000, lq = 500000, sample = 0;
  for (int i = 1; i < argc; i++) {
    std::string a = argv[i];
    if (a == "--pin") pin = true;
    else if (a == "--data" && i + 1 < argc) dir = argv[++i];
    else if (a == "--reps" && i + 1 < argc) reps = atoi(argv[++i]);
    else if (a == "--queries" && i + 1 < argc) nq = strtoull(argv[++i], nullptr, 10);
    else if (a == "--lat-queries" && i + 1 < argc) lq = strtoull(argv[++i], nullptr, 10);
    else if (a == "--sample" && i + 1 < argc) sample = strtoull(argv[++i], nullptr, 10);
    else if (a == "--datasets" && i + 1 < argc) {
      datasets.clear();
      for (char* s = strtok(argv[++i], ","); s; s = strtok(nullptr, ",")) datasets.push_back(s);
    } else outp = argv[i];
  }
  if (!outp || dir.empty()) {
    fprintf(stderr, "usage: wp12_bench <out.csv> --data DIR [--datasets a,b] [--pin] [--reps R] [--queries Q] "
                    "[--lat-queries L] [--sample N]\n");
    return 1;
  }
  if (pin) pin_to_cpu0();
  spin_up();
  calibrate_tsc();

  FILE* out = fopen(outp, "w");
  if (!out) { perror(outp); return 1; }
  fprintf(out, "dataset,n_raw,n,index,config,bytes,build_ms,mean_ns,mean_min_ns,mean_max_ns,throughput_mops,"
               "iso_mean_ns,p50_ns,p99_ns,p999_ns,log2err,checked\n");
  size_t sink = 0;
  bool overhead_done = false;

  for (const std::string& ds : datasets) {
    size_t n_raw = 0;
    auto t_load = clk::now();
    std::vector<u64> keys = load_sosd(dir + "/" + ds, n_raw);
    if (sample && sample < keys.size()) {
      std::vector<u64> s(sample);
      for (size_t i = 0; i < sample; i++) s[i] = keys[(size_t)((double)i * keys.size() / sample)];
      keys.swap(s);
    }
    const size_t n = keys.size();
    fprintf(stderr, "== %s: %zu keys in file, %zu distinct used, loaded in %.0f ms\n", ds.c_str(), n_raw, n,
            ms_since(t_load));

    std::mt19937_64 rng(7);
    std::uniform_int_distribution<size_t> pick(0, n - 1);
    std::vector<u64> qs(nq);
    std::vector<size_t> truth(nq);
    for (size_t i = 0; i < nq; i++) { truth[i] = pick(rng); qs[i] = keys[truth[i]]; }
    if (!overhead_done) { calibrate_overhead(qs); overhead_done = true; }

    // check: lookup(q) must equal truth (or, for eytzinger, the key at that slot must equal the query)
    auto run = [&](const char* name, const std::string& cfg, size_t bytes, double build_ms, double log2err,
                   auto&& lookup, auto&& correct) {
      for (size_t i = 0; i < nq; i++) {
        size_t p = lookup(qs[i]);
        if (!correct(i, p)) {
          fprintf(stderr, "MISMATCH %s %s %s query %zu: got %zu, want %zu\n", ds.c_str(), name, cfg.c_str(), i, p,
                  truth[i]);
          exit(2);
        }
      }
      Stats s = measure([&](size_t i) { return lookup(qs[i]); }, nq, reps, lq, sink);
      fprintf(out, "%s,%zu,%zu,%s,%s,%zu,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%zu\n", ds.c_str(), n_raw, n,
              name, cfg.c_str(), bytes, build_ms, s.mean, s.mean_min, s.mean_max, 1000.0 / s.mean, s.iso_mean, s.p50,
              s.p99, s.p999, log2err, nq);
      fflush(out);
      fprintf(stderr, "  %-24s %-16s %12zu B  build %8.1f ms  mean %7.1f ns  p50 %7.1f  p99 %7.1f  p99.9 %7.1f\n",
              name, cfg.c_str(), bytes, build_ms, s.mean, s.p50, s.p99, s.p999);
    };
    auto exact = [&](size_t i, size_t p) { return p == truth[i]; };
    const u64* K = keys.data();

    {  // oracle: a perfect model. The true position is given; the lookup only reads that key to confirm it.
      auto orc = [&](size_t i) { size_t p = truth[i]; return p + (K[p] != qs[i]); };
      for (size_t i = 0; i < nq; i++)
        if (orc(i) != truth[i]) { fprintf(stderr, "MISMATCH %s oracle query %zu\n", ds.c_str(), i); exit(2); }
      Stats s = measure(orc, nq, reps, lq, sink);
      fprintf(out, "%s,%zu,%zu,oracle,-,0,0,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,0,%zu\n", ds.c_str(), n_raw, n,
              s.mean, s.mean_min, s.mean_max, 1000.0 / s.mean, s.iso_mean, s.p50, s.p99, s.p999, nq);
      fflush(out);
      fprintf(stderr, "  %-24s mean %7.1f ns  p50 %7.1f  p99 %7.1f\n", "oracle", s.mean, s.p50, s.p99);
    }

    run("binary_search", "std::lower_bound", 0, 0, 0,
        [&](u64 k) { return (size_t)(std::lower_bound(keys.begin(), keys.end(), k) - keys.begin()); }, exact);
    run("binary_search_branchless", "cmov", 0, 0, 0, [&](u64 k) { return branchless_lower_bound(K, n, k); }, exact);
    run("interpolation", "8 probes", 0, 0, 0, [&](u64 k) { return interpolation_lower_bound(K, n, k); }, exact);
    {
      auto t0 = clk::now();
      Eytzinger ey(keys);
      double b = ms_since(t0);
      run("eytzinger", "prefetch", ey.bytes(), b, 0, [&](u64 k) { return ey.lookup(k); },
          [&](size_t i, size_t p) { return p >= 1 && p <= n && ey.b[p] == qs[i]; });
    }
    for (size_t kpl : {32, 128, 512, 2048, 8192, 32768}) {
      size_t nl = std::max<size_t>(1, n / kpl);
      auto t0 = clk::now();
      RMI rmi(keys, nl);
      double b = ms_since(t0);
      run("rmi", "leaves=" + std::to_string(nl), rmi.bytes(), b, rmi.log2err, [&](u64 k) { return rmi.lookup(k); },
          exact);
    }
    auto pgm_run = [&](auto eps_tag) {
      constexpr size_t EPS = decltype(eps_tag)::value;
      auto t0 = clk::now();
      pgm::PGMIndex<u64, EPS> pgm(keys.begin(), keys.end());
      double b = ms_since(t0);
      run("pgm", "eps=" + std::to_string(EPS), pgm.size_in_bytes(), b, 0, [&](u64 k) {
        auto r = pgm.search(k);
        return (size_t)(std::lower_bound(K + r.lo, K + r.hi, k) - K);
      }, exact);
    };
    pgm_run(std::integral_constant<size_t, 8>{});
    pgm_run(std::integral_constant<size_t, 32>{});
    pgm_run(std::integral_constant<size_t, 128>{});
    pgm_run(std::integral_constant<size_t, 512>{});
    pgm_run(std::integral_constant<size_t, 2048>{});
    for (auto [bits, err] : std::vector<std::pair<size_t, size_t>>{{24, 8}, {22, 16}, {20, 32}, {18, 64}, {16, 128}, {14, 256}}) {
      auto t0 = clk::now();
      rs::Builder<u64> bld(keys.front(), keys.back(), bits, err);
      for (u64 k : keys) bld.AddKey(k);
      rs::RadixSpline<u64> rsi = bld.Finalize();
      double b = ms_since(t0);
      run("radixspline", "bits=" + std::to_string(bits) + ";err=" + std::to_string(err), rsi.GetSize(), b, 0,
          [&](u64 k) {
            rs::SearchBound sb = rsi.GetSearchBound(k);
            return (size_t)(std::lower_bound(K + sb.begin, K + sb.end, k) - K);
          }, exact);
    }
    for (size_t s : {8, 32, 128, 512, 2048, 8192}) {
      using BT = stx::btree_map<u64, u64>;
      auto t0 = clk::now();
      BT bt;
      {
        std::vector<std::pair<u64, u64>> kv;
        kv.reserve(n / s + 1);
        for (size_t i = 0; i < n; i += s) kv.push_back({keys[i], i});
        bt.bulk_load(kv.begin(), kv.end());
      }
      double b = ms_since(t0);
      const auto& st = bt.get_stats();
      size_t bytes = st.leaves * BT::leafslotmax * 16 + st.innernodes * (BT::innerslotmax * 8 + (BT::innerslotmax + 1) * 8);
      run("btree", "every=" + std::to_string(s), bytes, b, 0, [&](u64 k) {
        auto it = bt.lower_bound(k);
        size_t hi = it == bt.end() ? n : (size_t)it->second;
        size_t lo = hi >= s ? hi - s + 1 : 0;
        return (size_t)(std::lower_bound(K + lo, K + hi, k) - K);
      }, exact);
    }
    fprintf(stderr, "done %s\n", ds.c_str());
  }
  fprintf(stderr, "peak memory %.2f GiB\n", peak_gib());
  fclose(out);
  printf("sink=%zu\n", sink);
  return 0;
}
