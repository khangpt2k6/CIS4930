#!/usr/bin/env bash
# Objectives 1-2 run on Linux (tested in WSL2 on the AMD Ryzen AI 7 350 laptop). Never overwrites earlier runs.
#   bash wp12/scripts/run_wsl.sh [tag]     env: DATA=~/sosd_data TRIALS=3 REPS=5 FORCE=1 (allow battery)
# Downloads the four SOSD datasets first if they are missing (about 2.7 GB, 6.4 GB unpacked). Needs about 4.5 GB
# of free memory: the keys (1.6 GB) plus the Eytzinger copy (1.6 GB) at the peak.
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-ryzen-wsl}"; TRIALS="${TRIALS:-3}"; REPS="${REPS:-5}"; DATA="${DATA:-$HOME/sosd_data}"
RUN="$W/runs/$(date +%Y%m%d-%H%M%S)-$TAG"

batt () { powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r' || true; }
power=$(batt)
case "$power" in 1) power="battery (BatteryStatus=1)";; 2) power="AC (BatteryStatus=2)";; *) power="BatteryStatus=$power";; esac
if [[ "$power" == battery* && "${FORCE:-0}" != 1 ]]; then echo "on battery: plug in, or FORCE=1"; exit 1; fi

bash "$W/scripts/download_sosd.sh" "$DATA"
bash "$W/scripts/build.sh"
mkdir -p "$RUN"
{
  echo "date: $(date -Is)"
  echo "power: $power"
  echo "windows power plan: $(powercfg.exe /getactivescheme 2>/dev/null | tr -d '\r' || echo unknown)"
  echo "windows free memory at start: $(powershell.exe -NoProfile -Command '[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2)' 2>/dev/null | tr -d '\r') GB"
  echo "kernel: $(uname -r)"
  grep PRETTY_NAME /etc/os-release
  lscpu | grep -E 'Model name|CPU family|Model:|^CPU\(s\)|Thread|Core|L1d|L1i|L2|L3'
  echo "memory: $(free -g | awk '/Mem:/{print $2}') GiB visible to Linux"
  echo "transparent_hugepage: $(cat /sys/kernel/mm/transparent_hugepage/enabled)"
  echo "compiler: $(g++ --version | head -1)"
  echo "flags: -O3 -march=native -std=c++17 -DNDEBUG"
  echo "deps: PGM-index c6fcf3d, RadixSpline ab96aa5, STX B+tree 0.9 (SOSD f52f4cb)"
  echo "source sha256: $(sha256sum "$W/src/wp12_bench.cpp" | cut -d' ' -f1)"
  echo "data md5 (uncompressed):"; sed 's/^/  /' "$DATA/md5_uncompressed.txt"
  echo "args: --pin --reps $REPS, trials $TRIALS"
} > "$RUN/machine.txt"
cat "$RUN/machine.txt"

for t in $(seq 1 "$TRIALS"); do
  echo "trial $t"
  "$W/build/wp12_bench" "$RUN/trial$t.csv" --data "$DATA" --pin --reps "$REPS" 2> "$RUN/trial$t.log"
done
echo "power at end: $(batt)" >> "$RUN/machine.txt"
echo "done: $RUN"
