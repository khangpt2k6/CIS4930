#!/usr/bin/env bash
# WP3 run on Linux (tested in WSL2 on the AMD Ryzen AI 7 350 laptop). Never overwrites earlier runs.
#   bash wp3/scripts/run_wsl.sh [tag]        env: TRIALS=3 REPS=5 SIZES=100000,...  FORCE=1 allows battery power
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-ryzen-wsl}"; TRIALS="${TRIALS:-3}"; REPS="${REPS:-5}"
SIZES="${SIZES:-100000,1000000,10000000,50000000,100000000}"
RUN="$W/runs/$(date +%Y%m%d-%H%M%S)-$TAG"

power="unknown"
if command -v powershell.exe >/dev/null; then
  power=$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r' || true)
  case "$power" in 1) power="battery (BatteryStatus=1)";; 2) power="AC (BatteryStatus=2)";; *) power="BatteryStatus=$power";; esac
fi
if [[ "$power" == battery* && "${FORCE:-0}" != 1 ]]; then echo "on battery: plug in, or FORCE=1"; exit 1; fi

bash "$W/scripts/setup_deps.sh"
bash "$W/scripts/build.sh"
mkdir -p "$RUN"
{
  echo "date: $(date -Is)"
  echo "power: $power"
  echo "windows power plan: $(powercfg.exe /getactivescheme 2>/dev/null | tr -d '\r' || echo unknown)"
  echo "kernel: $(uname -r)"
  grep PRETTY_NAME /etc/os-release
  lscpu | grep -E 'Model name|CPU family|Model:|^CPU\(s\)|Thread|Core|L1d|L1i|L2|L3'
  echo "memory: $(free -g | awk '/Mem:/{print $2}') GiB visible to Linux"
  echo "transparent_hugepage: $(cat /sys/kernel/mm/transparent_hugepage/enabled)"
  echo "perf_event_paranoid: $(cat /proc/sys/kernel/perf_event_paranoid)"
  echo "compiler: $(g++ --version | head -1)"
  echo "flags: -O3 -march=native -std=c++17 -DNDEBUG"
  echo "deps: PGM-index c6fcf3d, RadixSpline ab96aa5, STX B+tree 0.9 (SOSD f52f4cb)"
  echo "source sha256: $(sha256sum "$W/src/wp3_perf.cpp" | cut -d' ' -f1)"
  echo "args: --pin --reps $REPS --sizes $SIZES, trials $TRIALS"
} > "$RUN/machine.txt"
cat "$RUN/machine.txt"

"$W/build/wp3_perf" --calibrate "$RUN/calibration.csv" --pin 2> "$RUN/calibration.log"
for t in $(seq 1 "$TRIALS"); do
  echo "trial $t"
  "$W/build/wp3_perf" "$RUN/trial$t.csv" --pin --reps "$REPS" --sizes "$SIZES" 2> "$RUN/trial$t.log"
done
echo "power at end: $(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r')" >> "$RUN/machine.txt"
echo "done: $RUN"
