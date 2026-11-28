#!/usr/bin/env python3
"""Validate a wp12 run and summarize it (stdlib only).

  python wp12/scripts/summarize_wp12.py wp12/runs/<run> [--copy report/figures]

Checks: every trial has the same rows, the same key counts, and every row verified all queries.
Writes <run>/summary/:
  wp12_summary.csv  every (dataset, index, config): median over trials of each metric, and the trial spread
  obj1_best.csv     per dataset and index: the configuration with the lowest median mean_ns
  obj2_budget.csv   per dataset, index-size budget and index: the fastest configuration within the budget
and prints the Objective 1 and 2 tables as markdown. --copy also writes the CSVs to <dir>/objective1 and objective2.
"""
import csv, glob, os, shutil, statistics as st, sys

LEARNED = ["rmi", "pgm", "radixspline"]
NONLEARNED = ["binary_search", "binary_search_branchless", "interpolation", "eytzinger", "btree"]
ORDER = NONLEARNED + LEARNED + ["oracle"]
NAMES = {"binary_search": "std::lower_bound", "binary_search_branchless": "Branchless", "interpolation": "Interpolation",
         "eytzinger": "Eytzinger", "btree": "B+tree", "rmi": "RMI", "pgm": "PGM", "radixspline": "RadixSpline",
         "oracle": "Oracle"}
DS = {"books_200M_uint64": "books", "fb_200M_uint64": "fb", "osm_cellids_200M_uint64": "osm", "wiki_ts_200M_uint64": "wiki"}
METRICS = ["build_ms", "mean_ns", "iso_mean_ns", "p50_ns", "p99_ns", "p999_ns", "log2err"]
BUDGETS = [("1 KB", 1e3), ("100 KB", 1e5), ("10 MB", 1e7), ("unlimited", float("inf"))]


def load(run):
    trials = sorted(glob.glob(os.path.join(run, "trial*.csv")))
    assert trials, "no trial*.csv in " + run
    per = []
    for t in trials:
        rows = list(csv.DictReader(open(t)))
        assert rows, t + " is empty"
        per.append({(r["dataset"], r["index"], r["config"]): r for r in rows})
    keys = set(per[0])
    for p, t in zip(per, trials):
        assert set(p) == keys, "%s has different rows than %s" % (t, trials[0])
        for k, r in p.items():
            assert r["checked"] == per[0][k]["checked"] and int(r["checked"]) > 0, (t, k)
            assert r["n"] == per[0][k]["n"] and r["bytes"] == per[0][k]["bytes"], (t, k)
    return trials, per


def summarize(per):
    out = []
    for k in per[0]:
        rs = [p[k] for p in per]
        row = {"dataset": k[0], "index": k[1], "config": k[2], "n": int(rs[0]["n"]), "bytes": int(rs[0]["bytes"]),
               "trials": len(rs)}
        for m in METRICS:
            row[m] = round(st.median(float(r[m]) for r in rs), 3)
        means = [float(r["mean_ns"]) for r in rs]
        row["mean_spread"] = round(max(means) / min(means), 3)
        p99s = [float(r["p99_ns"]) for r in rs]
        row["p99_spread"] = round(max(p99s) / min(p99s), 3) if min(p99s) > 0 else ""
        row["throughput_mops"] = round(1000.0 / row["mean_ns"], 3)
        out.append(row)
    out.sort(key=lambda r: (r["dataset"], ORDER.index(r["index"]), r["bytes"]))
    return out


def best(rows, ds, idx, budget=float("inf")):
    c = [r for r in rows if r["dataset"] == ds and r["index"] == idx and r["bytes"] <= budget]
    return min(c, key=lambda r: r["mean_ns"]) if c else None


def write(path, rows, cols):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)


def size(b):
    if b == 0: return "0"
    for u, d in (("GB", 1e9), ("MB", 1e6), ("KB", 1e3)):
        if b >= d: return "%.3g %s" % (b / d, u)
    return "%d B" % b


def main():
    run = sys.argv[1]
    copy = sys.argv[sys.argv.index("--copy") + 1] if "--copy" in sys.argv else None
    trials, per = load(run)
    rows = summarize(per)
    sd = os.path.join(run, "summary"); os.makedirs(sd, exist_ok=True)
    cols = ["dataset", "n", "index", "config", "bytes", "trials", "build_ms", "mean_ns", "mean_spread", "throughput_mops",
            "iso_mean_ns", "p50_ns", "p99_ns", "p99_spread", "p999_ns", "log2err"]
    write(os.path.join(sd, "wp12_summary.csv"), rows, cols)
    datasets = [d for d in DS if any(r["dataset"] == d for r in rows)]

    b1 = []
    for ds in datasets:
        for idx in ORDER:
            r = best(rows, ds, idx)
            if r: b1.append(r)
    write(os.path.join(sd, "obj1_best.csv"), b1, cols)

    b2 = []
    for ds in datasets:
        for label, lim in BUDGETS:
            for idx in ["binary_search", "btree"] + LEARNED:
                r = best(rows, ds, idx, lim)
                if r: b2.append(dict(r, budget=label))
    write(os.path.join(sd, "obj2_budget.csv"), b2, ["budget"] + cols)

    print("%d trials, %d rows per trial, all rows verified" % (len(trials), len(per[0])))
    print("\nObjective 1: best configuration per index, median of %d trials (mean ns | p99 ns)\n" % len(trials))
    print("| Index | " + " | ".join(DS[d] for d in datasets) + " |")
    print("|---|" + "---:|" * len(datasets))
    for idx in ORDER:
        cells = []
        for ds in datasets:
            r = best(rows, ds, idx)
            cells.append("%.0f / %.0f" % (r["mean_ns"], r["p99_ns"]) if r else "-")
        print("| %s | %s |" % (NAMES[idx], " | ".join(cells)))
    print("\nLearned vs non-learned (best of each family), mean ns:")
    for ds in datasets:
        cand_l = [r for r in (best(rows, ds, i) for i in LEARNED) if r]
        cand_n = [r for r in (best(rows, ds, i) for i in NONLEARNED) if r]
        bs, orc = best(rows, ds, "binary_search"), best(rows, ds, "oracle")
        if not (cand_l and cand_n and bs and orc):
            print("  %-5s (subset run: comparison skipped)" % DS[ds]); continue
        bl = min(cand_l, key=lambda r: r["mean_ns"])
        bn = min(cand_n, key=lambda r: r["mean_ns"])
        print("  %-5s best learned %s %s %.1f | best non-learned %s %s %.1f | vs non-learned %.2fx | vs std %.2fx | "
              "oracle %.1f (%.1fx below learned) | p99 learned %.0f vs non-learned %.0f" % (
                  DS[ds], bl["index"], bl["config"], bl["mean_ns"], bn["index"], bn["config"], bn["mean_ns"],
                  bn["mean_ns"] / bl["mean_ns"], bs["mean_ns"] / bl["mean_ns"], orc["mean_ns"],
                  bl["mean_ns"] / orc["mean_ns"], bl["p99_ns"], bn["p99_ns"]))
    print("\nObjective 2: fastest configuration within an index-size budget (mean ns, size)\n")
    for ds in datasets:
        print("%s:" % DS[ds])
        for label, lim in BUDGETS:
            cells = []
            for idx in ["btree"] + LEARNED:
                r = best(rows, ds, idx, lim)
                cells.append("%s %s" % (NAMES[idx], "%.0f ns (%s)" % (r["mean_ns"], size(r["bytes"])) if r else "-"))
            print("  <= %-9s %s" % (label, " | ".join(cells)))
    spreads = [r["mean_spread"] for r in rows]
    print("\nTrial spread of mean_ns (max/min): median %.3f, max %.3f" % (st.median(spreads), max(spreads)))
    if copy:
        for sub, files in (("objective1", ["obj1_best.csv", "wp12_summary.csv"]), ("objective2", ["obj2_budget.csv"])):
            os.makedirs(os.path.join(copy, sub), exist_ok=True)
            for f in files:
                shutil.copy(os.path.join(sd, f), os.path.join(copy, sub, f))
        print("copied summaries to", copy)


if __name__ == "__main__":
    main()
