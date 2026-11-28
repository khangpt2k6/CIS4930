#!/usr/bin/env bash
# One command for the report's results.
#   bash reproduce.sh           rebuild the main results table (report Table 3: best setting of every index on the four
#                               SOSD datasets) and every other summary table and figure from the raw result files in this
#                               repository. Takes seconds. Needs Python 3 with matplotlib.
#   bash reproduce.sh --rerun   first rerun the SOSD benchmark on this machine (downloads 2.7 GB of data, about an hour,
#                               about 4 GB of free memory), then rebuild everything from the new run.
# Every script checks its inputs (row counts, one answer per query, identical results across trials) and stops on a
# mismatch. Raw results are never overwritten; a rerun goes to a new folder under wp12/runs/.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python}
command -v "$PY" >/dev/null || PY=python3
RUN=wp12/runs/20261127-171040-ryzen-win

if [ "${1:-}" = "--rerun" ]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) bash wp12/scripts/run_windows.sh ;;   # needs the data; see wp12/README.md
    *) bash wp12/scripts/run_wsl.sh ;;                           # Linux or WSL: downloads the data itself
  esac
  RUN=$(ls -d wp12/runs/*/ | tail -1); RUN=${RUN%/}
fi

echo "== Questions 1 and 2: SOSD datasets ($RUN)"
"$PY" wp12/scripts/summarize_wp12.py "$RUN" --copy report/figures
"$PY" wp12/scripts/plot_wp12.py "$RUN" --copy report/figures
"$PY" wp12/scripts/report_tables.py "$RUN"

echo "== fb outlier ablation"
for r in wp12/runs/20261127-181801-fb-outliers-kept wp12/runs/20261127-183302-fb-outliers-removed; do
  "$PY" wp12/scripts/summarize_wp12.py "$r" >/dev/null
done
"$PY" wp12/scripts/compare_ablation.py wp12/runs/20261127-181801-fb-outliers-kept wp12/runs/20261127-183302-fb-outliers-removed \
  --copy report/figures/objective1/wp12_fb_outliers.csv

echo "== Tuned baselines and oracle on synthetic keys"
(cd learned-index-bench && "$PY" baselines.py results/ryzen_ai7_350_x86_baselines.csv ../report/figures/objective1 \
  "AMD Ryzen AI 7 350" 16777216)

echo "== Hardware counters"
"$PY" wp3/scripts/summarize_wp3.py wp3/runs/20261126-205955-ryzen-wsl

echo "== Inserts, range scans and build time"
"$PY" wp4/scripts/summarize_wp4.py wp4/runs/20261125-111310-m6

echo "== Three CPUs"
(cd learned-index-bench && "$PY" compare_cpus.py ../report/figures/objective5 \
  "AMD Ryzen AI 7 350 (x86)|#c0392b|16777216|results/ryzen_ai7_350_x86.csv" \
  "Intel Core i7-1355U (x86)|#7d3c98|12582912|results/intel_i7_1355u_x86.csv" \
  "Apple M6 (ARM)|#257de0|20971520|results/apple_m6_arm.csv")

echo "== Report"
"$PY" report/build_final_report.py
echo "done: main results table above (Objective 1), summaries in report/figures/"
