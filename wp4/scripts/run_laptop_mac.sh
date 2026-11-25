#!/usr/bin/env bash
# One command for the Apple M6 Mac experiments (macOS, native):
#   Part A  learned-index-bench (the mandatory per-laptop run) -> learned-index-bench/results/apple_m6_arm.csv
#   Part B  WP4: ALEX vs B+tree vs PGM (inserts, range scans, build) on reproducible 10M-key datasets
# Never overwrites finished results: Part A is skipped if its CSV exists; Part B writes a new runs/<timestamp>/.
# Plug in the charger and close other apps first. Expect about 10 minutes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; W="$ROOT/wp4"; LIB="$ROOT/learned-index-bench"
[ "$(uname -s)" = Darwin ] || { echo "run this on the Mac"; exit 1; }
pmset -g batt | head -1 | grep -q "AC Power" || echo "WARNING: on battery power; results will be marked as such"
CXX="${CXX:-c++}"; FLAGS="-O3 -mcpu=native -std=c++17"

meta () {
  echo "date: $(date)"
  system_profiler SPHardwareDataType | grep -E "Model Name|Model Identifier|Chip|Total Number of Cores|Memory"
  sw_vers | tr '\n' ' '; echo
  echo "compiler: $($CXX --version | head -1)"
  echo "flags: $FLAGS"
  for k in hw.perflevel0.l1dcachesize hw.perflevel0.l2cachesize hw.perflevel1.l2cachesize hw.cachelinesize; do
    echo "$k: $(sysctl -n $k 2>/dev/null || echo NA)"; done
  echo "power: $(pmset -g batt | head -1)"
}

echo "== Part A: learned-index-bench"
A_CSV="$LIB/results/apple_m6_arm.csv"
if [ -s "$A_CSV" ]; then echo "   $A_CSV exists, skipped"; else
  mkdir -p "$LIB/build"
  $CXX $FLAGS "$LIB/bench.cpp" -o "$LIB/build/bench"
  meta > "$LIB/results/apple_m6_arm_machine.txt"
  "$LIB/build/bench" "$A_CSV.partial" --pin | tee "$LIB/results/apple_m6_arm.log"
  mv "$A_CSV.partial" "$A_CSV"; echo "   wrote $A_CSV"
fi

echo "== Part B: WP4"
bash "$W/scripts/setup_deps.sh"
TP="$W/third_party"; mkdir -p "$W/build" "$W/data"
$CXX -O3 -std=c++17 "$W/src/gen_data.cpp" -o "$W/build/gen_data"
$CXX $FLAGS -w -I "$TP/ALEX/src/core" -I "$TP/PGM-index/include" -I "$TP/stx-btree-0.9/include" \
     "$W/src/wp4_bench.cpp" -o "$W/build/wp4_bench"
# reproducible datasets: fixed seeds; sha256 recorded so other machines can confirm bit-identical keys
[ -s "$W/data/uniform_10M_uint64" ]   || "$W/build/gen_data" uniform   10000000 1 "$W/data/uniform_10M_uint64"
[ -s "$W/data/lognormal_10M_uint64" ] || "$W/build/gen_data" lognormal 10000000 2 "$W/data/lognormal_10M_uint64"
OUT="$W/runs/$(date +%Y%m%d-%H%M%S)-m6"; mkdir -p "$OUT"
meta > "$OUT/machine.txt"
( cd "$W/data" && shasum -a 256 *_uint64 ) > "$OUT/datasets.sha256"
echo "ALEX $(git -C "$TP/ALEX" rev-parse --short HEAD) patched; PGM $(git -C "$TP/PGM-index" rev-parse --short HEAD)" >> "$OUT/machine.txt"
for f in "$W"/data/*_uint64; do
  name="$(basename "$f")"
  echo "   dataset $name"
  "$W/build/wp4_bench" "$f" "$name" "$OUT/$name.csv" --trials 3 --max_keys 10000000 --ops 2000000 2> "$OUT/$name.log"
  tail -1 "$OUT/$name.log"
done
echo "== done. Part A: $A_CSV   Part B: $OUT"
