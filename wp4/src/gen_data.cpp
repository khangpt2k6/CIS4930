// Reproducible synthetic datasets in SOSD format (uint64 count, then sorted unique uint64 keys).
// Usage: gen_data <uniform|lognormal> <num_draws> <seed> <out_file>
//  uniform  : splitmix64 draws, top 50 bits (integer-only, bit-identical on every platform)
//  lognormal: exp(N(0, 2)) * 1e9, normals from splitmix64 + Box-Muller (needs libm log/exp/cos;
//             results can differ by 1 ulp between libm implementations, so record the sha256)
// Draws are sorted and de-duplicated, so the key count can be slightly below num_draws.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
static uint64_t sm_state;
static inline uint64_t splitmix64() {
  uint64_t z = (sm_state += 0x9E3779B97F4A7C15ULL);
  z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
  z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
  return z ^ (z >> 31);
}
static inline double u01() { return ((splitmix64() >> 11) + 0.5) * 0x1.0p-53; }  // (0,1)
int main(int argc, char** argv) {
  if (argc != 5) { fprintf(stderr, "usage: gen_data <uniform|lognormal> <num_draws> <seed> <out>\n"); return 1; }
  std::string dist = argv[1];
  size_t n = std::strtoull(argv[2], nullptr, 10);
  sm_state = std::strtoull(argv[3], nullptr, 10);
  std::vector<uint64_t> k; k.reserve(n);
  if (dist == "uniform") {
    for (size_t i = 0; i < n; i++) k.push_back(splitmix64() >> 14);
  } else if (dist == "lognormal") {
    const double two_pi = 6.283185307179586476925286766559;
    while (k.size() < n) {
      double r = std::sqrt(-2.0 * std::log(u01())), t = two_pi * u01();
      double z0 = r * std::cos(t), z1 = r * std::sin(t);
      k.push_back((uint64_t)(std::exp(2.0 * z0) * 1e9));
      if (k.size() < n) k.push_back((uint64_t)(std::exp(2.0 * z1) * 1e9));
    }
  } else { fprintf(stderr, "unknown distribution\n"); return 1; }
  std::sort(k.begin(), k.end());
  k.erase(std::unique(k.begin(), k.end()), k.end());
  FILE* f = fopen(argv[4], "wb");
  uint64_t cnt = k.size();
  fwrite(&cnt, 8, 1, f); fwrite(k.data(), 8, k.size(), f); fclose(f);
  printf("%s draws=%zu seed=%s unique=%llu min=%llu max=%llu\n", dist.c_str(), n, argv[3],
         (unsigned long long)cnt, (unsigned long long)k.front(), (unsigned long long)k.back());
}
