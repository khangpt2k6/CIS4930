// Quick first-result benchmark: two-stage linear RMI vs binary search on sorted uint64 keys.
// Build: g++ -O3 -march=native -std=c++17 bench.cpp -o bench
// Usage: bench <out.csv> [--pin]
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

int main(int argc, char** argv) {
  const char* outp = argc > 1 ? argv[1] : "results.csv";
  if (argc > 2 && std::string(argv[2]) == "--pin") pin_to_core0();
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
      auto keys = make_keys(dist, n, 42);
      std::mt19937_64 rng(7);
      std::uniform_int_distribution<size_t> pick(0, keys.size() - 1);
      std::vector<u64> qs(nq);
      for (auto& q : qs) q = keys[pick(rng)];

      auto bs = [&](u64 k) { return (size_t)(std::lower_bound(keys.begin(), keys.end(), k) - keys.begin()); };
      auto t = time_ns(bs, qs, runs, sink);
      std::fprintf(out, "%s,%zu,binary_search,0,0,%.2f,%.2f,%.2f,%.2f\n", dist.c_str(), keys.size(),
                   t[runs / 2], t.front(), t.back(), std::log2((double)keys.size()));
      std::fflush(out);

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
