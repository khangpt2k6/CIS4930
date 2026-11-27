#!/usr/bin/env bash
cd ~/projects/SOSD
out=results/obj1_50M_r31
mkdir -p $out
for ds in books_50M_uint64 fb_50M_uint64 osm_cellids_50M_uint64 wiki_ts_50M_uint64; do
  for idx in BS RMI RS PGM BTree RobinHash; do
    echo "$(date +%T) start $ds $idx" >> $out/progress.log
    ./build/benchmark -r 31 --only $idx ./data/$ds ./data/${ds}_equality_lookups_1M > $out/${ds}_${idx}.txt 2>&1
    echo "$(date +%T) done $ds $idx" >> $out/progress.log
  done
done
echo "ALL DONE" >> $out/progress.log
