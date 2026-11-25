#!/usr/bin/env python3
"""Validate a wp4/runs/<run> directory and write <run>/summary/wp4_summary.csv.
Checks per dataset: row set and count, operation counts, CSV vs log (ns/op, checksum), seconds vs ns/op,
checksum equality across indexes and across trials. Exits 1 on any failure."""
import csv, glob, os, re, sys, statistics as st
run = sys.argv[1]; fails = []
EXP = {("build", i, "") for i in ["ALEX", "BTree", "PGM", "DynPGM"]} | \
      {("range", i, L) for i in ["ALEX", "BTree", "PGM", "DynPGM"] for L in ["10", "100", "1000"]} | \
      {("mixed", i, f) for i in ["ALEX", "BTree", "DynPGM"] for f in ["0.0", "0.1", "0.5", "0.9"]}
RANGE_Q = {"10": 200000, "100": 200000, "1000": 20000}
out = []
for path in sorted(glob.glob(os.path.join(run, "*.csv"))):
    ds = os.path.basename(path)[:-4]
    rows = list(csv.DictReader(open(path)))
    log = [l for l in open(path[:-4] + ".log") if re.match(r"\s+(build|range|mixed)\s", l)]
    n = int(rows[0]["n"]); trials = sorted({int(r["trial"]) for r in rows})
    if len(rows) != len(EXP) * len(trials): fails.append(f"{ds}: {len(rows)} rows, expected {len(EXP)*len(trials)}")
    for t in trials:
        got = {(r["experiment"], r["index"], r["param"]) for r in rows if int(r["trial"]) == t}
        if got != EXP: fails.append(f"{ds} trial {t}: row set differs {EXP ^ got}")
    if len(log) != len(rows): fails.append(f"{ds}: {len(log)} log lines vs {len(rows)} rows")
    for r, l in zip(rows, log):
        p = l.split(); e, i = p[0], p[1]; prm = p[2] if p[2] != "trial" else ""
        ns = float(l.split("ns/op")[0].split()[-1]); cs = l.split("checksum")[1].split()[0]
        if (e, i, prm) != (r["experiment"], r["index"], r["param"]) or abs(ns - float(r["ns_per_op"])) > 0.01 or cs != r["checksum"]:
            fails.append(f"{ds}: csv/log mismatch {r} | {l.strip()}")
        ops = int(r["ops"]); exp_ops = n if e == "build" else RANGE_Q.get(r["param"]) if e == "range" else 2000000
        if ops != exp_ops: fails.append(f"{ds}: {e} {i} {r['param']} ops {ops} != {exp_ops}")
        if abs(float(r["seconds"]) * 1e9 / ops - float(r["ns_per_op"])) > 0.01 * float(r["ns_per_op"]) + 0.01:
            fails.append(f"{ds}: seconds vs ns/op inconsistent {r}")
    for e in ["range", "mixed"]:
        for prm in {r["param"] for r in rows if r["experiment"] == e}:
            cs = {r["checksum"] for r in rows if r["experiment"] == e and r["param"] == prm}
            if len(cs) != 1: fails.append(f"{ds}: {e} {prm} checksums differ across indexes/trials: {cs}")
    groups = {}
    for r in rows: groups.setdefault((r["experiment"], r["index"], r["param"]), []).append(float(r["ns_per_op"]))
    for (e, i, prm), v in groups.items():
        med = st.median(v)
        out.append([ds, n, e, i, prm, len(v), round(med, 3), round(min(v), 3), round(max(v), 3),
                    round(1e3 / med, 3), round(med * n / 1e6, 2) if e == "build" else ""])
    print(f"{ds}: n={n}, {len(rows)} rows, trials={trials}")
os.makedirs(os.path.join(run, "summary"), exist_ok=True)
with open(os.path.join(run, "summary", "wp4_summary.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["dataset", "n", "experiment", "index", "param", "trials", "median_ns_per_op", "min_ns", "max_ns",
                "median_mops_per_s", "build_ms"])
    w.writerows(out)
print("FAILED:\n  " + "\n  ".join(fails) if fails else "VALID: all checks passed")
sys.exit(1 if fails else 0)
