#!/usr/bin/env bash
# OPTIONAL: Objectives 1-2 on Apple Silicon (ARM64). SOSD lookups and latency-vs-size sweeps on the four
# 200M-key SOSD datasets (books, fb, osm, wiki), with the optimized Release build of the ARM64 SOSD port.
#
# Not run yet. Check first, then run:
#   DRY_RUN=1 bash sosd-arm64/scripts/run_sosd_4datasets_mac.sh      # checks prerequisites only, changes nothing
#   bash sosd-arm64/scripts/run_sosd_4datasets_mac.sh                # full run (expect several hours; plug in)
#   RUN_DIR=<path to runs/...-4datasets> bash ...                    # resume; finished steps are skipped
# Options: TRIALS (default 1), DATASETS (default "books_200M_uint64 fb_200M_uint64 osm_cellids_200M_uint64 wiki_ts_200M_uint64"),
#          LOOKUPS (default 10M; the lookup file must be <dataset>_equality_lookups_<LOOKUPS>), SOSD (default ~/Desktop/SOSD).
#
# What it gives each objective:
#   Objective 1: average lookup latency (ns) per index for each dataset (default configs). Throughput as single-thread
#                lookups/s = 1e9 / ns is an inference, not a measurement. NOT p99: SOSD reports a mean per repeat.
#   Objective 2: every SOSD size configuration (--pareto) with index size in bytes and latency, plus build times.
# Indexes: only those in the ARM64 port (RadixSpline, PGM-index, STX B+tree, RobinHash, binary search).
#          RMI, ALEX, TS, CHT, ART and FAST are compiled out on ARM64, so RMI is missing from this run.
#
# Data: the four 200M files and their lookup files come from SOSD's own scripts (scripts/download.sh, then the lookup
# generator, as in SOSD's README). This script does not download anything and never overwrites an earlier run.
set -euo pipefail
SOSD="${SOSD:-$HOME/Desktop/SOSD}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TRIALS="${TRIALS:-1}"
LOOKUPS="${LOOKUPS:-10M}"
DATASETS="${DATASETS:-books_200M_uint64 fb_200M_uint64 osm_cellids_200M_uint64 wiki_ts_200M_uint64}"
DRY_RUN="${DRY_RUN:-0}"

# ---------- prerequisites (always checked; DRY_RUN stops after this)
missing=0
echo "== prerequisites"
[ -d "$SOSD" ] || { echo "   MISSING: SOSD checkout at $SOSD (set SOSD=...)"; exit 1; }
for ds in $DATASETS; do
  d="$SOSD/data/$ds"; l="${d}_equality_lookups_${LOOKUPS}"
  if [ -f "$d" ]; then echo "   ok      $ds ($(du -h "$d" | cut -f1))"; else echo "   MISSING $d"; missing=1; fi
  if [ -f "$l" ]; then echo "   ok      $(basename "$l")"; else echo "   MISSING $l"; missing=1; fi
done
command -v cmake >/dev/null || { echo "   MISSING: cmake"; missing=1; }
mem_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
free_gb=$(df -g "$HERE" | awk 'NR==2 {print $4}')
echo "   memory: ${mem_gb} GB; free disk next to the results: ${free_gb} GB"
echo "   power: $(pmset -g batt | head -1)"
if [ "$missing" = 1 ]; then
  echo "Some inputs are missing. Get the 200M datasets with SOSD's scripts/download.sh and generate the"
  echo "<dataset>_equality_lookups_${LOOKUPS} files with SOSD's lookup generator (see SOSD's README), then rerun."
  exit 1
fi
if [ "$DRY_RUN" = 1 ]; then echo "== DRY_RUN=1: all inputs present; nothing was run."; exit 0; fi

# ---------- run
OUT="${RUN_DIR:-$HERE/runs/$(date +%Y%m%d-%H%M%S)-4datasets}"
mkdir -p "$OUT"
if [ ! -f "$OUT/machine.txt" ]; then
  {
    echo "date: $(date)"
    system_profiler SPHardwareDataType | grep -E "Model Name|Model Identifier|Chip|Total Number of Cores|Memory"
    sw_vers
    echo "compiler: $(c++ --version | head -1)"
    echo "sosd HEAD: $(git -C "$SOSD" rev-parse --short HEAD) ($(git -C "$SOSD" rev-parse --abbrev-ref HEAD))"
    sysctl hw.perflevel0.l1dcachesize hw.perflevel0.l2cachesize hw.cachelinesize
    echo "datasets: $DATASETS; lookups: $LOOKUPS; trials: $TRIALS"
  } > "$OUT/machine.txt"
  (cd "$SOSD/data" && shasum -a 256 $DATASETS) > "$OUT/datasets.sha256"
else
  echo "resumed: $(date)" >> "$OUT/machine.txt"
fi

echo "== Release build (incremental)"
cmake -S "$SOSD" -B "$SOSD/build-release" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$SOSD/build-release" -j 8 >/dev/null
FLAGS="$(grep -h '^CXX_FLAGS =' "$SOSD/build-release/CMakeFiles/benchmark.dir/flags.make")"
grep -q -- '-O3' <<<"$FLAGS" || { echo "ERROR: -O3 missing from build flags: $FLAGS"; exit 1; }
grep -q "build flags" "$OUT/machine.txt" || echo "build flags: $FLAGS" >> "$OUT/machine.txt"
B="$SOSD/build-release/benchmark"

run_csv () {   # $1 dataset, $2 step name, rest = extra args. SOSD appends to ./results/<dataset>_results_table.csv
  local ds=$1 step=$2; shift 2
  if [ -s "$step.csv" ]; then echo "   $step: done, skipped"; return; fi
  rm -f "results/${ds}_results_table.csv" 2>/dev/null || true
  mkdir -p results
  "$B" "$SOSD/data/$ds" "$SOSD/data/${ds}_equality_lookups_${LOOKUPS}" "$@" > "$step.log" 2>&1
  mv "results/${ds}_results_table.csv" "$step.csv"
  echo "   $step: ok ($(wc -l < "$step.csv") rows)"
}

for ds in $DATASETS; do
  for t in $(seq 1 "$TRIALS"); do
    echo "== $ds, trial $t / $TRIALS ($(date +%H:%M))"
    mkdir -p "$OUT/$ds/trial$t"; cd "$OUT/$ds/trial$t"
    [ -f power.txt ] || pmset -g batt | head -1 > power.txt
    run_csv "$ds" default --repeats 5 --csv
    run_csv "$ds" pareto  --repeats 5 --csv --pareto
    if [ -s build.csv ]; then
      echo "   build: done, skipped"
    else   # SOSD writes no CSV in --build mode; parse "RESULT: index,variant,build_ns,size_bytes"
      grep -q '^RESULT:' build.log 2>/dev/null || "$B" "$SOSD/data/$ds" "$SOSD/data/${ds}_equality_lookups_${LOOKUPS}" --build --pareto > build.log 2>&1
      sed -n 's/^RESULT: //p' build.log > build.csv
      echo "   build: ok ($(wc -l < build.csv) rows)"
    fi
    rmdir results 2>/dev/null || true
  done
  python3 "$HERE/scripts/summarize_runs.py" "$OUT/$ds"
done
echo "== done: $OUT"
