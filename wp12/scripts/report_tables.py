#!/usr/bin/env python3
"""Print the report's SOSD tables (Tables 3, 4 and 6) as Markdown from <run>/summary/wp12_summary.csv.

  python wp12/scripts/report_tables.py wp12/runs/<run>

Every number in report Sections 5 to 8 that comes from the SOSD run is printed here, so the text can be checked
against it. N* (Table 6) = (build ms per key of the learned index - that of the baseline) / (mean ns saved per lookup).
"""
import csv, os, statistics as st, sys

DS = [("books_200M_uint64", "books"), ("fb_200M_uint64", "fb"), ("osm_cellids_200M_uint64", "osm"),
      ("wiki_ts_200M_uint64", "wiki")]
LEARNED = ["rmi", "pgm", "radixspline"]
ZERO = ["binary_search", "binary_search_branchless", "interpolation"]
NONLEARNED = ZERO + ["eytzinger", "btree"]
NAME = {"binary_search": "std::lower_bound", "binary_search_branchless": "branchless", "interpolation": "interpolation",
        "eytzinger": "Eytzinger", "btree": "B+tree", "rmi": "RMI", "pgm": "PGM", "radixspline": "RadixSpline",
        "oracle": "oracle"}


def size(b):
    for u, d in (("GB", 1e9), ("MB", 1e6), ("KB", 1e3)):
        if b >= d:
            v = b / d
            return ("%.0f %s" if v >= 10 else "%.1f %s") % (v, u)
    return "%d B" % b


def cfg(r):
    c = r["config"]
    if r["index"] == "rmi": return "%s leaves" % c.split("=")[1]
    if r["index"] == "pgm": return "ε = %s" % c.split("=")[1]
    if r["index"] == "radixspline": b, e = c.replace("bits=", "").split(";err="); return "%s bits, error %s" % (b, e)
    if r["index"] == "btree": return "every %s" % c.split("=")[1]
    return ""


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    rows = list(csv.DictReader(open(os.path.join(sys.argv[1], "summary", "wp12_summary.csv"))))
    for r in rows:
        for k in ("bytes", "build_ms", "mean_ns", "p50_ns", "p99_ns", "p999_ns", "iso_mean_ns", "log2err", "n",
                  "mean_spread"):
            r[k] = float(r[k])
    best = lambda ds, idxs, lim=float("inf"): min((r for r in rows if r["dataset"] == ds and r["index"] in idxs
                                                   and r["bytes"] <= lim), key=lambda r: r["mean_ns"], default=None)
    print("Table 3 (mean ns, median of trials)\n")
    print("| Dataset | `std::lower_bound` | Best tuned non-learned | Best learned (size) | Learned vs tuned | Learned vs `std::lower_bound` | Oracle |")
    print("|---|---:|---|---|---:|---:|---:|")
    for ds, lab in DS:
        s, n, l, o = best(ds, ["binary_search"]), best(ds, NONLEARNED), best(ds, LEARNED), best(ds, ["oracle"])
        print("| %s | %.0f | %s %.0f | %s, %s: **%.0f** (%s) | %.2f× | %.1f× | %.0f |" % (
            lab, s["mean_ns"], NAME[n["index"]], n["mean_ns"], NAME[l["index"]], cfg(l), l["mean_ns"], size(l["bytes"]),
            n["mean_ns"] / l["mean_ns"], s["mean_ns"] / l["mean_ns"], o["mean_ns"]))
    print("\nThroughput of best learned (M lookups/s):", ", ".join("%s %.1f" % (lab, 1000 / best(ds, LEARNED)["mean_ns"]) for ds, lab in DS))
    print("Learned / oracle:", ", ".join("%s %.0f×" % (lab, best(ds, LEARNED)["mean_ns"] / best(ds, ["oracle"])["mean_ns"]) for ds, lab in DS))

    print("\nTable 4: equal budget (index <= 10 MB; non-learned may also use the 0-byte searches)\n")
    print("| Dataset | Best non-learned, at most 10 MB | Best learned, at most 10 MB | Learned faster by |")
    print("|---|---|---|---:|")
    for ds, lab in DS:
        n, l = best(ds, NONLEARNED, 1e7), best(ds, LEARNED, 1e7)
        print("| %s | %s %s: %.0f ns (%s) | %s %s: %.0f ns (%s) | %.1f× |" % (lab, NAME[n["index"]], cfg(n), n["mean_ns"], size(n["bytes"]),
              NAME[l["index"]], cfg(l), l["mean_ns"], size(l["bytes"]), n["mean_ns"] / l["mean_ns"]))
    for lim in (1e5, 1e6, 1e8):
        print("budget %s:" % size(lim), "; ".join("%s learned %s %.0f vs non %s %.0f" % (lab, NAME[best(ds, LEARNED, lim)["index"]] if best(ds, LEARNED, lim) else "-",
              best(ds, LEARNED, lim)["mean_ns"] if best(ds, LEARNED, lim) else 0, NAME[best(ds, NONLEARNED, lim)["index"]], best(ds, NONLEARNED, lim)["mean_ns"]) for ds, lab in DS))

    print("\nTails: p50 / p99 / p99.9 of the best config per index (ns)")
    for ds, lab in DS:
        print(" ", lab, "; ".join("%s %.0f/%.0f/%.0f" % (NAME[i], best(ds, [i])["p50_ns"], best(ds, [i])["p99_ns"], best(ds, [i])["p999_ns"])
                                 for i in ["binary_search", "eytzinger", "btree", "rmi", "pgm", "radixspline", "oracle"]))
    print("\nOverlap: isolated mean / closed-loop mean (best config)")
    for ds, lab in DS:
        print(" ", lab, "; ".join("%s %.0f/%.0f=%.1f×" % (NAME[i], best(ds, [i])["iso_mean_ns"], best(ds, [i])["mean_ns"], best(ds, [i])["iso_mean_ns"] / best(ds, [i])["mean_ns"])
                                 for i in ["binary_search", "eytzinger", "btree", "rmi", "pgm", "radixspline", "oracle"]))
    print("  learned lead over best non-learned, closed loop vs isolated:", "; ".join(
        "%s %.2f× vs %.2f×" % (lab, best(ds, NONLEARNED)["mean_ns"] / best(ds, LEARNED)["mean_ns"],
                               min(r["iso_mean_ns"] for r in rows if r["dataset"] == ds and r["index"] in NONLEARNED) /
                               min(r["iso_mean_ns"] for r in rows if r["dataset"] == ds and r["index"] in LEARNED)) for ds, lab in DS))

    print("\nRMI windows (avg log2 err) per dataset, best config:", ", ".join("%s %.1f" % (lab, best(ds, ["rmi"])["log2err"]) for ds, lab in DS))
    print("Build ms of best config:", "; ".join("%s: %s" % (lab, ", ".join("%s %.0f" % (NAME[i], best(ds, [i])["build_ms"]) for i in ["eytzinger", "btree", "rmi", "pgm", "radixspline"])) for ds, lab in DS))

    print("\nTable 6: N* (lookups per key)\n")
    print("| Dataset | Learned index | vs `std::lower_bound` | vs best B+tree | vs Eytzinger |")
    print("|---|---|---:|---:|---:|")
    for ds, lab in DS:
        l = best(ds, LEARNED)
        n = l["n"]
        cells = []
        for b in (best(ds, ["binary_search"]), best(ds, ["btree"]), best(ds, ["eytzinger"])):
            saved = b["mean_ns"] - l["mean_ns"]
            extra = (l["build_ms"] - b["build_ms"]) * 1e6 / n
            cells.append("%.3f" % (extra / saved) if saved > 0 else "never")
        print("| %s | %s, %s | %s |" % (lab, NAME[l["index"]], cfg(l), " | ".join(cells)))
    sp = [r["mean_spread"] for r in rows]
    print("\nTrial spread of the mean (max/min over trials): median %.3f, max %.3f" % (st.median(sp), max(sp)))


if __name__ == "__main__":
    main()
