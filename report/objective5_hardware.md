# Objective 5: Do learned indexes win on every CPU?

*Draft. Every number comes from `learned-index-bench/results/*.csv`, summarized by `learned-index-bench/compare_cpus.py` into `report/figures/objective5/wp5_summary.csv`. Three CPUs: two x86 (AMD, Intel) and one ARM (Apple).*

## 5.1 Method

Every teammate runs the same benchmark, `learned-index-bench/bench.cpp`, on their own laptop. It compares a two-stage linear RMI (Kraska et al.) with plain binary search over sorted 64-bit keys.

- **Datasets.** Uniform and lognormal(0, 2) keys at five sizes, from 100K to 100M keys.
  - The keys are generated in the benchmark from a fixed seed and de-duplicated.
  - The key counts match across machines to within 2 keys (out of up to 100M).
- **Measurement.** Each result is the median of 5 runs, after 1 warm-up run. Each run is 2M random lookups of existing keys.
- **RMI settings.** The RMI is tried at 4 leaf counts. We report the fastest per size.

| | AMD Ryzen AI 7 350 | Intel Core i7-1355U | Apple M6 |
|---|---|---|---|
| Architecture | x86-64 | x86-64 (2 P-cores, 8 E-cores) | ARM64 |
| Last-level cache | 16 MB L3 (from the benchmark README) | 12 MB L3 (Intel specification) | 20 MB L2 per CPU cluster (`sysctl`) |
| Compiler and flags | not recorded | not recorded | Apple clang 17, `-O3 -mcpu=native` |
| Thread pinning | pinned (`--pin`) | not recorded | not possible on macOS |
| Power | not recorded | not recorded | battery |

The 8-byte keys alone fill the last-level cache at about 1.6M keys on the Intel, 2.1M keys on the Ryzen and 2.6M keys on the M6. The dotted lines in the figures mark these points.

## 5.2 Results

**Table 5.1. Median lookup latency in ns. "RMI" is the fastest of 4 leaf counts. Speedup = binary search ÷ RMI.**

| Keys | Binary search: Ryzen | Intel | M6 | RMI: Ryzen | Intel | M6 | Speedup: Ryzen | Intel | M6 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| uniform 100K | 103.4 | 119.2 | 25.5 | 31.7 | 39.8 | 10.1 | 3.3× | 3.0× | 2.5× |
| uniform 1M | 158.6 | 215.0 | 37.4 | 41.9 | 48.8 | 10.7 | 3.8× | 4.4× | 3.5× |
| uniform 10M | 320.1 | 1,019.5 | 134.9 | 56.3 | 108.0 | 23.8 | 5.7× | 9.4× | 5.7× |
| uniform 50M | 458.8 | 1,363.1 | 254.8 | 72.2 | 175.3 | 32.0 | 6.4× | 7.8× | 8.0× |
| uniform 100M | 525.5 | 1,691.8 | 290.8 | 81.1 | 180.5 | 33.9 | 6.5× | 9.4× | 8.6× |
| lognormal 100K | 99.9 | 121.1 | 24.7 | 70.2 | 86.9 | 26.1 | 1.4× | 1.4× | **0.95×** |
| lognormal 1M | 156.0 | 232.1 | 30.9 | 88.0 | 110.6 | 32.3 | 1.8× | 2.1× | **0.95×** |
| lognormal 10M | 314.5 | 955.3 | 97.2 | 119.7 | 193.6 | 52.3 | 2.6× | 4.9× | 1.9× |
| lognormal 50M | 449.1 | 1,283.2 | 218.7 | 130.8 | 253.3 | 71.6 | 3.4× | 5.1× | 3.1× |
| lognormal 100M | 514.8 | 1,642.4 | 303.8 | 131.8 | 278.9 | 75.3 | 3.9× | 5.9× | 4.0× |

![Figure 5.1](figures/objective5/fig5_1_latency_vs_keys.png)

**Figure 5.1.** Lookup latency against key count on each CPU, log-log. Dashed lines are binary search; solid lines are the fastest RMI setting. Dotted vertical lines mark where the keys exceed each CPU's last-level cache.

![Figure 5.2](figures/objective5/fig5_2_rmi_speedup.png)

**Figure 5.2.** RMI speedup over binary search on each CPU. Above 1, the learned index is faster.

## 5.3 Findings

1. **The M6 is the fastest CPU for both methods, by most when the data fits in cache.**
   - For binary search, the M6 is 4.0 to 5.1× faster than the Ryzen up to 1M keys. At 100M keys it is only 1.7 to 1.8× faster.
   - For the RMI, the M6 is 2.7 to 3.9× faster than the Ryzen up to 1M keys, and 1.8 to 2.4× faster at 100M.
   - The gap shrinks once lookups have to go to main memory. This fits main-memory latency, not core speed, setting the cost at large sizes; we did not measure memory latency directly (Objective 3).
2. **On all three CPUs, the learned index wins more as the data grows.**
   - The RMI's speedup over binary search climbs past the cache limit on every machine.
   - Uniform keys: the speedup rises from 3.3× to 6.5× on the Ryzen, from 3.0× to 9.4× on the Intel, and from 2.5× to 8.6× on the M6.
   - Lognormal keys: it rises from 1.4× to 3.9× on the Ryzen, from 1.4× to 5.9× on the Intel, and from 0.95× to 4.0× on the M6.
   - This matches the project's premise: a learned model saves the most when each binary-search step is a cache miss.
3. **The learned index gains most on the CPU where main memory hurts binary search most.**
   - In cache (up to 1M keys), the Intel is only 1.2 to 1.5× slower than the Ryzen for binary search.
   - From 10M keys on, its binary search is 2.9 to 3.2× slower than the Ryzen's, while its RMI is only 1.6 to 2.4× slower.
   - So the Intel shows the largest speedups in Table 5.1: 9.4× on uniform and 5.9× on lognormal keys at 100M.
   - The RMI needs fewer dependent memory accesses per lookup (Objective 3), so it loses less when each access is slow. We have no counter data from the Intel to confirm this.
4. **Whether the learned index wins at small sizes depends on the CPU.**
   - With lognormal keys at 100K and 1M, the RMI is 5% slower than binary search on the M6 (26.1 vs 24.7 ns and 32.3 vs 30.9 ns). On both x86 laptops it is still 1.4 to 2.1× faster.
   - Here the RMI's model is inaccurate: its last-mile search window averages 2^7 to 2^9 keys (the `avg_log2_err` column). Meanwhile, binary search over cache-resident keys is very fast on the M6.
   - So a hardware change alone can turn a learned-index win into a loss. "Learned indexes beat binary search" holds on these laptops only once the keys exceed the cache, or when the model is accurate (uniform keys).
5. **At large sizes, the learned index benefits more from the M6 than binary search does.**
   - At 100M uniform keys, the RMI is 2.4× faster on the M6 than on the Ryzen, while binary search is only 1.8× faster. So the RMI's speedup over binary search is higher on the M6 (8.6× vs 6.5×).
   - One explanation is that the RMI makes few, independent memory accesses, which a wide out-of-order core can overlap. We have no counter data from the M6 to confirm this.

## 5.4 Limitations

- **Three CPUs, one run each.** Each laptop ran the benchmark once (5 timed runs per row). The trends hold on all three machines, but a second run per machine would show how stable each single number is.
- **Run conditions differ and are partly unrecorded.**
  - The Ryzen run was pinned. The M6 run was unpinned and on battery.
  - For the Ryzen and the Intel, the operating system, compiler and power state are not recorded in the repository. For the Intel we also do not know whether the run was pinned, or whether it ran on a P-core or an E-core. An E-core would make its lookups slower.
  - The Ryzen's own repeat runs show how much this matters. Unpinned, it was 8.5% slower on the median row and up to 1.59× slower; without the warm-up run, up to 1.41× slower on one row.
  - Cross-CPU ratios under about 1.5× should therefore be read with care. The 4 to 5× cache-resident gap, the 3× main-memory gap on the Intel and the speedup trends are far larger than this noise.
- **Noisy rows.** In 9 of 50 M6 rows and 3 of 50 Intel rows, the slowest run was more than 1.2× the median. The worst M6 row was 2.8× (an RMI setting at 100M uniform keys that is not the fastest one, so it is not in Table 5.1); the worst Intel row was 1.44× (binary search, lognormal 100K). Medians are robust to this, but the M6 run should be repeated on AC power.
- **Synthetic data, one learned index.** learned-index-bench covers only RMI against binary search, on uniform and lognormal keys. Objectives 1 and 2 cover the other indexes and the real SOSD datasets.
