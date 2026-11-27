#!/usr/bin/env bash
# Build wp3_perf (Linux only: needs perf_event_open). Run setup_deps.sh first.
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"; TP="$W/third_party"
CXX="${CXX:-g++}"; FLAGS="-O3 -march=native -std=c++17 -DNDEBUG"
mkdir -p "$W/build"
$CXX $FLAGS -w -I "$TP/PGM-index/include" -I "$TP/RadixSpline/include" -I "$TP/stx-btree-0.9/include" \
  "$W/src/wp3_perf.cpp" -o "$W/build/wp3_perf"
echo "built $W/build/wp3_perf with $CXX $FLAGS"
