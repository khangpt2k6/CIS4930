## Experimental Setup

### Machines

| Machine | CPU and memory | Caches | OS and compiler | Used for |
|---|---|---|---|---|
| Apple MacBook Pro (Mac18,1) | Apple M6, ARM64; 12 cores (2 Super, 4 Performance, 6 Efficiency); 16 GB | L1d 128 KiB per P-core; L2 20 MiB per cluster; 128-byte cache lines (`sysctl`) | macOS 27.2.1; Apple clang 17.0.0 | Objectives 4 and 5; preliminary SOSD lookups |
| AMD laptop | AMD Ryzen AI 7 350, x86-64 | L3 16 MB | [TODO: OS, compiler, memory, power state] | Objective 5 |
| Intel laptop | [TODO] | [TODO] | [TODO] | Objective 5 |
| AMD laptop, Linux virtual machine | Same AMD Ryzen AI 7 350; 7 GiB visible to Linux | L1d 48 KiB and L2 1 MiB per core; L3 16 MiB (Linux `sysfs`) | Ubuntu 24.04.4 under WSL2 (Linux 6.6.87); g++ 13.3.0; AC power | Objective 3 (`perf_event_open`) |
| [TODO: machine(s) for Objectives 1–2] | [TODO] | [TODO] | [TODO] | Objectives 1–2 |

All measurements are single-threaded. macOS does not allow pinning a thread to a core, so the M6 runs are unpinned. The AMD run was pinned. Each table states whether its laptop was on AC or battery power.

### Indexes and software

- **SOSD [2], ported to ARM64.** We ported SOSD to Apple Silicon (fork branch `arm64-support` @ `28b078c` plus three patches in `sosd-arm64/patches/`), built with `-O3 -DNDEBUG -march=native`.
  - The port builds RadixSpline, PGM-index, the STX B+tree, RobinHash (hash table) and binary search.
  - RMI, ALEX, TS, CHT, ART and FAST depend on x86-only code and are compiled out.
- **Objective 4 driver** (`wp4/src/wp4_bench.cpp`). One C++ program runs ALEX [5], the STX B+tree 0.9, and the static and dynamic PGM-index [3] on identical operation sequences.
  - ALEX @ `4370da6` does not build on ARM, so we patch it with portable bit-counting builtins. Its own 42 unit tests pass on ARM64 with the patch.
  - PGM-index @ `c6fcf3d`.
- **learned-index-bench** (`learned-index-bench/bench.cpp`). A self-contained two-stage linear RMI [1] against binary search, run on each team member's laptop for Objective 5.
- **Objective 3 driver** (`wp3/src/wp3_perf.cpp`). Reads hardware counters around the lookup loop with `perf_event_open`, on the same keys and queries as learned-index-bench. It runs binary search (with and without a branch), the learned-index-bench RMI, PGM-index @ `c6fcf3d`, RadixSpline [4] @ `ab96aa5` and the STX B+tree 0.9 from SOSD. The events are listed in Objective 3.
- [TODO (Objectives 1-2 owners): list the SOSD build and index configurations used on x86, and how p99 and throughput were measured.]

### Datasets

| Dataset | Keys | Source | Used in |
|---|---|---|---|
| books | 800M in the file; 10M evenly spaced distinct keys used | SOSD [2]; MD5 checked against SOSD's published value | Objective 4 |
| osm (cell IDs) | 800M in the file; 10M evenly spaced distinct keys used | SOSD [2]; MD5 checked against SOSD's published value | Objective 4 |
| uniform | 10,000,000 | `wp4/src/gen_data.cpp`, seed 1; bit-identical across platforms | Objective 4 |
| lognormal(0, 2) | 9,980,950 | `wp4/src/gen_data.cpp`, seed 2 | Objective 4 |
| uniform and lognormal | 100K to 100M | generated inside `learned-index-bench` from a fixed seed | Objectives 3 and 5 |
| lognormal | 1M | an earlier script whose seed was not recorded; the keys are kept but cannot be regenerated | Preliminary SOSD lookups only |
| books, fb, osm, wiki (200M) | 200M each | SOSD [2] | [TODO: Objectives 1-2] |

### Methodology

- **Repeats.** Unless a section says otherwise, each reported number is the median of 3 trials. The benchmarks' inner repeats are described in each objective's method.
- **Validation.** Before analysis, scripts check every result row against its log. They also check the expected operation counts, and that all indexes return the same checksum for the same workload (`wp4/scripts/summarize_wp4.py`, `sosd-arm64/scripts/summarize_runs.py`, `wp3/scripts/summarize_wp3.py`).
- **Record keeping.** Each run folder records the machine description, compiler flags, power source and dataset checksums. Earlier runs are never overwritten.
