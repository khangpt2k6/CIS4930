# SOSD on Apple Silicon (ARM64): port and first results

Consolidated from the local SOSD clone on the Apple M6 laptop (`~/Desktop/SOSD`, branch `arm64-support`),
upstream https://github.com/learnedsystems/SOSD at `f52f4cb`.

## Contents

| Path | What it is |
|---|---|
| `patches/0001-*.patch` | commit `a201621`: Apple Silicon build + unsuccessful-lookup support + RS configs for custom datasets + raw results |
| `patches/0002-*.patch` | commit `28b078c`: bumps the `fast64` submodule |
| `patches/fast64-0003-*.patch` | fast64 commit `e3f4b56`: architecture-aware AVX-512 detection in `build.rs` |
| `scripts/split_results.py` | splits a raw SOSD results table into per-run CSVs with headers and decoded configs |
| `scripts/run_mac_release.sh` | Release build + 3 trials on the Mac; resumable with `RUN_DIR=...` |
| `scripts/summarize_runs.py` | validates a run against its logs and writes `summary/` |
| `scripts/plot_pareto.py` | latency vs size plot from `summary/lookup_pareto.csv` |
| `runs/20261125-100608-release/` | optimized results (current) |
| `../slides/final_presentation.pptx` (Objective 2 section) | ARM64 lookup results slide |

Apply: `git clone https://github.com/learnedsystems/SOSD && cd SOSD && git checkout f52f4cb && git submodule update --init --recursive && git am ../patches/000[12]-*.patch && (cd fast64 && git am ../../patches/fast64-0003-*.patch)`

## What the port changes

- `CMakeLists.txt`: on Apple + arm64, builds only the BTree, PGM and RS benchmarks and does not link fast64.
- `benchmark.cc`: everything else is `#ifndef SOSD_ARM64_PORTABLE`. **Excluded on ARM64: RMI, TS, CHT, ART, IBTree, FAST, ALEX, RMI_CPP, FST, Wormhole, RBS, CuckooMap.**
- `benchmark.h`: `_mm_mfence()` → `std::atomic_thread_fence(seq_cst)`; the result check returns `util::NOT_FOUND` for absent keys.
- `competitors/hash.h`: RobinHash returns an empty bound for absent keys instead of aborting.
- `competitors/rs.h`: custom datasets get 10 configs, variant v = (radix_bits 7+v, max_error 32).

## Workload (verified from the data files)

- `data/lognormal_1M_uint64`: 1,000,000 keys, sorted, unique, min 6,861,889, max 228,141,071,873.
- `data/lognormal_1M_uint64_equality_lookups_100K`: 100,000 lookups; 50.17% are present and 49.83% expect `NOT_FOUND`.
- Single thread. SOSD's CSV column 3 is the **median over `--repeats`** (5 per the run notes).
- Searcher: BinarySearch (last-mile search for every index).

## Optimized results (Nov 25, current)

Run: `runs/20261125-100608-release/` (raw logs and CSVs per trial, `summary/` for aggregates, `machine.txt`).

- Machine: MacBook Pro Mac18,1, Apple M6, 12 cores, 16 GB, macOS 27.2.1, Apple clang 17.0.0.
- Build: SOSD `arm64-support` @ `28b078c`, fast64 @ `e3f4b56`, flags `-O3 -DNDEBUG -ffast-math -march=native`.
- Same dataset and lookups as below. 3 trials; each trial = default run + `--pareto` run (5 repeats each) + `--build --pareto` run.
- Latency = median over 3 trials of the per-trial median of 5 repeats. Build = median over 3 trials.
- `scripts/summarize_runs.py` checks every CSV row against its log (all 117 lookup rows and 102 build rows match).

| Index | Config | Median ns/lookup | Size | Build |
|---|---|---:|---:|---:|
| RobinHash | hash table | 9.7 | 64 MiB | 26.1 ms |
| RadixSpline | 17 radix bits, err 32 | 21.8 | 438 KiB | 4.7 ms |
| RadixSpline | 11 radix bits, err 32 | 22.7 | 20 KiB | 4.0 ms |
| STX B+tree | size_scale 512 | 28.4 | 36 KiB | <0.01 ms |
| PGM-index | ε = 64 | 31.6 | 2.3 KiB | 6.3 ms |
| Binary search | none | 49.2 | 0 | 0 |

Best configuration per index from the `--pareto` sweep (`summary/lookup_pareto.csv`; plot `summary/pareto_latency_vs_size.png`).

- All 10 RadixSpline sizes fall within 21.8–25.1 ns; the 20 KiB config is 3.9% slower than the 438 KiB one, with 95% less memory.
- At the best settings, RadixSpline is 23% faster than the B+tree, 31% faster than PGM and 56% faster than binary search.
- The best B+tree (28.4 ns) beats the best PGM (31.6 ns). RobinHash is 2.3× faster than RadixSpline but supports equality lookups only.
- At ~20 KiB, all three are about the same size: RS 22.7 ns, B+tree (size_scale 1024, 18.8 KiB) 28.8 ns, PGM ε=16 (20.6 KiB) 35.8 ns.

Run-to-run noise: individual trials occasionally spike (e.g. RS variant 10 max 52.0 ns, binary search max 151 ns), and the default run measured RS variant 10 at 27.5 ns against 21.8 ns in the sweep. Medians are reported for this reason; `min_ns`/`max_ns` are in the summary CSVs. All three trials ran on battery power and macOS does not support thread pinning.

## Nov 12 results (unoptimized build, superseded)

Kept for the record only; do not cite. See caveat 0.

### Results (median ns/lookup, lognormal_1M_uint64, 50% unsuccessful)

Five-index run:

| Index | ns/lookup | Size | Build |
|---|---:|---:|---:|
| RobinHash | 71.5 | 64 MiB | 106 ms |
| RS (old config, see caveat) | 166.5 | 850 MiB | 808 ms |
| PGM ε=16 | 216.9 | 20.6 KiB | 48.7 ms |
| BTree (STX, size_scale 32) | 224.1 | 567 KiB | 0.15 ms |
| BinarySearch | 277.1 | 0 | 0 |

RS sweep: fastest is variant 9 (16 radix bits, 149.2 ns, 226 KiB); variant 7 (14 bits) is 151.6 ns at 67 KiB.
PGM sweep: fastest is ε=16 (217.7 ns, 20.6 KiB); ε=8192 is 278.0 ns at 200 B, which matches binary search.
At their fastest settings, RS is about 31% faster than PGM (149.2 vs 216.9 ns) and about 46% faster than binary search.

## Caveats

0. **The Nov 12 build was unoptimized.** `build/CMakeCache.txt` has an empty `CMAKE_BUILD_TYPE`, and the compile flags contain no `-O` level (`-ffast-math -march=native` only), so clang defaulted to `-O0`. Upstream `scripts/prepare.sh` uses `-DCMAKE_BUILD_TYPE=Release`. Superseded by the optimized results above.
1. The RS row in the five-index run came from a build **before** the RS custom-config change in `a201621` (850 MiB index). Do not compare it with the sweep rows.
2. The RS sweep is not monotone: variant 10 (17 bits, 164.8 ns) is slower than 9, and variant 3 (242.8 ns) is slower than 2 and 1. This looks like noise from a single run on an unpinned macOS machine. Rerun before drawing fine-grained conclusions.
3. An earlier handoff summary lists different RS latencies (e.g. variant 10 = 147.6 ns). Those numbers are **not in any saved file** and are not used here.
4. PGM ε=16 appears twice (216.9 and 217.7 ns), from two separate runs; this gives a rough idea of run-to-run variation.
5. Machine and compiler are now recorded in `runs/*/machine.txt`. Still not recorded: how `lognormal_1M_uint64` itself was generated (no generator for it is in the repo). The build used `/usr/bin/c++` (Apple clang) with no `CMAKE_BUILD_TYPE` set.
6. The RobinHash size is SOSD's reported allocation (2^26 bytes), not the key payload.
