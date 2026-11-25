#!/usr/bin/env python3
"""Split the appended SOSD results table into one clean CSV per run.

SOSD (--csv) appends one row per index to results/<dataset>_results_table.csv:
  index, variant, median_ns_per_lookup (median of --repeats), size_bytes, build_ns, searcher, dataset
The raw file holds three runs in order (verified by row order and the RS config change
in commit a201621):
  rows 1-5   : default run, 5 indexes (RS row uses the OLD custom config, see README)
  rows 6-15  : --only RS  --pareto
  rows 16-25 : --only PGM --pareto
Usage: python3 split_results.py <raw_results_table.csv> <out_dir>
"""
import csv, sys, os

# RS configs for custom datasets, from competitors/rs.h after commit a201621:
# variant v -> (radix_bits, max_error) = configs[v-1]
RS_CFG = {v: (7 + v, 32) for v in range(1, 11)}
HDR = ["index", "variant", "config", "median_ns_per_lookup", "size_bytes",
       "size_kib", "build_ms", "searcher", "dataset", "note"]

def cfg(idx, var):
    if idx == "RS": return "radix_bits=%d;max_error=%d" % RS_CFG[var]
    if idx == "PGM": return "epsilon=%d" % var
    if idx == "BTree": return "stx_btree;size_scale=%d" % var
    return ""

def row(r, note=""):
    idx, var, ns, size, build, srch, ds = r
    var = int(var); size = int(size)
    return [idx, var, cfg(idx, var), float(ns), size, round(size / 1024, 2),
            round(int(build) / 1e6, 3), srch, ds, note]

raw, out = sys.argv[1], sys.argv[2]
rows = list(csv.reader(open(raw)))
assert len(rows) == 25, "expected 25 rows, got %d" % len(rows)
runs = {
  "lognormal_1M_five_index.csv": rows[0:5],
  "lognormal_1M_rs_pareto.csv": rows[5:15],
  "lognormal_1M_pgm_pareto.csv": rows[15:25],
}
os.makedirs(out, exist_ok=True)
for name, rs in runs.items():
    with open(os.path.join(out, name), "w", newline="") as f:
        w = csv.writer(f); w.writerow(HDR)
        for r in rs:
            note = ""
            if name.startswith("lognormal_1M_five") and r[0] == "RS":
                note = "pre-a201621 RS config; not comparable to RS pareto rows"
                w.writerow([r[0], int(r[1]), "unknown (old config)", float(r[2]), int(r[3]),
                            round(int(r[3]) / 1024, 2), round(int(r[4]) / 1e6, 3), r[5], r[6], note])
                continue
            w.writerow(row(r, note))
    print("wrote", name, len(rs), "rows")
