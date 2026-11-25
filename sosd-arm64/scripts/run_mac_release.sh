#!/usr/bin/env bash
# Run (or resume) the lognormal_1M SOSD experiments on the Mac with an optimized Release build.
#   New run:    bash run_mac_release.sh
#   Resume:     RUN_DIR=<path to runs/...-release> bash run_mac_release.sh
# Resuming never deletes or overwrites a finished file: a step is skipped when its CSV exists.
# Fix vs v1: SOSD never writes a CSV in --build mode (PrintResult returns before PrintResultCSV),
# so build times are parsed from the RESULT lines of build.log instead.
set -euo pipefail
SOSD="${SOSD:-$HOME/Desktop/SOSD}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${RUN_DIR:-$HERE/runs/$(date +%Y%m%d-%H%M%S)-release}"
TRIALS="${TRIALS:-3}"
mkdir -p "$OUT"

if [ ! -f "$OUT/machine.txt" ]; then
  {
    echo "date: $(date)"
    system_profiler SPHardwareDataType | grep -E "Model Name|Model Identifier|Chip|Total Number of Cores|Memory"
    sw_vers
    echo "compiler: $(c++ --version | head -1)"
    echo "cmake: $(cmake --version | head -1)"
    echo "sosd HEAD: $(git -C "$SOSD" rev-parse --short HEAD) ($(git -C "$SOSD" rev-parse --abbrev-ref HEAD))"
    echo "fast64 HEAD: $(git -C "$SOSD/fast64" rev-parse --short HEAD)"
  } > "$OUT/machine.txt"
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
D="$SOSD/data/lognormal_1M_uint64"
L="${D}_equality_lookups_100K"

run_csv () {   # $1 = step name, rest = extra args; SOSD appends to ./results/<dataset>_results_table.csv
  local step=$1; shift
  if [ -s "$step.csv" ]; then echo "   $step: done, skipped"; return; fi
  rm -f results/lognormal_1M_uint64_results_table.csv 2>/dev/null || true
  mkdir -p results
  "$B" "$D" "$L" "$@" > "$step.log" 2>&1
  mv results/lognormal_1M_uint64_results_table.csv "$step.csv"
  echo "   $step: ok ($(wc -l < "$step.csv") rows)"
}

for t in $(seq 1 "$TRIALS"); do
  echo "== trial $t / $TRIALS"
  mkdir -p "$OUT/trial$t"; cd "$OUT/trial$t"
  [ -f power.txt ] || pmset -g batt | head -1 > power.txt
  run_csv default --repeats 5 --csv
  run_csv pareto  --repeats 5 --csv --pareto
  # build-time step: no CSV from SOSD, so parse "RESULT: index,variant,build_ns,size_bytes"
  if [ -s build.csv ]; then
    echo "   build: done, skipped"
  else
    grep -q '^RESULT:' build.log 2>/dev/null || "$B" "$D" "$L" --build --pareto > build.log 2>&1
    sed -n 's/^RESULT: //p' build.log > build.csv
    echo "   build: ok ($(wc -l < build.csv) rows)"
  fi
  rmdir results 2>/dev/null || true
done
python3 "$HERE/scripts/summarize_runs.py" "$OUT"
echo "== done: $OUT"
