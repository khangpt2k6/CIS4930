# learned-index-bench

CIS 4930 project: when and why do learned indexes beat traditional indexes on modern hardware?

This folder holds the quick first-result benchmark used for the Week 9 progress slide. It compares a two-stage linear RMI (Kraska et al. 2018) against binary search on sorted 64-bit keys, on uniform and lognormal(0, 2) data, from 100K to 100M keys. The full study will run on SOSD.

## Run it on your machine

Every teammate should run this once, so we get one CSV per CPU architecture.

```bash
# Linux / macOS (needs g++ or clang++)
g++ -O3 -march=native -std=c++17 bench.cpp -o bench      # on Apple Silicon use -mcpu=native
./bench results/<cpu-name>_<arch>.csv --pin                # --pin is ignored on macOS

# Windows (MinGW g++)
g++ -O3 -march=native -std=c++17 bench.cpp -o bench.exe
./bench.exe results/<cpu-name>_<arch>.csv --pin

python plot.py results/<cpu-name>_<arch>.csv results/<cpu-name>_<arch>.png "<CPU name>" [cache_bytes] ["cache label"]
# cache_bytes defaults to the Ryzen 16 MB L3; pass your own CPU's value (e.g. 20971520 "keys exceed P-core L2 (20 MB)" for the M6)
```

It needs about 2 GB of free RAM and takes 3 to 6 minutes. Plug in the laptop and close other apps first.

Name files like `ryzen_ai7_350_x86.csv`, `apple_m2_arm.csv`, `intel_i7_1360p_x86.csv`.

## Output columns

`dataset, n, index, leaves, bytes, median_ns, min_ns, max_ns, avg_log2_err`

Each row is 2M random lookups of existing keys, 1 warm-up run, then the median, min and max of 5 runs. `bytes` is the RMI model size (binary search uses no extra memory). `avg_log2_err` is the average log2 of the last-mile search window, so lower means a more accurate model.

## Compare CPUs (WP5)

```bash
python compare_cpus.py ../report/figures/objective5 \
  "AMD Ryzen AI 7 350 (x86)|#c0392b|16777216|results/ryzen_ai7_350_x86.csv" \
  "Intel Core i7-1355U (x86)|#7d3c98|12582912|results/intel_i7_1355u_x86.csv" \
  "Apple M6 (ARM)|#257de0|20971520|results/apple_m6_arm.csv"
```

Each argument is `label|color|last-level-cache bytes|csv`; add one per CPU. Writes `wp5_summary.csv` and the two WP5 figures.

## Tuned baselines and an oracle (Objective 1)

Is the RMI better than the best non-learned search, not just better than `std::lower_bound`? Run with `--baselines`:

```bash
./bench results/<cpu-name>_<arch>_baselines.csv --pin --baselines      # add --max-n=10000000 if under 3 GB of RAM is free
python baselines.py results/<cpu-name>_<arch>_baselines.csv ../report/figures/objective1 "<CPU name>" [llc_bytes]
```

This adds four rows per dataset and size. Each one is checked against `std::lower_bound` on 20,000 queries before it is timed.

| index | what it is | extra memory |
|---|---|---|
| `binary_search_branchless` | binary search that picks each half with a conditional move, so it never mispredicts a branch | none |
| `eytzinger` | the keys in breadth-first (Eytzinger) order with prefetching, after Khuong and Morin (2017) | a second copy of the keys |
| `interpolation` | interpolation search, up to 8 probes, then binary search: a "model" with two points and no training | none |
| `oracle` | the true position is given and the lookup only reads that key: the floor for any index | none |

`baselines.py` writes `baselines_summary.csv` (every index, the best non-learned one, and the RMI's speedup over it) and `fig1_1_tuned_baselines.png`. The run takes about 10 minutes and needs about 2 GB of free RAM at 100M keys, because the Eytzinger layout is a second copy of the keys.
