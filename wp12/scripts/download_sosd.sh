#!/usr/bin/env bash
# Download the four SOSD 200M-key uint64 datasets from Harvard Dataverse (doi:10.7910/DVN/JGVF9A) and check them.
#   bash wp12/scripts/download_sosd.sh [data_dir=~/sosd_data]
# The md5 values are the ones Dataverse lists for the compressed files. Needs curl, md5sum and zstd.
set -euo pipefail
D="${1:-$HOME/sosd_data}"; mkdir -p "$D"; cd "$D"
API="https://dataverse.harvard.edu/api/access/datafile/:persistentId?persistentId=doi:10.7910/DVN/JGVF9A"
get () {  # name, dataverse file id, md5 of the .zst
  local name=$1 id=$2 md5=$3
  if [ -s "$name" ]; then echo "$name: present"; return; fi
  if [ ! -s "$name.zst" ] || [ "$(md5sum "$name.zst" | cut -d' ' -f1)" != "$md5" ]; then
    curl -sSL --retry 5 -o "$name.zst" "$API/$id"
  fi
  [ "$(md5sum "$name.zst" | cut -d' ' -f1)" = "$md5" ] || { echo "$name.zst: md5 mismatch"; exit 1; }
  zstd -q -d -f "$name.zst" -o "$name" && rm -f "$name.zst"
  echo "$name: ok ($(stat -c %s "$name") bytes)"
}
get wiki_ts_200M_uint64     SVN8PI 6a2b17020959084ce2640177ee4afd5e
get fb_200M_uint64          EATHF7 fec241e8b021b198b0849fbd5564c05f
get books_200M_uint64       A6HDNT cd1f8bcb0dfd36f9ab08d160b887bf8a
get osm_cellids_200M_uint64 8FX9BV 42575cb58f24bb7ea0a623d422d4c9a6
md5sum *_200M_uint64 > md5_uncompressed.txt
cat md5_uncompressed.txt
