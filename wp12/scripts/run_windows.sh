#!/usr/bin/env bash
# Objectives 1-2 run natively on Windows (Git Bash + MinGW g++), pinned like learned-index-bench --pin.
#   bash wp12/scripts/run_windows.sh [tag]    env: DATA=C:/Users/<you>/sosd_data TRIALS=3 REPS=5 FORCE=1 (allow battery)
#   EXTRA="..." passes more flags to wp12_bench, e.g. the fb outlier ablation:
#   TAG=fb-outliers EXTRA="--datasets fb_200M_uint64 --only binary_search,rmi,pgm,radixspline --max-key 1099511627776" bash wp12/scripts/run_windows.sh
# Get the data first with download_sosd.sh (it needs zstd; run it in WSL or any Linux shell) and copy the four
# *_200M_uint64 files into DATA. Keep DATA outside OneDrive. Needs about 4 GB of free memory.
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"; TP="$W/../wp3/third_party"
TAG="${1:-${TAG:-ryzen-win}}"; EXTRA="${EXTRA:-}"; TRIALS="${TRIALS:-3}"; REPS="${REPS:-5}"; DATA="${DATA:-C:/Users/$USERNAME/sosd_data}"
RUN="$W/runs/$(date +%Y%m%d-%H%M%S)-$TAG"
ps () { powershell.exe -NoProfile -Command "$1" 2>/dev/null | tr -d '\r'; }
power=$(ps '(Get-CimInstance Win32_Battery).BatteryStatus')
case "$power" in 1) power="battery";; 2) power="AC";; *) power="BatteryStatus=$power";; esac
if [[ "$power" == battery && "${FORCE:-0}" != 1 ]]; then echo "on battery: plug in, or FORCE=1"; exit 1; fi
for f in books_200M_uint64 fb_200M_uint64 osm_cellids_200M_uint64 wiki_ts_200M_uint64; do
  [ -s "$DATA/$f" ] || { echo "missing $DATA/$f (run download_sosd.sh)"; exit 1; }
done

[ -d "$TP/stx-btree-0.9" ] || bash "$W/../wp3/scripts/setup_deps.sh"
FLAGS="-O3 -march=native -std=c++17 -DNDEBUG"
mkdir -p "$W/build" "$RUN"
g++ $FLAGS -w -I "$TP/PGM-index/include" -I "$TP/RadixSpline/include" -I "$TP/stx-btree-0.9/include" \
  "$W/src/wp12_bench.cpp" -o "$W/build/wp12_bench.exe" -lpsapi
{
  echo "date: $(date '+%Y-%m-%d %H:%M %Z')"
  echo "cpu: $(ps '(Get-CimInstance Win32_Processor).Name') (8 cores: 4 Zen 5 + 4 Zen 5c; L2 1 MB per core; L3 16 MB)"
  echo "memory: $(ps '[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)') GB; free at start: $(ps '[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2)') GB"
  echo "os: $(ps '(Get-CimInstance Win32_OperatingSystem).Caption') $(ps '(Get-CimInstance Win32_OperatingSystem).Version')"
  echo "power: $power; plan: $(ps 'powercfg /getactivescheme')"
  echo "compiler: $(g++ --version | head -1)"
  echo "flags: $FLAGS"
  echo "deps: PGM-index c6fcf3d, RadixSpline ab96aa5, STX B+tree 0.9 (SOSD f52f4cb)"
  echo "source sha256: $(sha256sum "$W/src/wp12_bench.cpp" | cut -d' ' -f1)"
  echo "pinning: logical CPU 0, high priority class (--pin)"
  echo "data: SOSD 200M uint64 from Harvard Dataverse doi:10.7910/DVN/JGVF9A; md5 of the unpacked files:"
  sed 's/^/  /' "$DATA/md5_uncompressed.txt" 2>/dev/null || echo "  (md5_uncompressed.txt not found)"
  echo "args: --pin --reps $REPS $EXTRA, trials $TRIALS"
  echo "note: other applications (browser, editor) were open during the run"
} > "$RUN/machine.txt"
cat "$RUN/machine.txt"
for t in $(seq 1 "$TRIALS"); do
  echo "trial $t ($(date +%H:%M))"
  "$W/build/wp12_bench.exe" "$RUN/trial$t.csv" --data "$DATA" --pin --reps "$REPS" $EXTRA 2> "$RUN/trial$t.log"
done
echo "power at end: $(ps '(Get-CimInstance Win32_Battery).BatteryStatus')" >> "$RUN/machine.txt"
echo "done: $RUN"
