// WP4: where learned indexes fall short. ALEX vs STX B+tree vs PGM-index on identical workloads.
//   build : bulk-load time for all n keys
//   range : lower_bound(start) then scan L keys, L in {10,100,1000}; start keys drawn from the data
//   mixed : bulk-load a random half of the keys, then M operations with insert fraction f in
//           {0, 0.1, 0.5, 0.9}; inserts come from the other half, lookups hit bulk-loaded keys
// Every index sees the same operation sequence; checksums must agree across indexes, else exit 2.
// Usage: wp4_bench <keys_file(SOSD uint64 format)> <dataset_name> <out.csv>
//                  [--trials T=3] [--max_keys N] [--ops M=2000000] [--seed S=42]
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include "alex.h"
#include "pgm/pgm_index.hpp"
#include "pgm/pgm_index_dynamic.hpp"
#include "stx/btree_map.h"

using u64 = uint64_t;
using Clock = std::chrono::steady_clock;
static inline u64 payload_of(u64 k) { return (k * 0x9E3779B97F4A7C15ULL) >> 1; }  // never UINT64_MAX
static inline double secs(Clock::time_point a, Clock::time_point b) {
  return std::chrono::duration<double>(b - a).count();
}

struct Row { std::string exp, index, param; int trial; u64 ops; double sec; u64 checksum; };
static std::vector<Row> rows;
static void add(const char* exp, const char* idx, std::string param, int t, u64 ops, double s, u64 cs) {
  rows.push_back({exp, idx, param, t, ops, s, cs});
  fprintf(stderr, "  %-6s %-10s %-6s trial %d  %10.2f ns/op  checksum %llu\n", exp, idx, param.c_str(), t,
          s * 1e9 / ops, (unsigned long long)cs);
}

static std::vector<u64> load(const char* path, size_t max_keys) {
  FILE* f = fopen(path, "rb");
  if (!f) { perror(path); exit(1); }
  u64 n; if (fread(&n, 8, 1, f) != 1) exit(1);
  std::vector<u64> k(n);
  if (fread(k.data(), 8, n, f) != n) { fprintf(stderr, "short read\n"); exit(1); }
  fclose(f);
  std::sort(k.begin(), k.end());
  k.erase(std::unique(k.begin(), k.end()), k.end());
  if (max_keys && k.size() > max_keys) {  // deterministic down-sampling by stride
    std::vector<u64> s; s.reserve(max_keys);
    double step = (double)k.size() / max_keys;
    for (size_t i = 0; i < max_keys; i++) s.push_back(k[(size_t)(i * step)]);
    k.swap(s);
  }
  return k;
}

int main(int argc, char** argv) {
  if (argc < 4) { fprintf(stderr, "usage: wp4_bench <keys> <name> <out.csv> [--trials T] [--max_keys N] [--ops M] [--seed S]\n"); return 1; }
  int trials = 3; size_t max_keys = 0; u64 ops_arg = 2000000, seed = 42;
  for (int i = 4; i + 1 < argc; i += 2) {
    if (!strcmp(argv[i], "--trials")) trials = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--max_keys")) max_keys = strtoull(argv[i + 1], 0, 10);
    else if (!strcmp(argv[i], "--ops")) ops_arg = strtoull(argv[i + 1], 0, 10);
    else if (!strcmp(argv[i], "--seed")) seed = strtoull(argv[i + 1], 0, 10);
  }
  const std::vector<u64> keys = load(argv[1], max_keys);
  const size_t n = keys.size();
  fprintf(stderr, "dataset %s: %zu unique keys\n", argv[2], n);
  std::vector<std::pair<u64, u64>> pairs(n);
  std::vector<u64> pay(n);
  for (size_t i = 0; i < n; i++) { pay[i] = payload_of(keys[i]); pairs[i] = {keys[i], pay[i]}; }

  // ---- range-scan queries (fixed per seed) ----
  const int Ls[] = {10, 100, 1000};
  std::map<int, std::vector<u64>> rq;
  { std::mt19937_64 r(seed);
    for (int L : Ls) { size_t q = std::min<size_t>(200000, 20000000 / L);
      for (size_t i = 0; i < q; i++) rq[L].push_back(keys[r() % n]); } }

  // ---- mixed workloads (fixed per seed) ----
  std::vector<u64> perm(keys);
  { std::mt19937_64 r(seed + 1); std::shuffle(perm.begin(), perm.end(), r); }
  std::vector<std::pair<u64, u64>> init;
  for (size_t i = 0; i < n / 2; i++) init.push_back({perm[i], payload_of(perm[i])});
  std::sort(init.begin(), init.end());
  const u64* pool = perm.data() + n / 2; const size_t pool_n = n - n / 2;
  const u64 M = std::min<u64>(ops_arg, (u64)(pool_n / 0.9));
  const double fracs[] = {0.0, 0.1, 0.5, 0.9};
  struct Op { bool ins; u64 key; };
  std::map<double, std::vector<Op>> mix;
  for (double f : fracs) {
    std::mt19937_64 r(seed + 2 + (u64)(f * 100));
    u64 ni = (u64)(f * M + 0.5); std::vector<Op> v; v.reserve(M);
    for (u64 i = 0; i < M; i++) v.push_back({i < ni, 0});
    std::shuffle(v.begin(), v.end(), r);
    size_t next = 0;
    for (auto& o : v) o.key = o.ins ? pool[next++] : init[r() % init.size()].first;
    mix[f] = std::move(v);
  }

  for (int t = 1; t <= trials; t++) {
    fprintf(stderr, "== trial %d/%d\n", t, trials);
    // ===== build + range =====
    { auto a = Clock::now(); alex::Alex<u64, u64> idx; idx.bulk_load(pairs.data(), (int)n); auto b = Clock::now();
      add("build", "ALEX", "", t, n, secs(a, b), n);
      for (int L : Ls) { u64 cs = 0; auto& q = rq[L]; a = Clock::now();
        for (u64 k : q) { auto it = idx.lower_bound(k); for (int c = 0; c < L && !it.is_end(); c++, it++) cs += it.payload(); }
        b = Clock::now(); add("range", "ALEX", std::to_string(L), t, q.size(), secs(a, b), cs); } }
    { auto a = Clock::now(); stx::btree_map<u64, u64> idx; idx.bulk_load(pairs.begin(), pairs.end()); auto b = Clock::now();
      add("build", "BTree", "", t, n, secs(a, b), idx.size());
      for (int L : Ls) { u64 cs = 0; auto& q = rq[L]; a = Clock::now();
        for (u64 k : q) { auto it = idx.lower_bound(k); for (int c = 0; c < L && it != idx.end(); c++, ++it) cs += it.data(); }
        b = Clock::now(); add("range", "BTree", std::to_string(L), t, q.size(), secs(a, b), cs); } }
    { auto a = Clock::now(); pgm::PGMIndex<u64, 64> idx(keys.begin(), keys.end()); auto b = Clock::now();
      add("build", "PGM", "", t, n, secs(a, b), n);
      for (int L : Ls) { u64 cs = 0; auto& q = rq[L]; a = Clock::now();
        for (u64 k : q) { auto r = idx.search(k);
          size_t p = std::lower_bound(keys.begin() + r.lo, keys.begin() + r.hi, k) - keys.begin();
          size_t e = std::min(n, p + L); for (; p < e; p++) cs += pay[p]; }
        b = Clock::now(); add("range", "PGM", std::to_string(L), t, q.size(), secs(a, b), cs); } }
    { auto a = Clock::now(); pgm::DynamicPGMIndex<u64, u64> idx(pairs.begin(), pairs.end()); auto b = Clock::now();
      add("build", "DynPGM", "", t, n, secs(a, b), n);
      for (int L : Ls) { u64 cs = 0; auto& q = rq[L]; a = Clock::now();
        for (u64 k : q) { auto it = idx.lower_bound(k); for (int c = 0; c < L && it != idx.end(); c++, ++it) cs += it->second; }
        b = Clock::now(); add("range", "DynPGM", std::to_string(L), t, q.size(), secs(a, b), cs); } }

    // ===== mixed inserts / lookups =====
    for (double f : fracs) {
      auto& ops = mix[f]; char pf[16]; snprintf(pf, sizeof pf, "%.1f", f);
      { alex::Alex<u64, u64> idx; idx.bulk_load(init.data(), (int)init.size()); u64 cs = 0; auto a = Clock::now();
        for (auto& o : ops) { if (o.ins) { idx.insert(o.key, payload_of(o.key)); cs++; } else { u64* p = idx.get_payload(o.key); if (p) cs += *p; } }
        auto b = Clock::now(); add("mixed", "ALEX", pf, t, ops.size(), secs(a, b), cs); }
      { stx::btree_map<u64, u64> idx; idx.bulk_load(init.begin(), init.end()); u64 cs = 0; auto a = Clock::now();
        for (auto& o : ops) { if (o.ins) { idx.insert(o.key, payload_of(o.key)); cs++; } else { auto it = idx.find(o.key); if (it != idx.end()) cs += it.data(); } }
        auto b = Clock::now(); add("mixed", "BTree", pf, t, ops.size(), secs(a, b), cs); }
      { pgm::DynamicPGMIndex<u64, u64> idx(init.begin(), init.end()); u64 cs = 0; auto a = Clock::now();
        for (auto& o : ops) { if (o.ins) { idx.insert_or_assign(o.key, payload_of(o.key)); cs++; } else { auto it = idx.find(o.key); if (it != idx.end()) cs += it->second; } }
        auto b = Clock::now(); add("mixed", "DynPGM", pf, t, ops.size(), secs(a, b), cs); }
    }
  }

  // checksums must agree across indexes for each (experiment, param, trial)
  std::map<std::string, u64> ref; int bad = 0;
  for (auto& r : rows) {
    if (r.exp == "build") continue;
    std::string k = r.exp + "|" + r.param + "|" + std::to_string(r.trial);
    auto it = ref.find(k);
    if (it == ref.end()) ref[k] = r.checksum;
    else if (it->second != r.checksum) { fprintf(stderr, "CHECKSUM MISMATCH %s %s\n", k.c_str(), r.index.c_str()); bad++; }
  }
  FILE* o = fopen(argv[3], "w");
  fprintf(o, "experiment,dataset,n,index,param,trial,ops,seconds,ns_per_op,mops_per_s,checksum\n");
  for (auto& r : rows)
    fprintf(o, "%s,%s,%zu,%s,%s,%d,%llu,%.6f,%.3f,%.4f,%llu\n", r.exp.c_str(), argv[2], n, r.index.c_str(), r.param.c_str(),
            r.trial, (unsigned long long)r.ops, r.sec, r.sec * 1e9 / r.ops, r.ops / r.sec / 1e6, (unsigned long long)r.checksum);
  fclose(o);
  fprintf(stderr, bad ? "FAILED: %d checksum mismatches\n" : "all checksums agree\n", bad);
  return bad ? 2 : 0;
}
