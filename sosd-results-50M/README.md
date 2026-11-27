# SOSD results (Objective 1): six indexes, four datasets, 50M keys

Lookup latency and throughput for RMI, PGM-index, RadixSpline, B+tree, hash table and binary search on books, fb, osm_cellids and wiki_ts, using SOSD (github.com/learnedsystems/SOSD).

## Setup
- Machine: Intel Core i7-1355U (12 MB L3), 16 GB RAM, Windows 11, SOSD run inside WSL2 (Ubuntu, g++ 15). WSL2 was given 11 GB RAM and 8 GB swap through .wslconfig.
- Build: CMake with CMAKE_BUILD_TYPE=Release (-O3).
- Single thread, 1M lookups per run, one size setting per index (SOSD default, no --pareto).
- 31 repeats per index and dataset. The first repeat is discarded as warm-up, so statistics use 30 runs.
- Results are ns per lookup. Throughput is 1000 divided by mean ns, in millions of lookups per second.

## Why 50M keys and not 200M
SOSD keeps several copies of the data in memory, about 63 bytes per key even for plain binary search. Measured peak memory for binary search on books: 50M keys 3.2 GB, 100M keys 6.3 GB, 200M keys 11.7 GB. On this 16 GB laptop (Windows used 8 to 9 GB idle) the 200M runs were 10 to 100 times too slow because of memory pressure, so those numbers are invalid. The hash table also needed 11.8 GB at 100M. All six indexes ran cleanly at 50M, so 50M is the main size.

The 50M datasets are every 4th key of the 200M files (books, fb, osm_cellids and wiki_ts), so keys stay sorted but are sparser than the originals. See scripts/ds.py and scripts/prep50.sh.

## Changes to SOSD (full diff in sosd-changes.patch)
- CMakeLists.txt: FST is always disabled (DISABLE_FST), because it fails to link with newer compilers. FST is not one of the six indexes.
- benchmarks/benchmark_rmi.cc: the synthetic datasets (normal, lognormal, uniform) are commented out, and the 50M datasets are registered. Prebuilt RMIs from download_rmis.sh only cover the 200M names, so RMIs for the 50M datasets were generated with the Rust RMI tool using the 200M param grids.
- competitors/rs.h: the 200M tuning parameters also apply to the 50M names, because RadixSpline rejects any dataset name it does not know. The parameters were tuned for 200M, so they may not be optimal at 50M.
- benchmark.h: an index_data_.reserve() line was added. It did not change peak memory.
- CuckooMap was dropped. RobinHash is the hash table.

## Results: mean lookup latency in ns (30 runs)
| Index | books | fb | osm_cellids | wiki_ts |
|---|---|---|---|---|
| Binary search | 1159.4 | 933.7 | 937.0 | 941.9 |
| B+tree | 588.0 | 569.1 | 567.6 | 659.6 |
| PGM-index | 278.2 | 405.2 | 395.7 | 280.9 |
| RMI | 202.9 | 232.3 | 297.9 | 192.1 |
| RadixSpline | 390.4 | 517.0 | 345.0 | 272.4 |
| Hash table | 620.3 | 200.6 | 148.3 | 124.8 |

Full table (median, std dev, std error, min, max, throughput, index size in MB, build time in s): results/obj1_50M_r31/summary_r31.csv. Chart: results/obj1_50M_r31/latency_50M_r31.png. Raw SOSD output: the .txt files in the same folder.

Index sizes are in the CSV. In short, RMI is about 403 MB, the hash table 2.1 GB, RadixSpline 354 to 885 MB, the B+tree 29 MB, and PGM-index 0.75 to 10 MB.

## Observations
- Every learned index beat binary search on all four datasets. RMI was fastest of the learned indexes everywhere, 3 to 6 times faster than binary search.
- The hash table was fastest on fb, osm and wiki but needs 2.1 GB and supports exact-match lookups only. It was much slower on books (620 ns), and that is unexplained.
- The ranking of PGM-index and RadixSpline depends on the dataset.
- osm_cellids (described as hard to model) was not dramatically harder here, RMI went from 203 ns on books to 298 ns on osm.

## Caveats
- One size setting per index, so "fastest" means at that setting. The size sweep is Objective 2.
- The standard deviation measures timing noise across repeats on one machine, not variation between machines or lookup sets.
- Absolute times are from a laptop under WSL2. Compare ratios, not absolute numbers.
- SOSD reports only average time per lookup, so there is no p99 here.
- Results are at 50M keys, not the 200M in the project plan, for the memory reason above.

## Reproduce
Set up SOSD following its README (download.sh, then download_rmis.sh), build with -DCMAKE_BUILD_TYPE=Release, apply sosd-changes.patch, run scripts/prep50.sh to create the 50M data and RMIs, run scripts/run50b.sh, then scripts/summarize31.py. Needs about 8 GB of free RAM for the hash table runs.
