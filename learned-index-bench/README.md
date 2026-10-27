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

python plot.py results/<cpu-name>_<arch>.csv results/<cpu-name>_<arch>.png "<CPU name>"
```

It needs about 2 GB of free RAM and takes 3 to 6 minutes. Plug in the laptop and close other apps first.

Name files like `ryzen_ai7_350_x86.csv`, `apple_m2_arm.csv`, `intel_i7_1360p_x86.csv`.

## Output columns

`dataset, n, index, leaves, bytes, median_ns, min_ns, max_ns, avg_log2_err`

Each row is 2M random lookups of existing keys, 1 warm-up run, then the median, min and max of 5 runs. `bytes` is the RMI model size (binary search uses no extra memory). `avg_log2_err` is the average log2 of the last-mile search window, so lower means a more accurate model.
