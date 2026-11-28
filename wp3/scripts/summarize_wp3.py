#!/usr/bin/env python3
"""Validate a WP3 run and write summary/wp3_summary.csv (standard library only).

  python wp3/scripts/summarize_wp3.py wp3/runs/<run>

Checks (exit 1 if any fails):
  - calibration: each pointer-chase footprint is served by the expected level (events count what they claim)
  - every trial has the same (dataset, n, index, config) rows, 9 configs per (dataset, n), and "done" in its log
  - no "MISMATCH" in any log; all indexes give the same checksum per (dataset, n), in every trial
  - no multiplexing (mux_min == 1)
  - key counts equal those of learned-index-bench/results/ryzen_ai7_350_x86.csv (same keys as Objective 5)
Summary: per row, the median over trials of every metric, the trial spread of ns (max / min), and derived columns.
"""
import csv, glob, os, statistics, sys

EVENTS = ["cycles", "instructions", "branches", "branch_misses", "fills_l2", "fills_l3", "fills_other_cache",
          "fills_dram", "dtlb_l1_miss", "dtlb_l2_miss"]
CONFIGS_PER_SIZE = 9
fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def main(run):
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.normpath(os.path.join(here, "..", ".."))

    cal = {int(r["footprint_bytes"]): r for r in csv.DictReader(open(os.path.join(run, "calibration.csv")))}
    f = lambda size, col: float(cal[size][col])
    check(f(32 << 10, "fills_l2") + f(32 << 10, "fills_l3") + f(32 << 10, "fills_dram") < 0.05,
          "calibration 32 KiB: no L1D fills (L1 hit)")
    check(f(512 << 10, "fills_l2") > 0.9, "calibration 512 KiB: >0.9 L2 fills per load")
    check(f(4 << 20, "fills_l3") > 0.8, "calibration 4 MiB: >0.8 L3 fills per load")
    check(f(1 << 30, "fills_dram") > 0.95 and f(1 << 30, "dtlb_l2_miss") > 0.9,
          "calibration 1 GiB: >0.95 DRAM fills and >0.9 page walks per load")
    check(all(float(r["mux_min"]) == 1.0 for r in cal.values()), "calibration: no multiplexing")

    trials = sorted(glob.glob(os.path.join(run, "trial*.csv")))
    check(len(trials) >= 1, f"{len(trials)} trial CSV(s)")
    data = {}  # key -> list of row dicts, one per trial
    keysets = []
    for t in trials:
        rows = list(csv.DictReader(open(t)))
        log = open(t[:-4] + ".log").read()
        check("MISMATCH" not in log, f"{os.path.basename(t)}: no MISMATCH in log")
        pairs = {(r["dataset"], r["n"]) for r in rows}
        check(log.count("done ") == len(pairs), f"{os.path.basename(t)}: log has 'done' for all {len(pairs)} sizes")
        ks = []
        for r in rows:
            k = (r["dataset"], int(r["n"]), r["index"], r["config"])
            ks.append(k)
            data.setdefault(k, []).append(r)
        keysets.append(sorted(ks))
        for p in pairs:
            sub = [r for r in rows if (r["dataset"], r["n"]) == p]
            check(len(sub) == CONFIGS_PER_SIZE and len({r["checksum"] for r in sub}) == 1,
                  f"{os.path.basename(t)} {p[0]} n={p[1]}: {len(sub)} configs, one shared checksum")
        check(all(float(r["mux_min"]) == 1.0 for r in rows), f"{os.path.basename(t)}: no multiplexing")
    check(all(k == keysets[0] for k in keysets), "all trials have the same row set")
    by_pair = {}
    for k, rs in data.items():
        by_pair.setdefault(k[:2], set()).update(r["checksum"] for r in rs)
    check(all(len(v) == 1 for v in by_pair.values()), "checksums identical across trials")

    ref = os.path.join(repo, "learned-index-bench", "results", "ryzen_ai7_350_x86.csv")
    ref_n = {(r["dataset"], int(r["n"])) for r in csv.DictReader(open(ref)) if r["index"] == "binary_search"}
    ours = {k[:2] for k in data}
    check(ours <= ref_n, f"key counts match Objective 5 Ryzen CSV ({len(ours & ref_n)}/{len(ours)})")

    out_rows = []
    for k in sorted(data, key=lambda k: (k[0] != "uniform", k[1], k[2], k[3])):
        rs = data[k]
        med = {c: statistics.median(float(r[c]) for r in rs) for c in ["ns"] + EVENTS}
        ns = [float(r["ns"]) for r in rs]
        row = {"dataset": k[0], "n": k[1], "index": k[2], "config": k[3], "bytes": rs[0]["bytes"],
               "trials": len(rs), "ns_spread": round(max(ns) / min(ns), 3)}
        row.update({c: round(v, 4) for c, v in med.items()})
        row["ghz"] = round(med["cycles"] / med["ns"], 3)
        row["ipc"] = round(med["instructions"] / med["cycles"], 3)
        row["l1d_fills"] = round(med["fills_l2"] + med["fills_l3"] + med["fills_other_cache"] + med["fills_dram"], 4)
        out_rows.append(row)

    # best RMI per (dataset, n) by median ns, as in Objective 5
    for p in {k[:2] for k in data}:
        rmis = [r for r in out_rows if (r["dataset"], r["n"]) == p and r["index"] == "rmi"]
        best = min(rmis, key=lambda r: r["ns"])
        for r in rmis:
            r["best_rmi"] = int(r is best)
    for r in out_rows:
        r.setdefault("best_rmi", "")

    os.makedirs(os.path.join(run, "summary"), exist_ok=True)
    path = os.path.join(run, "summary", "wp3_summary.csv")
    cols = ["dataset", "n", "index", "config", "bytes", "trials", "ns", "ns_spread", "ghz", "ipc"] + EVENTS + \
           ["l1d_fills", "best_rmi"]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(out_rows)
    print("wrote", path, f"({len(out_rows)} rows)")
    if fails:
        print(f"{len(fails)} check(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1])
