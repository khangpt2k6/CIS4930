// Quick first-result benchmark: two-stage linear RMI vs binary search on sorted uint64 keys.
// Build: g++ -O3 -march=native -std=c++17 bench.cpp -o bench
// Usage: bench <out.csv> [--pin] [--baselines] [--max-n=N]
//   --baselines  also time tuned non-learned baselines and an oracle (see time_baselines below)
//   --max-n=N    skip key counts above N (for machines with little free RAM)
#ifdef _WIN32
#include <windows.h>
#elif defined(__linux__)
#include <sched.h>
#endif
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <random>
#include <string>
#include <vector>

using u64 = uint64_t;

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

// least squares on (keys[i], ys[i]) for i in [lo, hi)
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
      if (end == start) {  // empty leaf: point at the next key's position
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

// ---------- tuned non-learned baselines (--baselines)
// Branchless binary search: the comparison picks the next base with a conditional move, so no branch is mispredicted.
static size_t branchless_lower_bound(const u64* a, size_t n, u64 k) {
  const u64* base = a;
  while (n > 1) {
    size_t half = n / 2;
    base = (base[half] < k) ? base + half : base;
    n -= half;
  }
  return (size_t)(base - a) + (*base < k);
}

// Eytzinger (BFS) layout with prefetching (Khuong and Morin, 2017). b[1..n] holds the keys in breadth-first order of
// an implicit search tree; b is 64-byte aligned, so the 8 great-grandchildren of node i (b[8i..8i+7]) share one cache
// line, which is prefetched 3 levels ahead. Returns the slot in b of the first key >= k (0 if none).
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
  size_t bytes() const { return (n + 1) * sizeof(u64); }  // a second copy of the keys in another layout
};

// Interpolation search: probe where a straight line between the end keys of the current range puts k. On uniform keys
// this converges in about log log n probes. After 8 probes it falls back to binary search on what is left, so skewed
// keys cannot make it linear. This is the classic "model" with no training: two points and a line.
static size_t interpolation_lower_bound(const u64* a, size_t n, u64 k) {
  size_t lo = 0, hi = n;  // every key before lo is < k, every key from hi on is >= k
  for (int probe = 0; probe < 8 && hi - lo > 16; probe++) {
    u64 klo = a[lo], khi = a[hi - 1];
    if (k <= klo) return lo;
    if (k > khi) return hi;
    size_t mid = lo + (size_t)((double)(k - klo) / (double)(khi - klo) * (double)(hi - 1 - lo));
    if (a[mid] < k) lo = mid + 1; else hi = mid;
  }
  return (size_t)(std::lower_bound(a + lo, a + hi, k) - a);
}

template <class F>
static std::vector<double> time_ns(F&& lookup, const std::vector<u64>& qs, int runs, size_t& sink) {
  std::vector<double> out;
  for (int r = 0; r < runs + 1; r++) {  // first run is warm-up
    auto t0 = std::chrono::steady_clock::now();
    size_t s = 0;
    for (u64 q : qs) s += lookup(q);
    auto t1 = std::chrono::steady_clock::now();
    sink += s;
    if (r > 0) out.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count() / qs.size());
  }
  std::sort(out.begin(), out.end());
  return out;
}

// Same as time_ns, but the lookup gets the query's index (the oracle needs the query's true position).
template <class F>
static std::vector<double> time_ns_idx(F&& lookup, size_t nq, int runs, size_t& sink) {
  std::vector<double> out;
  for (int r = 0; r < runs + 1; r++) {
    auto t0 = std::chrono::steady_clock::now();
    size_t s = 0;
    for (size_t i = 0; i < nq; i++) s += lookup(i);
    auto t1 = std::chrono::steady_clock::now();
    sink += s;
    if (r > 0) out.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count() / nq);
  }
  std::sort(out.begin(), out.end());
  return out;
}

static void pin_to_core0() {
#ifdef _WIN32
  SetThreadAffinityMask(GetCurrentThread(), 1);
  SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
#elif defined(__linux__)
  cpu_set_t s;
  CPU_ZERO(&s);
  CPU_SET(0, &s);
  sched_setaffinity(0, sizeof(s), &s);
#endif  // macOS has no thread pinning API
}

// --baselines: every row is checked against std::lower_bound on 20,000 queries before it is timed.
//   binary_search_branchless  branchless_lower_bound above; no extra memory
//   interpolation             interpolation search with a bisection guard; no extra memory
//   oracle                    a perfect model: the true position is given, and the lookup only reads that key to
//                             confirm it. No index can do less, so this is the floor for every row.
//   eytzinger                 Eytzinger layout with prefetching; bytes = a second copy of the keys
template <class BS>
static bool time_baselines(FILE* out, const std::string& dist, const std::vector<u64>& keys, const std::vector<u64>& qs,
                           const std::vector<size_t>& qpos, int runs, size_t& sink, BS&& bs) {
  const u64* a = keys.data();
  const size_t n = keys.size();
  auto row = [&](const char* name, size_t bytes, const std::vector<double>& t) {
    std::fprintf(out, "%s,%zu,%s,0,%zu,%.2f,%.2f,%.2f,0\n", dist.c_str(), n, name, bytes, t[runs / 2], t.front(), t.back());
    std::fflush(out);
  };
  auto check = [&](const char* name, auto&& ok) {
    for (size_t i = 0; i < 20000; i++)
      if (!ok(i)) { std::fprintf(stderr, "MISMATCH %s %s n=%zu\n", name, dist.c_str(), n); return false; }
    return true;
  };
  auto bl = [&](u64 k) { return branchless_lower_bound(a, n, k); };
  if (!check("branchless", [&](size_t i) { return bl(qs[i]) == bs(qs[i]); })) return false;
  row("binary_search_branchless", 0, time_ns(bl, qs, runs, sink));

  auto ip = [&](u64 k) { return interpolation_lower_bound(a, n, k); };
  if (!check("interpolation", [&](size_t i) { return ip(qs[i]) == bs(qs[i]); })) return false;
  row("interpolation", 0, time_ns(ip, qs, runs, sink));

  auto orc = [&](size_t i) { size_t p = qpos[i]; return p + (a[p] != qs[i]); };
  if (!check("oracle", [&](size_t i) { return orc(i) == bs(qs[i]); })) return false;
  row("oracle", 0, time_ns_idx(orc, qs.size(), runs, sink));

  {  // scoped so its copy of the keys is freed before the RMI rows
    Eytzinger e(keys);
    auto ey = [&](u64 k) { return e.lookup(k); };
    if (!check("eytzinger", [&](size_t i) { size_t s = ey(qs[i]); return s != 0 && e.b[s] == qs[i]; })) return false;
    row("eytzinger", e.bytes(), time_ns(ey, qs, runs, sink));
  }
  return true;
}

int main(int argc, char** argv) {
  const char* outp = argc > 1 ? argv[1] : "results.csv";
  bool baselines = false;
  size_t max_n = SIZE_MAX;
  for (int i = 2; i < argc; i++) {
    std::string a = argv[i];
    if (a == "--pin") pin_to_core0();
    else if (a == "--baselines") baselines = true;
    else if (a.rfind("--max-n=", 0) == 0) max_n = std::stoull(a.substr(8));
  }
  // spin 2 s so the core is at full clock before the first measurement
  volatile u64 spin = 0;
  auto t_end = std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (std::chrono::steady_clock::now() < t_end) spin = spin + 1;
  FILE* out = std::fopen(outp, "w");
  std::fprintf(out, "dataset,n,index,leaves,bytes,median_ns,min_ns,max_ns,avg_log2_err\n");
  const size_t sizes[] = {100000, 1000000, 10000000, 50000000, 100000000};
  const size_t keys_per_leaf[] = {64, 256, 1024, 4096};
  const int runs = 5;
  const size_t nq = 2000000;
  size_t sink = 0;

  for (std::string dist : {"uniform", "lognormal"}) {
    for (size_t n : sizes) {
      if (n > max_n) continue;
      auto keys = make_keys(dist, n, 42);
      std::mt19937_64 rng(7);
      std::uniform_int_distribution<size_t> pick(0, keys.size() - 1);
      std::vector<u64> qs(nq);
      std::vector<size_t> qpos(baselines ? nq : 0);  // true position of each query, for the oracle
      for (size_t i = 0; i < nq; i++) { size_t p = pick(rng); qs[i] = keys[p]; if (baselines) qpos[i] = p; }

      auto bs = [&](u64 k) { return (size_t)(std::lower_bound(keys.begin(), keys.end(), k) - keys.begin()); };
      auto t = time_ns(bs, qs, runs, sink);
      std::fprintf(out, "%s,%zu,binary_search,0,0,%.2f,%.2f,%.2f,%.2f\n", dist.c_str(), keys.size(),
                   t[runs / 2], t.front(), t.back(), std::log2((double)keys.size()));
      std::fflush(out);

      if (baselines && !time_baselines(out, dist, keys, qs, qpos, runs, sink, bs)) return 1;

      for (size_t kpl : keys_per_leaf) {
        size_t nl = std::max<size_t>(1, keys.size() / kpl);
        RMI rmi(keys, nl);
        for (size_t i = 0; i < 20000; i++) {  // correctness check against binary search
          u64 q = qs[i];
          if (rmi.lookup(q) != bs(q)) { std::fprintf(stderr, "MISMATCH %s n=%zu\n", dist.c_str(), n); return 1; }
        }
        auto r = time_ns([&](u64 k) { return rmi.lookup(k); }, qs, runs, sink);
        std::fprintf(out, "%s,%zu,rmi,%zu,%zu,%.2f,%.2f,%.2f,%.2f\n", dist.c_str(), keys.size(), nl, rmi.bytes(),
                     r[runs / 2], r.front(), r.back(), rmi.log2err);
        std::fflush(out);
      }
      std::fprintf(stderr, "done %s n=%zu\n", dist.c_str(), n);
    }
  }
  std::fclose(out);
  std::printf("sink=%zu\n", sink);
}
