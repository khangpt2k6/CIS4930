# Optimized ARM64 results: what each work package can use

Everything below is verified (each CSV row checked against its log). Source run:
`sosd-arm64/runs/20261125-100608-release/` with aggregates in `summary/`. Details in `sosd-arm64/README.md`.

**Setup.** Apple M6 MacBook Pro (Mac18,1), 16 GB, macOS 27.2.1, Apple clang 17, SOSD `arm64-support` @ `28b078c`,
`-O3 -DNDEBUG -march=native`. Dataset `lognormal_1M_uint64` (1M keys), 100K lookups, 49.8% unsuccessful.
Median of 5 repeats per run, then median of 3 trials. Single thread, unpinned (macOS has no pinning), on battery.

**Indexes available on ARM64.** RS, PGM, STX B+tree, RobinHash, binary search. RMI, ALEX, TS, CHT, ART and FAST are compiled out of the SOSD ARM64 port.

## WP1 (Khang): lookup latency and throughput

- Use `summary/lookup_default.csv` (default config per index) or `lookup_pareto.csv` (all configs).
- Best per index: RobinHash 9.7 ns, RS 21.8 ns, B+tree 28.4 ns, PGM 31.6 ns, binary search 49.2 ns.
- **Not available:** p99. SOSD reports a mean per repeat, not per-lookup times. Throughput was not measured
  separately; single-thread lookups/s = 1e9 / ns is an inference, so label it that way.
- **Not available:** the four real datasets (books, fb, osm, wiki). Dataverse downloads are blocked from my tooling.
  This is synthetic lognormal at 1M keys only.

## WP2 (Riyon): memory vs speed

- Direct fit: `summary/lookup_pareto.csv` has 10 RS, 10 PGM and 12 B+tree sizes with bytes and median ns.
  The plot is `summary/pareto_latency_vs_size.png`.
- Finding: RS stays within 21.8–25.1 ns from 14 KiB to 438 KiB. PGM is best at ε=64 (2.3 KiB, 31.6 ns).
  The B+tree is best at size_scale 512 (36 KiB, 28.4 ns).

## WP5 (Vishakha): compare CPUs

- This is the ARM data point. For a like-for-like comparison with the x86 laptops, use the learned-index-bench CSV
  `learned-index-bench/results/apple_m6_arm.csv` once it's pushed. SOSD was not run on x86 with this dataset.
- Laptop CSV is in: `learned-index-bench/results/apple_m6_arm.csv` (plot `apple_m6_arm.png`, metadata `apple_m6_arm_machine.txt`).
  It ran unpinned (macOS) on battery; the Ryzen reference run was pinned with warm-up.
- Key counts: lognormal `n` matches the Ryzen run at every size. Uniform `n` differs by 1–2 keys at 50M and 100M
  (49,999,997 vs 49,999,998 and 99,999,992 vs 99,999,994), so the generated key sets are not bit-identical across
  machines. Compare at matching nominal sizes.
- M6 caches from `sysctl`: 128 KiB L1d per P-core, 20 MiB L2 per cluster, 128 B cache lines. Apple does not expose a system-level cache size there, so none is claimed.

## WP3 (Vishakha): perf counters

- Not possible on this Mac: `perf` needs native Linux. Nothing here substitutes for it.

## Data that cannot be reproduced

- `lognormal_1M_uint64` came from an unrecorded script (seed and parameters lost). Its keys are preserved in the M6 laptop's
  SOSD `data/` folder, but it cannot be regenerated. New experiments (WP4) use `wp4/src/gen_data.cpp` with fixed seeds
  and recorded sha256.
