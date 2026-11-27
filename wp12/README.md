# Questions 1 and 2: lookups and memory on the SOSD datasets

`wp12_bench` times every index and tuned baseline on the four 200M-key SOSD datasets (books, fb, osm, wiki). It reports mean, p50, p99 and p99.9 latency, throughput, build time and index size. Each index is swept over several sizes, so the same run answers "is it faster?" (question 1) and "at what memory cost?" (question 2).

| Index | Settings swept | Size |
|---|---|---|
| `std::lower_bound` | none | 0 |
| Branchless binary search (conditional move) | none | 0 |
| Interpolation search (8 probes, then binary search) | none | 0 |
| Eytzinger layout with prefetch (Khuong and Morin 2017) | none | a second copy of the keys |
| STX B+tree 0.9 over every s-th key, then binary search in the gap (as SOSD's BTree) | s = 8, 32, 128, 512, 2048, 8192 | tree nodes |
| RMI, two-stage linear (code from `learned-index-bench/bench.cpp`) | n/32 to n/32768 leaves (6 values) | 24 bytes per leaf |
| PGM-index @ `c6fcf3d` | ε = 8, 32, 128, 512, 2048 | `size_in_bytes()` |
| RadixSpline @ `ab96aa5` | (radix bits, max error) = (24, 8), (22, 16), (20, 32), (18, 64), (16, 128), (14, 256) | `GetSize()` |
| Oracle: the true position is given, the lookup only reads that key | none | 0 |

Every index must return the right position for every one of the 2M queries before it is timed, or the program exits with code 2. (The Eytzinger layout returns a slot in its own copy, so its check compares the key found there.)

## Measurements

- **Mean and throughput.** All 2M queries in a closed loop, median of 5 timed passes after a warm-up pass. Lookups are independent, so the core can overlap their memory accesses. Throughput = 1000 / mean, in million lookups per second on one thread.
- **p50, p99, p99.9.** The first 500K queries, each timed alone between `lfence; rdtsc; lfence` and `rdtscp; lfence`, so lookups cannot overlap. The median cost of an empty lookup (20 to 30 ns, measured at start-up) is subtracted. On this laptop the timer ticks in 10 ns steps. Median of 3 passes.
- **Build time.** Wall time to build the index from the sorted keys.

## Data

The four SOSD files (Marcus et al., PVLDB 2020) from Harvard Dataverse, doi:10.7910/DVN/JGVF9A. `scripts/download_sosd.sh` checks the MD5 that Dataverse lists for each compressed file; the run records the MD5 of each unpacked file. Duplicate keys are removed before indexing. Queries are 2M keys drawn uniformly from the distinct keys (seed 7).

## Run

```bash
# Linux or WSL (downloads the data to ~/sosd_data, about 2.7 GB, needs zstd)
bash wp12/scripts/run_wsl.sh
# Windows, Git Bash + MinGW g++ (the reported run): get the data with download_sosd.sh in WSL, copy the four
# *_200M_uint64 files and md5_uncompressed.txt to C:/Users/<you>/sosd_data (outside OneDrive), then
bash wp12/scripts/run_windows.sh
# summaries and figures (also copied to report/figures/objective1 and objective2)
python wp12/scripts/summarize_wp12.py wp12/runs/<run> --copy report/figures
python wp12/scripts/plot_wp12.py wp12/runs/<run> --copy report/figures
```

A run takes about an hour (3 trials) and needs about 4 GB of free memory: the keys (1.6 GB) and the Eytzinger copy (1.6 GB) at the peak. The scripts refuse to run on battery unless `FORCE=1`.

**Why the reported run is native Windows, not WSL.** Inside WSL2 the per-lookup timer was unstable: the cost of an empty lookup moved between 40 and 60 ticks from run to run, and an L2-resident lookup measured 11 ns in one run and 141 ns in the next. A likely cause is that Windows moves the virtual CPU between the laptop's fast Zen 5 and slower Zen 5c cores, which pinning inside the VM cannot prevent. Natively, the thread is pinned to one logical CPU, and the timer cost stayed constant within a run.

**A RadixSpline bug on Windows.** The RadixSpline builder calls `__builtin_clzl` on a 64-bit key range. On Windows `long` is 32 bits, so the range is truncated, the radix shift is wrong and the radix table is written out of bounds (a crash at 200M keys). `wp12_bench.cpp` maps it to `__builtin_clzll` on Windows only; on Linux the two are identical.

## Results (Nov 27, AMD Ryzen AI 7 350, Windows 11, pinned)

Run: `runs/20261127-171040-ryzen-win/` (3 trials, logs, `machine.txt`). `scripts/summarize_wp12.py` checks that all trials have the same 112 rows and that every row verified all 2M queries.

**Best setting of each index: mean ns / p99 ns, median of 3 trials.**

| Index | books | fb | osm | wiki |
|---|---:|---:|---:|---:|
| `std::lower_bound` | 762 / 1964 | 749 / 1994 | 733 / 1894 | 649 / 1683 |
| Branchless binary search | 963 / 3056 | 915 / 2845 | 901 / 2685 | 716 / 2214 |
| Interpolation search | 1900 / 4068 | 1218 / 2064 | 2070 / 4358 | 1882 / 3927 |
| Eytzinger layout | 279 / 942 | 272 / 942 | 292 / 962 | 233 / 872 |
| B+tree | 491 / 1232 | 488 / 1252 | 485 / 1222 | 411 / 1072 |
| RMI | 205 / 1874 | 705 / 2284 | 282 / 1573 | 126 / 1503 |
| PGM-index | 251 / 892 | 327 / 962 | 363 / 1132 | 204 / 711 |
| RadixSpline | 170 / 962 | 547 / 1403 | 253 / 1192 | 121 / 812 |
| Oracle | 12 / 501 | 13 / 611 | 13 / 561 | 12 / 411 |

- The best learned index is 2.3 to 5.4× faster than `std::lower_bound`, but only 1.16 to 1.93× faster than the best tuned search (the Eytzinger layout, which keeps a 1.6 GB copy of the keys), and 0.83× on fb.
- With at most 10 MB of index, the best learned index is 1.5 to 3.5× faster than the best non-learned option (a B+tree over every 512th key).
- On fb, 20 keys above 2^40 (99.9999% of its keys are below 2^37) flatten the RMI's linear root model: its average search window is 2^19 keys, and it is barely faster than `std::lower_bound`. They also crowd RadixSpline's radix table into one bucket. See the ablation below.
- The RMI's p99 is 1.4 to 2.1× the PGM-index's on books, osm and wiki, even where its mean is competitive: it bounds its error per leaf, not per segment.
- Timed one at a time, every lookup is slower, and the learned lead shrinks (books 1.64× to 1.31×, wiki 1.93× to 1.47×): learned lookups gain the most from overlapping independent lookups.

Run quality: other applications were open. During trial 2, another program ran for a few minutes (fb rows up to 1.9× slower in that trial), and the laptop was on battery by the end of trial 3. The median of 3 trials differs from trials 1 and 3 by a median of 0.5% (at most 8%).

`scripts/report_tables.py` prints every SOSD number used in the report (Tables 3, 4 and 6).

## Ablation: 20 outlier keys on fb

fb holds 200M keys. 99.9999% are below 2^37, but 21 lie between 2^40 and 2^64. The largest, 2^64 - 1, is dropped for every index because PGM-index reserves it. The other 20 stay in the main run. Two runs, back to back, same binary, 3 trials each, on battery power (the laptop had been unplugged):

```bash
TAG=fb-outliers-kept    EXTRA="--datasets fb_200M_uint64 --only binary_search,rmi,pgm,radixspline" FORCE=1 bash wp12/scripts/run_windows.sh
TAG=fb-outliers-removed EXTRA="--datasets fb_200M_uint64 --only binary_search,rmi,pgm,radixspline --max-key 1099511627776" FORCE=1 bash wp12/scripts/run_windows.sh
python wp12/scripts/compare_ablation.py wp12/runs/<kept> wp12/runs/<removed> --copy report/figures/objective1/wp12_fb_outliers.csv
```

| Index (best setting) | keys as-is: mean / p99 ns | 20 keys above 2^40 removed: mean / p99 ns | Mean speedup |
|---|---:|---:|---:|
| `std::lower_bound` | 801 / 1994 | 940 / 2365 | 0.85× |
| RMI | 733 / 2214 | 228 / 1022 | 3.22× |
| PGM-index | 337 / 1032 | 377 / 1002 | 0.89× |
| RadixSpline | 599 / 1443 | 218 / 1052 | 2.74× |

- With the outliers, the RMI's average search window is 2^19 keys at five of six sizes: its least-squares root line is pulled almost flat, so nearly every key lands in one leaf. Without them the window shrinks to 2^5.2 to 2^12.1 keys, depending on the number of leaves.
- RadixSpline's radix table splits the whole key range by prefix, so with the outliers nearly every key falls into one bucket.
- `std::lower_bound` and the PGM-index cannot be affected by 20 keys, yet were 11 to 15% slower in the second run. The second run was later on battery power, so the gains above are, if anything, understated. Compare only within this pair of runs.
