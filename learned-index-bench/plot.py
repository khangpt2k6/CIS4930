# Plot median lookup latency vs dataset size: binary search vs best-tuned RMI.
# Usage: python plot.py results/<machine>.csv out.png "<machine label>"
import csv
import sys
from collections import defaultdict

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, dst, label = sys.argv[1], sys.argv[2], sys.argv[3]
rows = list(csv.DictReader(open(src)))

series = defaultdict(dict)  # (index, dataset) -> n -> row with lowest median
for r in rows:
    key = (r["index"], r["dataset"])
    n = int(r["n"])
    if n not in series[key] or float(r["median_ns"]) < float(series[key][n]["median_ns"]):
        series[key][n] = r

plt.rcParams.update({"font.family": "Arial", "font.size": 9})
fig, ax = plt.subplots(figsize=(4.6, 2.85), dpi=300)
styles = {
    ("binary_search", "uniform"): ("Binary search (baseline), uniform", "black", "o", "--"),
    ("binary_search", "lognormal"): ("Binary search (baseline), lognormal", "gray", "s", "--"),
    ("rmi", "uniform"): ("Learned RMI, uniform", "black", "o", "-"),
    ("rmi", "lognormal"): ("Learned RMI, lognormal", "gray", "s", "-"),
}
for key, (name, color, marker, ls) in styles.items():
    pts = sorted(series[key].items())
    xs = [n for n, _ in pts]
    ys = [float(r["median_ns"]) for _, r in pts]
    lo = [y - float(r["min_ns"]) for y, (_, r) in zip(ys, pts)]
    hi = [float(r["max_ns"]) - y for y, (_, r) in zip(ys, pts)]
    ax.errorbar(xs, ys, yerr=[lo, hi], label=name, color=color, marker=marker, ls=ls, ms=3.5, lw=1.2, capsize=2)

ax.set_ylim(bottom=0)
ax.axvline(16 * 2**20 / 8, color="gray", lw=0.8, ls=":")
ax.text(16 * 2**20 / 8 * 1.1, ax.get_ylim()[1] * 0.97, "keys exceed L3 (16 MB)", fontsize=7, va="top", color="dimgray")
ax.set_xscale("log")
ax.set_xlabel("Number of keys (sorted 64-bit)")
ax.set_ylabel("Lookup latency (ns, median)")
ax.set_title(label, fontsize=8, color="dimgray")
ax.grid(True, which="major", lw=0.3, color="lightgray")
ax.legend(fontsize=6.5, frameon=False, loc="upper left")
fig.tight_layout(pad=0.3)
fig.savefig(dst)
