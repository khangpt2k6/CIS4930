#!/usr/bin/env bash
# Fetch pinned third-party index code into wp3/third_party (not committed).
#   PGM-index   github.com/gvinciguerra/PGM-index   @ c6fcf3d (same commit as WP4)
#   RadixSpline github.com/learnedsystems/RadixSpline @ ab96aa5
#   STX B+tree 0.9, from github.com/learnedsystems/SOSD @ f52f4cb (competitors/stx-btree-0.9), same code SOSD uses
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"; TP="$W/third_party"
mkdir -p "$TP"
if [ ! -d "$TP/PGM-index" ]; then
  git clone -q https://github.com/gvinciguerra/PGM-index.git "$TP/PGM-index"
  git -C "$TP/PGM-index" checkout -q c6fcf3d34e55eb0061b01e2f49dfcbdb711f1407
fi
if [ ! -d "$TP/RadixSpline" ]; then
  git clone -q https://github.com/learnedsystems/RadixSpline.git "$TP/RadixSpline"
  git -C "$TP/RadixSpline" checkout -q ab96aa59d429e7423beba2350bdcdf88952df282
fi
if [ ! -d "$TP/stx-btree-0.9" ]; then
  rm -rf "$TP/SOSD"
  git clone -q --filter=blob:none --sparse https://github.com/learnedsystems/SOSD.git "$TP/SOSD"
  git -C "$TP/SOSD" checkout -q f52f4cba01dfcd37f1574551fccef00198863b88
  git -C "$TP/SOSD" sparse-checkout set competitors/stx-btree-0.9
  cp -R "$TP/SOSD/competitors/stx-btree-0.9" "$TP/"
  rm -rf "$TP/SOSD"
fi
echo "deps: PGM $(git -C "$TP/PGM-index" rev-parse --short HEAD), RS $(git -C "$TP/RadixSpline" rev-parse --short HEAD), STX 0.9 (SOSD f52f4cb)"
