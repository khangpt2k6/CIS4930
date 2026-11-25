#!/usr/bin/env python3
"""Validate and summarize a runs/<...>-release directory (stdlib only).

Per trial it checks that each lookup CSV row equals the median of the 5 repeats in the
matching .log, and that build.csv matches build.log. Then it writes <run>/summary/:
  lookup_pareto.csv  - every index/config: median over trials of the per-trial medians, min, max
  lookup_default.csv - same for the default-config run
  build.csv          - build time (ms) per index/config, median/min/max over trials
"""
import csv, os, sys, glob, statistics as st

RS_CFG = {v: "radix_bits=%d;max_error=32" % (7 + v) for v in range(1, 11)}
def config(idx, var):
    var = int(var)
    return {"RS": RS_CFG.get(var, ""), "PGM": "epsilon=%d" % var,
            "BTree": "stx_btree;size_scale=%d" % var}.get(idx, "")

def log_results(path):
    return [l.split("RESULT: ", 1)[1].strip().split(",") for l in open(path) if l.startswith("RESULT: ")]

def check_lookup(trial, step):
    rows = list(csv.reader(open(os.path.join(trial, step + ".csv"))))
    logs = log_results(os.path.join(trial, step + ".log"))
    assert len(rows) == len(logs), "%s/%s: %d csv rows vs %d log rows" % (trial, step, len(rows), len(logs))
    for r, l in zip(rows, logs):
        med = st.median(float(x) for x in l[2:-3])
        assert r[0] == l[0] and r[1] == l[1] and abs(float(r[2]) - med) < 1e-3 and r[3] == l[-3], (r, l)
    return rows

def agg(per_trial):  # {(idx,var): [(ns,size,build_ns), ...]}
    out = []
    for (idx, var), vals in per_trial.items():
        ns = [v[0] for v in vals]; med = st.median(ns)
        out.append([idx, var, config(idx, var), vals[0][1], len(ns), round(med, 2), round(min(ns), 2),
                    round(max(ns), 2), round(100 * (max(ns) - min(ns)) / med, 1)])
    return out

run = sys.argv[1]
trials = sorted(glob.glob(os.path.join(run, "trial*")))
os.makedirs(os.path.join(run, "summary"), exist_ok=True)
H = ["index", "variant", "config", "size_bytes", "trials", "median_ns", "min_ns", "max_ns", "spread_pct"]
for step in ["pareto", "default"]:
    acc = {}
    for t in trials:
        if not os.path.exists(os.path.join(t, step + ".csv")): continue
        for r in check_lookup(t, step):
            acc.setdefault((r[0], int(r[1])), []).append((float(r[2]), int(r[3]), int(r[4])))
    with open(os.path.join(run, "summary", "lookup_%s.csv" % step), "w", newline="") as f:
        w = csv.writer(f); w.writerow(H); w.writerows(agg(acc))
    print("%-8s %d configs, trials=%s" % (step, len(acc), sorted({len(v) for v in acc.values()})))
acc = {}
for t in trials:
    p = os.path.join(t, "build.csv")
    if not os.path.exists(p): continue
    rows = list(csv.reader(open(p)))
    assert rows == log_results(os.path.join(t, "build.log")), t + ": build.csv != build.log"
    for idx, var, ns, size in rows:
        acc.setdefault((idx, int(var)), []).append((int(ns) / 1e6, int(size)))
with open(os.path.join(run, "summary", "build.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["index", "variant", "config", "size_bytes", "trials", "median_build_ms", "min_ms", "max_ms"])
    for (idx, var), v in acc.items():
        ms = [x[0] for x in v]
        w.writerow([idx, var, config(idx, var), v[0][1], len(ms), round(st.median(ms), 3), round(min(ms), 3), round(max(ms), 3)])
print("build    %d configs" % len(acc))
for t in trials:
    p = os.path.join(t, "power.txt")
    print(os.path.basename(t), "power:", open(p).read().strip() if os.path.exists(p) else "not recorded")
