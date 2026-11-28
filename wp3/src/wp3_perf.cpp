// WP3 (Objective 3): hardware counters per lookup, read with Linux perf_event_open around the lookup loop only.
//
// Same keys and queries as learned-index-bench/bench.cpp (keys: seed 42, de-duplicated; queries: 2M existing keys,
// seed 7), so the counts line up with the Objective 5 latency results on the same CPU.
// Indexes: binary search (std::lower_bound), two-stage linear RMI (code copied unchanged from bench.cpp, 4 leaf
// counts), PGM-index (epsilon 64), RadixSpline (18 radix bits, max error 32), STX B+tree 0.9 (default traits).
//
// For each (dataset, n, index): 1 warm-up pass, then R passes per event group. Reported counts are the median over
// the R passes, divided by the number of lookups. Every index must return the same position as binary search for
// every query, else the program exits with code 2.
//
// Usage: wp3_perf <out.csv> [--pin] [--sizes 100000,1000000,...] [--reps R=5] [--queries Q=2000000]
//        wp3_perf --calibrate <out.csv> [--pin]      pointer chase at L1/L2/L3/DRAM footprints (event sanity check)
//
// Events (user space only). Generic: cycles, instructions, branches, branch misses. AMD Zen 4/5 raw events from the
// Processor Programming Reference: PMCx043 LsDmndFillsFromSys (demand data-cache fills by source) and PMCx045
// LsL1DTlbMiss. Each group is read with PERF_FORMAT_GROUP; time_running / time_enabled < 1 means multiplexing.
#include <linux/perf_event.h>
#include <sched.h>
#include <sys/ioctl.h>
#include <sys/syscall.h>
#include <unistd.h>

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
#include "rs/builder.h"
#include "rs/radix_spline.h"
#include "stx/btree_map.h"

using u64 = uint64_t;

// ---------------------------------------------------------------- copied from learned-index-bench/bench.cpp
static std::vector<u64> make_keys(const std::string& dist, size_t n, u64 seed) {
  std::mt19937_64 rng(seed);
  std::vector<u64> k;
  k.reserve(n);
  if (dist == "uniform") {
    std::uniform_int_distribution<u64> d(0, (1ULL << 50));
    while (k.size() < n) k.push_back(d(rng));
  } else {  // lognormal(0, 2) * 1e9, same shape as the SOSD synthetic set
    std::lognormal_distribution<double> d(0.0, 2.0);
    while (k.size() < n) k.push_back((u64)(d(rng) * 1e9));
  }
  std::sort(k.begin(), k.end());
  k.erase(std::unique(k.begin(), k.end()), k.end());
  return k;
}

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
// ---------------------------------------------------------------- end of copied code

struct Ev { const char* name; uint32_t type; u64 config; };
static const std::vector<std::vector<Ev>> GROUPS = {
    {{"cycles", PERF_TYPE_HARDWARE, PERF_COUNT_HW_CPU_CYCLES},
     {"instructions", PERF_TYPE_HARDWARE, PERF_COUNT_HW_INSTRUCTIONS},
     {"branches", PERF_TYPE_HARDWARE, PERF_COUNT_HW_BRANCH_INSTRUCTIONS},
     {"branch_misses", PERF_TYPE_HARDWARE, PERF_COUNT_HW_BRANCH_MISSES}},
    {{"fills_l2", PERF_TYPE_RAW, 0x0143},           // PMCx043 umask 0x01 LocalL2: L1D miss served by L2
     {"fills_l3", PERF_TYPE_RAW, 0x0243},           // umask 0x02 LocalCcx: served by this CCX's L3
     {"fills_other_cache", PERF_TYPE_RAW, 0x1443},  // umask 0x14 NearCache|FarCache: another CCX's cache
     {"fills_dram", PERF_TYPE_RAW, 0x4843}},        // umask 0x48 DRAM_IO_Near|DRAM_IO_Far: served by memory
    {{"dtlb_l1_miss", PERF_TYPE_RAW, 0xff45},       // PMCx045 all L1 DTLB misses
     {"dtlb_l2_miss", PERF_TYPE_RAW, 0xf045}},      // PMCx045 umask 0xf0: also missed the L2 TLB (page walk)
};
static std::vector<std::string> event_names() {
  std::vector<std::string> v;
  for (auto& g : GROUPS) for (auto& e : g) v.push_back(e.name);
  return v;
}

struct Group {
  std::vector<int> fds;
  explicit Group(const std::vector<Ev>& evs) {
    for (size_t i = 0; i < evs.size(); i++) {
      perf_event_attr a;
      memset(&a, 0, sizeof(a));
      a.size = sizeof(a);
      a.type = evs[i].type;
      a.config = evs[i].config;
      a.disabled = i == 0;
      a.exclude_kernel = 1;
      a.exclude_hv = 1;
      a.read_format = PERF_FORMAT_GROUP | PERF_FORMAT_TOTAL_TIME_ENABLED | PERF_FORMAT_TOTAL_TIME_RUNNING;
      int fd = (int)syscall(SYS_perf_event_open, &a, 0, -1, i == 0 ? -1 : fds[0], 0);
      if (fd < 0) { fprintf(stderr, "perf_event_open(%s): %s\n", evs[i].name, strerror(errno)); exit(3); }
      fds.push_back(fd);
    }
  }
  ~Group() { for (int fd : fds) close(fd); }
  void start() {
    ioctl(fds[0], PERF_EVENT_IOC_RESET, PERF_IOC_FLAG_GROUP);
    ioctl(fds[0], PERF_EVENT_IOC_ENABLE, PERF_IOC_FLAG_GROUP);
  }
  // returns counts, sets mux = time_running / time_enabled
  std::vector<u64> stop(double& mux) {
    ioctl(fds[0], PERF_EVENT_IOC_DISABLE, PERF_IOC_FLAG_GROUP);
    std::vector<u64> buf(3 + fds.size());
    if (read(fds[0], buf.data(), buf.size() * 8) != (ssize_t)(buf.size() * 8)) { perror("read"); exit(3); }
    mux = buf[1] ? (double)buf[2] / buf[1] : 0;
    return std::vector<u64>(buf.begin() + 3, buf.end());
  }
};

struct Result { std::vector<double> per_op; double ns = 0, mux = 1; };

// Runs `pass(i)` (one full pass, `ops` operations) once as warm-up, then `reps` times per event group.
template <class F>
static Result measure(F&& pass, size_t ops, int reps) {
  Result r;
  pass();
  std::vector<double> ns;
  for (auto& evs : GROUPS) {
    Group g(evs);
    std::vector<std::vector<double>> per(evs.size());
    for (int t = 0; t < reps; t++) {
      auto t0 = std::chrono::steady_clock::now();
      g.start();
      pass();
      double mux;
      auto c = g.stop(mux);
      auto t1 = std::chrono::steady_clock::now();
      r.mux = std::min(r.mux, mux);
      for (size_t e = 0; e < evs.size(); e++) per[e].push_back((double)c[e] / ops);
      if (&evs == &GROUPS[0]) ns.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count() / ops);
    }
    for (auto& v : per) { std::sort(v.begin(), v.end()); r.per_op.push_back(v[v.size() / 2]); }
  }
  std::sort(ns.begin(), ns.end());
  r.ns = ns[ns.size() / 2];
  return r;
}

static void pin_to_cpu0() {
  cpu_set_t s;
  CPU_ZERO(&s);
  CPU_SET(0, &s);
  if (sched_setaffinity(0, sizeof(s), &s) != 0) perror("sched_setaffinity");
}

static void spin_up() {  // 2 s busy loop so the core is at full clock, as in bench.cpp
  volatile u64 spin = 0;
  auto t_end = std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (std::chrono::steady_clock::now() < t_end) spin = spin + 1;
}

static void header(FILE* out, const char* first) {
  fprintf(out, "%s", first);
  for (auto& n : event_names()) fprintf(out, ",%s", n.c_str());
  fprintf(out, ",mux_min");
}

// Pointer chase over a random cyclic order of cache lines: one dependent load per step.
static int calibrate(const char* outp) {
  FILE* out = fopen(outp, "w");
  if (!out) { perror(outp); return 1; }
  header(out, "footprint_bytes,steps,ns");
  fprintf(out, "\n");
  const size_t foot[] = {32ull << 10, 512ull << 10, 4ull << 20, 1ull << 30};
  const size_t steps = 4000000;
  u64 sink = 0;
  for (size_t f : foot) {
    size_t lines = f / 64;
    std::vector<u64> a(f / 8, 0);
    std::vector<u64> order(lines);
    for (size_t i = 0; i < lines; i++) order[i] = i;
    std::mt19937_64 rng(1);
    for (size_t i = lines - 1; i > 0; i--) {  // Sattolo: one cycle through all lines
      size_t j = std::uniform_int_distribution<size_t>(0, i - 1)(rng);
      std::swap(order[i], order[j]);
    }
    for (size_t i = 0; i < lines; i++) a[order[i] * 8] = order[(i + 1) % lines] * 8;
    u64 p = order[0] * 8;
    auto r = measure([&] { for (size_t s = 0; s < steps; s++) p = a[p]; sink += p; }, steps, 5);
    fprintf(out, "%zu,%zu,%.3f", f, steps, r.ns);
    for (double v : r.per_op) fprintf(out, ",%.4f", v);
    fprintf(out, ",%.4f\n", r.mux);
    fflush(out);
    fprintf(stderr, "calibrate %8zu KiB  %7.2f ns/step\n", f >> 10, r.ns);
  }
  fclose(out);
  printf("sink=%llu\n", (unsigned long long)sink);
  return 0;
}

int main(int argc, char** argv) {
  bool calib = false, pin = false;
  const char* outp = nullptr;
  std::vector<size_t> sizes = {100000, 1000000, 10000000, 50000000, 100000000};
  int reps = 5;
  size_t nq = 2000000;
  for (int i = 1; i < argc; i++) {
    std::string a = argv[i];
    if (a == "--calibrate") calib = true;
    else if (a == "--pin") pin = true;
    else if (a == "--reps" && i + 1 < argc) reps = atoi(argv[++i]);
    else if (a == "--queries" && i + 1 < argc) nq = strtoull(argv[++i], nullptr, 10);
    else if (a == "--sizes" && i + 1 < argc) {
      sizes.clear();
      for (char* s = strtok(argv[++i], ","); s; s = strtok(nullptr, ",")) sizes.push_back(strtoull(s, nullptr, 10));
    } else outp = argv[i];
  }
  if (!outp) { fprintf(stderr, "usage: wp3_perf [--calibrate] <out.csv> [--pin] [--sizes a,b] [--reps R] [--queries Q]\n"); return 1; }
  if (pin) pin_to_cpu0();
  spin_up();
  if (calib) return calibrate(outp);

  FILE* out = fopen(outp, "w");
  if (!out) { perror(outp); return 1; }
  header(out, "dataset,n,index,config,bytes,ns");
  fprintf(out, ",checksum\n");
  size_t sink = 0;

  for (std::string dist : {"uniform", "lognormal"}) {
    for (size_t n : sizes) {
      auto keys = make_keys(dist, n, 42);
      std::mt19937_64 rng(7);
      std::uniform_int_distribution<size_t> pick(0, keys.size() - 1);
      std::vector<u64> qs(nq);
      for (auto& q : qs) q = keys[pick(rng)];
      std::vector<size_t> truth(nq);
      u64 truth_sum = 0;
      for (size_t i = 0; i < nq; i++) {
        truth[i] = std::lower_bound(keys.begin(), keys.end(), qs[i]) - keys.begin();
        truth_sum += truth[i];
      }

      auto run = [&](const char* name, const std::string& cfg, size_t bytes, auto&& lookup) {
        u64 cs = 0;
        for (size_t i = 0; i < nq; i++) {
          size_t p = lookup(qs[i]);
          cs += p;
          if (p != truth[i]) {
            fprintf(stderr, "MISMATCH %s %s %s n=%zu query %zu: %zu vs %zu\n", name, cfg.c_str(), dist.c_str(), n, i, p, truth[i]);
            exit(2);
          }
        }
        auto r = measure([&] { size_t s = 0; for (u64 q : qs) s += lookup(q); sink += s; }, nq, reps);
        fprintf(out, "%s,%zu,%s,%s,%zu,%.3f", dist.c_str(), keys.size(), name, cfg.c_str(), bytes, r.ns);
        for (double v : r.per_op) fprintf(out, ",%.4f", v);
        fprintf(out, ",%.4f,%llu\n", r.mux, (unsigned long long)cs);
        fflush(out);
        fprintf(stderr, "  %-9s %-6zu %-13s %-14s %8.2f ns  %7.1f instr  %5.2f br-miss  %5.2f dram  mux %.3f\n",
                dist.c_str(), keys.size(), name, cfg.c_str(), r.ns, r.per_op[1], r.per_op[3], r.per_op[7], r.mux);
      };

      run("binary_search", "-", 0,
          [&](u64 k) { return (size_t)(std::lower_bound(keys.begin(), keys.end(), k) - keys.begin()); });

      // Control: the same search without a data-dependent branch (the compiler emits cmov), so the core cannot
      // speculate past an unresolved comparison. Separates branch-miss cost and speculative loads from cache misses.
      run("binary_search_branchless", "cmov", 0, [&](u64 k) {
        const u64* base = keys.data();
        size_t len = keys.size();
        while (len > 1) {
          size_t half = len / 2;
          base = base[half] < k ? base + half : base;
          len -= half;
        }
        return (size_t)(base - keys.data()) + (*base < k);
      });

      for (size_t kpl : {64, 256, 1024, 4096}) {
        size_t nl = std::max<size_t>(1, keys.size() / kpl);
        RMI rmi(keys, nl);
        run("rmi", "leaves=" + std::to_string(nl), rmi.bytes(), [&](u64 k) { return rmi.lookup(k); });
      }

      {
        pgm::PGMIndex<u64, 64> pgm(keys.begin(), keys.end());
        run("pgm", "eps=64", pgm.size_in_bytes(), [&](u64 k) {
          auto r = pgm.search(k);
          return (size_t)(std::lower_bound(keys.begin() + r.lo, keys.begin() + r.hi, k) - keys.begin());
        });
      }

      {
        rs::Builder<u64> b(keys.front(), keys.back(), 18, 32);
        for (u64 k : keys) b.AddKey(k);
        rs::RadixSpline<u64> rsi = b.Finalize();
        run("radixspline", "bits=18;err=32", rsi.GetSize(), [&](u64 k) {
          rs::SearchBound sb = rsi.GetSearchBound(k);
          return (size_t)(std::lower_bound(keys.begin() + sb.begin, keys.begin() + sb.end, k) - keys.begin());
        });
      }

      {
        using BT = stx::btree_map<u64, u64>;
        BT bt;
        {
          std::vector<std::pair<u64, u64>> kv(keys.size());
          for (size_t i = 0; i < keys.size(); i++) kv[i] = {keys[i], i};
          bt.bulk_load(kv.begin(), kv.end());
        }
        const auto& st = bt.get_stats();
        // node payload only (slot arrays), excludes node headers; the keys live inside the tree
        size_t bytes = st.leaves * BT::leafslotmax * 16 + st.innernodes * (BT::innerslotmax * 8 + (BT::innerslotmax + 1) * 8);
        run("btree", "stx-default", bytes, [&](u64 k) { return (size_t)bt.lower_bound(k)->second; });
      }

      if (truth_sum == 0) fprintf(stderr, "warning: zero checksum\n");
      fprintf(stderr, "done %s n=%zu\n", dist.c_str(), n);
    }
  }
  fclose(out);
  printf("sink=%zu\n", sink);
  return 0;
}
