#!/usr/bin/env python3
"""Latency vs index size from <run>/summary/lookup_pareto.csv -> <run>/summary/pareto_latency_vs_size.png"""
import csv, sys, os
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
run = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(run, "summary", "lookup_pareto.csv"))))
S = {"RS": ("RadixSpline", "#257de0", "o"), "PGM": ("PGM-index", "#f47230", "s"), "BTree": ("STX B+tree", "#00b894", "^")}
fig, ax = plt.subplots(figsize=(7.2, 4.4), dpi=200)
for k, (name, c, m) in S.items():
    pts = sorted((int(r["size_bytes"]), float(r["median_ns"])) for r in rows if r["index"] == k)
    x, y = zip(*pts)
    ax.plot(x, y, color=c, lw=2, marker=m, ms=6, markeredgecolor="white", markeredgewidth=1.2, label=name)
    ax.annotate(name, (x[-1], y[-1]), xytext=(6, 0), textcoords="offset points", va="center", fontsize=9, color="#333333")
bs = next(float(r["median_ns"]) for r in rows if r["index"] == "BinarySearch")
rh = next(r for r in rows if r["index"] == "RobinHash")
ax.axhline(bs, color="#888888", lw=1.2, ls="--")
ax.text(150, bs + 1.2, "Binary search (no index): %.1f ns" % bs, fontsize=9, color="#555555")
ax.plot([int(rh["size_bytes"])], [float(rh["median_ns"])], marker="D", color="#555555", ms=6, ls="none")
ax.annotate("RobinHash %.1f ns" % float(rh["median_ns"]), (int(rh["size_bytes"]), float(rh["median_ns"])),
            xytext=(-6, 8), textcoords="offset points", ha="right", fontsize=9, color="#333333")
ax.set_xscale("log"); ax.set_ylim(0, 70)
ax.set_xlabel("Index size (bytes, log scale)", color="#444444"); ax.set_ylabel("Median lookup latency (ns)", color="#444444")
ax.grid(True, axis="y", color="#e6e6e6", lw=0.8); ax.grid(False, axis="x")
for s in ["top", "right"]: ax.spines[s].set_visible(False)
for s in ["left", "bottom"]: ax.spines[s].set_color("#bbbbbb")
ax.tick_params(colors="#555555", labelsize=9)
# direct labels replace the legend (3 series)
ax.set_title("lognormal 1M uint64, 50% unsuccessful lookups, Apple M6, -O3 (median of 3 trials)", fontsize=9.5, color="#333333", loc="left")
fig.tight_layout()
out = os.path.join(run, "summary", "pareto_latency_vs_size.png"); fig.savefig(out); print(out)
