#!/usr/bin/env bash
# Build wp12_bench (Linux/WSL, x86-64). Uses the pinned index code that wp3/scripts/setup_deps.sh fetches.
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"; TP="$W/../wp3/third_party"
bash "$W/../wp3/scripts/setup_deps.sh" >/dev/null
CXX="${CXX:-g++}"; FLAGS="-O3 -march=native -std=c++17 -DNDEBUG"
mkdir -p "$W/build"
$CXX $FLAGS -w -I "$TP/PGM-index/include" -I "$TP/RadixSpline/include" -I "$TP/stx-btree-0.9/include" \
  "$W/src/wp12_bench.cpp" -o "$W/build/wp12_bench"
echo "built $W/build/wp12_bench with $CXX $FLAGS"
