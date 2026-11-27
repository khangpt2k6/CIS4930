# Objective 3: hardware counters per lookup

Reads cycles, instructions, branch misses, cache fills by source (L2, L3, another core complex, DRAM) and page walks around the lookup loop, with Linux `perf_event_open`. It uses the same keys and 2M queries as `learned-index-bench`, so the counts line up with the Objective 5 latencies.

| Index | Setting |
|---|---|
| Binary search | `std::lower_bound` |
| Binary search, branchless | same comparisons, conditional move instead of a branch (a control) |
| RMI | the `learned-index-bench` code, copied unchanged; 4 leaf counts |
| PGM-index @ `c6fcf3d` | ε = 64 |
| RadixSpline @ `ab96aa5` | 18 radix bits, max error 32 |
| STX B+tree 0.9 (from SOSD @ `f52f4cb`) | default node sizes |

Every index must return the same position as binary search for every query, or the program exits with code 2.

## Run (Linux, or WSL2 on Windows)

```bash
bash wp3/scripts/run_wsl.sh            # fetch deps, build, calibrate, 3 trials -> wp3/runs/<time>-ryzen-wsl/
python wp3/scripts/summarize_wp3.py wp3/runs/<run>   # validation checks + summary/wp3_summary.csv
python wp3/scripts/plot_wp3.py wp3/runs/<run>        # summary/fig3_1_*.png, fig3_2_*.png (needs matplotlib)
```

`run_wsl.sh` refuses to start on battery power (`FORCE=1` overrides) and never overwrites a run. It needs `perf_event_paranoid` of 2 or lower and about 4 GB of free memory. It takes about 30 minutes.

The events are AMD Zen 4/5 raw events (0x43 data-cache fills by source, 0x45 L1 DTLB misses). On another CPU, change `GROUPS` in `src/wp3_perf.cpp`. Then check them with `wp3_perf --calibrate`, a pointer chase that should put each memory size in the matching cache level.

## Results (Nov 26, AMD Ryzen AI 7 350, WSL2)

`runs/20261126-205955-ryzen-wsl/`: calibration, 3 trials x 90 rows, logs, `machine.txt`. All checks in `summarize_wp3.py` pass. The write-up is `report/objective3_counters.md`, and the slides are in the Objective 3 section of `slides/final_presentation.pptx`.

WSL2 is a virtual machine. The calibration shows the counters work inside it, but latencies are 1.06x to 1.45x higher than the native Windows run in Objective 5. Trust the counts more than the times: instructions and branch misses barely change between trials, while times vary by a median of 1.18x.
