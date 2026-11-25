#!/usr/bin/env python3
"""Plots from <run>/summary/wp4_summary.csv -> <run>/summary/{wp4_mixed,wp4_range,wp4_build}.png"""
import csv, os, sys
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
run = sys.argv[1]; S = os.path.join(run, "summary")
rows = list(csv.DictReader(open(os.path.join(S, "wp4_summary.csv"))))
NAMES = {"books_800M_uint64": "books (real, 10M sampled)", "osm_cellids_800M_uint64": "osm (real, 10M sampled)",
         "uniform_10M_uint64": "uniform 10M", "lognormal_10M_uint64": "lognormal 10M"}
present = {r["dataset"] for r in rows}
DS = [(d, t) for d, t in NAMES.items() if d in present]
ST = {"ALEX": ("ALEX", "#257de0", "o"), "BTree": ("STX B+tree", "#00b894", "^"),
      "PGM": ("PGM (static)", "#f47230", "s"), "DynPGM": ("Dynamic PGM", "#f2a600", "D")}
SUB = "Apple M6, -O3, median of 3 trials"
def style(ax):
    ax.grid(True, axis="y", color="#e6e6e6", lw=0.8)
    for s in ["top", "right"]: ax.spines[s].set_visible(False)
    for s in ["left", "bottom"]: ax.spines[s].set_color("#bbbbbb")
    ax.tick_params(colors="#555555", labelsize=9)
def spread(vals, gap):
    """Label positions: same order as vals, nudged apart so neighbours are >= gap apart."""
    idx = sorted(range(len(vals)), key=lambda k: vals[k]); out = list(vals)
    for a, b in zip(idx, idx[1:]):
        if out[b] - out[a] < gap: out[b] = out[a] + gap
    return out
def get(ds, e, i, p): return next(r for r in rows if r["dataset"] == ds and r["experiment"] == e and r["index"] == i and r["param"] == p)

# mixed: throughput vs insert fraction
nc = len(DS); fig, axs = plt.subplots(1, nc, figsize=(4.5 * nc, 3.8), dpi=200, sharey=True)
fr = ["0.0", "0.1", "0.5", "0.9"]
ymax = 5 * (int(max(float(r["median_mops_per_s"]) for r in rows if r["experiment"] == "mixed") * 1.08 / 5) + 1)
for ax, (ds, title) in zip(axs, DS):
    ends = {}
    for i in ["ALEX", "DynPGM", "BTree"]:
        name, c, m = ST[i]; y = [float(get(ds, "mixed", i, f)["median_mops_per_s"]) for f in fr]
        ax.plot([0, 10, 50, 90], y, color=c, marker=m, lw=2, ms=6, markeredgecolor="white"); ends[i] = y[-1]
    keys = list(ends); ly = spread([ends[k] for k in keys], 0.06 * ymax)
    for k, yl in zip(keys, ly):
        ax.annotate(ST[k][0], (90, ends[k]), xytext=(95, yl), textcoords="data", va="center", fontsize=8.5, color="#333333")
    ax.set_title(title, fontsize=10, color="#333333", loc="left"); ax.set_xticks([0, 10, 50, 90]); ax.set_xlim(-5, 125)
    ax.set_xlabel("Inserts (% of operations)", color="#444444"); style(ax); ax.set_ylim(0, ymax)
axs[0].set_ylabel("Throughput (M ops/s)", color="#444444")
fig.suptitle("Mixed lookups + inserts, 2M ops after bulk-loading half the keys (" + SUB + ")", fontsize=9.5, color="#333333", x=0.01, ha="left")
fig.tight_layout(); fig.savefig(os.path.join(S, "wp4_mixed.png")); plt.close(fig)

# range: ns per query vs scan length
fig, axs = plt.subplots(1, nc, figsize=(4.5 * nc, 3.8), dpi=200, sharey=True)
import math
rv = [float(r["median_ns_per_op"]) for r in rows if r["experiment"] == "range"]
lo, hi = math.log10(min(rv)) - 0.1, math.log10(max(rv)) + 0.15
for ax, (ds, title) in zip(axs, DS):
    ends = {}
    for i in ["DynPGM", "BTree", "ALEX", "PGM"]:
        name, c, m = ST[i]; y = [float(get(ds, "range", i, L)["median_ns_per_op"]) for L in ["10", "100", "1000"]]
        ax.plot([10, 100, 1000], y, color=c, marker=m, lw=2, ms=6, markeredgecolor="white"); ends[i] = y[-1]
    keys = list(ends); ly = spread([math.log10(ends[k]) for k in keys], 0.07 * (hi - lo))
    for k, yl in zip(keys, ly):
        ax.annotate(ST[k][0], (1000, ends[k]), xytext=(1250, 10 ** yl), textcoords="data", va="center", fontsize=8.5, color="#333333")
    ax.set_xscale("log"); ax.set_yscale("log"); ax.set_xlim(7, 9000); ax.set_ylim(10 ** lo, 10 ** hi)
    ax.set_title(title, fontsize=10, color="#333333", loc="left"); ax.set_xlabel("Scan length (keys)", color="#444444"); style(ax)
axs[0].set_ylabel("Time per range query (ns, log)", color="#444444")
fig.suptitle("Range scans: lower_bound + scan L keys (" + SUB + ")", fontsize=9.5, color="#333333", x=0.01, ha="left")
fig.tight_layout(); fig.savefig(os.path.join(S, "wp4_range.png")); plt.close(fig)

# build: ms, grouped horizontal bars
fig, ax = plt.subplots(figsize=(6.4, 4.2), dpi=200)
order = ["BTree", "PGM", "DynPGM", "ALEX"]; h = 0.8 / len(DS)
COLS = ["#cce3fd", "#84b9f3", "#2370cd", "#0e3d7e"][-len(DS):] if len(DS) <= 4 else None
for k, (ds, title) in enumerate(DS):
    vals = [float(get(ds, "build", i, "")["build_ms"]) for i in order]
    ys = [j + (k - (len(DS) - 1) / 2) * h for j in range(len(order))]
    ax.barh(ys, vals, height=h - 0.03, color=COLS[k], label=title)
    for y, v in zip(ys, vals): ax.text(v * 1.08, y, f"{v:,.0f} ms", va="center", fontsize=7.5, color="#333333")
ax.set_yticks(range(len(order))); ax.set_yticklabels([ST[i][0] for i in order]); ax.set_xscale("log"); ax.set_xlim(10, 20000)
ax.set_xlabel("Bulk-load time for all 10M keys (ms, log scale)", color="#444444"); style(ax); ax.grid(False, axis="y")
ax.legend(frameon=False, fontsize=8.5, loc="upper right"); ax.invert_yaxis()
ax.set_title("Build time (" + SUB + ")", fontsize=9.5, color="#333333", loc="left")
fig.tight_layout(); fig.savefig(os.path.join(S, "wp4_build.png")); plt.close(fig)
print("wrote wp4_mixed.png wp4_range.png wp4_build.png")
