#!/usr/bin/env bash
# Fetch pinned third-party index code into wp4/third_party (not committed).
#   ALEX       github.com/microsoft/ALEX        @ 4370da6  + patches/alex-0001 (ARM64 portable intrinsics)
#   PGM-index  github.com/gvinciguerra/PGM-index @ c6fcf3d
#   STX B+tree 0.9, copied from the team's SOSD checkout ($SOSD/competitors/stx-btree-0.9)
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"; TP="$W/third_party"; SOSD="${SOSD:-$HOME/Desktop/SOSD}"
mkdir -p "$TP"
if [ ! -d "$TP/ALEX" ]; then
  git clone -q https://github.com/microsoft/ALEX.git "$TP/ALEX"
  git -C "$TP/ALEX" checkout -q 4370da6aa8b509fdc9b0d2c49faa0624b0078589
  git -C "$TP/ALEX" -c user.name=wp4 -c user.email=wp4@local am -q "$W/patches/alex-0001-portable-intrinsics-arm64.patch"
fi
if [ ! -d "$TP/PGM-index" ]; then
  git clone -q https://github.com/gvinciguerra/PGM-index.git "$TP/PGM-index"
  git -C "$TP/PGM-index" checkout -q c6fcf3d34e55eb0061b01e2f49dfcbdb711f1407
fi
if [ ! -d "$TP/stx-btree-0.9" ]; then cp -R "$SOSD/competitors/stx-btree-0.9" "$TP/"; fi
echo "deps: ALEX $(git -C "$TP/ALEX" rev-parse --short HEAD) (patched), PGM $(git -C "$TP/PGM-index" rev-parse --short HEAD), STX 0.9"
