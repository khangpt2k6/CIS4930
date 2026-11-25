# Objective 4: where learned indexes fall short

Compares ALEX (updatable learned index), the STX B+tree and PGM-index (static and dynamic) on identical workloads.

| Experiment | What is measured |
|---|---|
| `mixed` | Bulk-load a random half of the keys, then 2M operations at insert fractions 0, 0.1, 0.5, 0.9. Inserts come from the other half; lookups hit loaded keys. Reported as ns/op and Mops/s. |
| `range` | `lower_bound(start)`, then sum the payloads of the next L keys, for L = 10, 100, 1000. Start keys are drawn from the data. |
| `build` | Bulk-load time for all keys. |

All indexes run the same operation sequence (fixed seed). The driver exits with code 2 if any index returns a different checksum.

## Indexes

- ALEX @ `4370da6` plus `patches/alex-0001-portable-intrinsics-arm64.patch`. Upstream ALEX is x86-only (`x86intrin.h`, `cpuid`); the patch swaps in exact portable builtins. ALEX's own unit tests pass on aarch64 with the patch (42/42 cases, 42,490 assertions).
- STX B+tree 0.9 (from SOSD), default node sizes.
- PGM-index @ `c6fcf3d`: static `PGMIndex<u64,64>` over a sorted array for range scans, and `DynamicPGMIndex` (library defaults) for inserts. Built without OpenMP, so construction is single-threaded for every index.

## Datasets (reproducible)

`src/gen_data.cpp` writes SOSD-format files:
- `uniform_10M_uint64`: seed 1, splitmix64, top 50 bits. Integer-only, so the output is bit-identical on any platform.
- `lognormal_10M_uint64`: seed 2, exp(N(0,2)) x 1e9 via Box-Muller. This uses libm. The macOS file (sha256 `1c2d46ea…`) differs from the Linux reference (`3e10a8dc…`) in 3 of 9,980,950 keys, each by 1, because of libm rounding; the key count is identical. Treat lognormal as reproducible per platform.

Each run records the sha256 of its datasets. The real SOSD datasets are used by placing `*_uint64` files (or symlinks) in `data/`; the driver sorts and de-duplicates them, then keeps `--max_keys` evenly spaced distinct keys (fixed stride). Download (by hand; Harvard Dataverse is blocked from Claude's tooling) and check MD5 against SOSD's published values: books `8708eb3e1757640ba18dcd3a0dbb53bc`, osm `70670bf41196b9591e07d0128a281b9a`. sha256 of the files used: books `ef35edc5…`, osm `334f0055…`.

## Run

`bash wp4/scripts/run_laptop_mac.sh` runs both learned-index-bench and WP4 on the Mac. It never overwrites earlier results.

## Results (Nov 25, Apple M6)

Primary: `runs/20261125-111310-m6/` (AC power; books, osm, uniform, lognormal; 4 x 84 rows). Earlier: `runs/20261125-104356-m6/` (battery; uniform, lognormal only), which replicates the synthetic rows (median difference 3.4%, max 22.9%).

Both are validated by `scripts/summarize_wp4.py` (row set, op counts, CSV vs log, cross-index checksums). Each has `summary/wp4_summary.csv` and plots `summary/wp4_{mixed,range,build}.png` (from `scripts/plot_wp4.py`). The write-up is in `report/objective4_limitations.md` and the slides are in the Objective 4 section of `slides/final_presentation.pptx`.
