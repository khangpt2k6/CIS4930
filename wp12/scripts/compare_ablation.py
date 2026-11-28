#!/usr/bin/env python3
"""fb outlier ablation: compare two wp12 runs (keys as-is vs keys above a bound removed), each summarized first.

  python wp12/scripts/compare_ablation.py <run_kept> <run_removed> [--copy report/figures/objective1/wp12_fb_outliers.csv]

Prints, per index, the best setting's mean and p99 in both runs, and the RMI's average search window. Both runs must
come from the same session and power state; only ratios within this pair are meaningful.
"""
import csv, os, sys

NAME = {"binary_search": "std::lower_bound", "rmi": "RMI", "pgm": "PGM-index", "radixspline": "RadixSpline"}


def load(run):
    rows = list(csv.DictReader(open(os.path.join(run, "summary", "wp12_summary.csv"))))
    for r in rows:
        for k in ("mean_ns", "p99_ns", "log2err", "bytes", "n"):
            r[k] = float(r[k])
    return rows


def best(rows, idx):
    return min((r for r in rows if r["index"] == idx), key=lambda r: r["mean_ns"])


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    kept, removed = load(sys.argv[1]), load(sys.argv[2])
    print("keys: %d as-is, %d after removal" % (kept[0]["n"], removed[0]["n"]))
    print("| Index | keys as-is: mean / p99 ns | outliers removed: mean / p99 ns | Mean speedup |")
    print("|---|---:|---:|---:|")
    for idx in NAME:
        a, b = best(kept, idx), best(removed, idx)
        print("| %s | %.0f / %.0f | %.0f / %.0f | %.2f× |" % (NAME[idx], a["mean_ns"], a["p99_ns"], b["mean_ns"], b["p99_ns"],
                                                         a["mean_ns"] / b["mean_ns"]))
    for name, rows in (("as-is", kept), ("removed", removed)):
        print("RMI windows (%s): %s" % (name, ", ".join("%s: 2^%.1f, %.0f ns" % (r["config"], r["log2err"], r["mean_ns"])
                                                         for r in rows if r["index"] == "rmi")))
    fastest = min(removed, key=lambda r: r["mean_ns"])
    print("fastest index after removal: %s %s %.0f ns" % (fastest["index"], fastest["config"], fastest["mean_ns"]))
    if "--copy" in sys.argv:
        out = sys.argv[sys.argv.index("--copy") + 1]
        cols = ["condition", "dataset", "n", "index", "config", "bytes", "mean_ns", "p99_ns", "log2err"]
        with open(out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for name, rows in (("kept", kept), ("removed", removed)):
                for r in rows:
                    w.writerow(dict(r, condition=name))
        print("wrote", out)


if __name__ == "__main__":
    main()
