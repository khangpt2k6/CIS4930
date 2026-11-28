#!/usr/bin/env python3
"""Plot a validated WP3 summary.   python wp3/scripts/plot_wp3.py wp3/runs/<run> [out_dir]

Writes (to out_dir, default <run>/summary):
  fig3_1_counters_vs_keys.png  latency, branch misses, DRAM fills and page walks per lookup against key count
  fig3_2_in_vs_out_of_cache.png  cycles per lookup vs branch misses at 100K keys and vs DRAM fills at 100M keys
"""
import csv, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, NullFormatter

# categorical slots 1-6 of the team palette (PGM and B+tree keep their Objective 4 colours)
ST = [("binary_search", "Binary search", "#257de0", "o", "-"),
      ("pgm", "PGM-index", "#f47230", "s", "-"),
      ("btree", "STX B+tree", "#00b894", "^", "-"),
      ("radixspline", "RadixSpline", "#f2a600", "D", "-"),
      ("rmi", "RMI (best of 4)", "#ee7fac", "v", "-"),
      ("binary_search_branchless", "Binary search, branchless", "#008a17", "P", "--")]
LLC_KEYS = 16 * 2**20 / 8  # 16 MB L3 / 8-byte keys


def style(ax):
    ax.grid(True, axis="y", color="#e6e6e6", lw=0.8)
    for s in ["top", "right"]: ax.spines[s].set_visible(False)
    for s in ["left", "bottom"]: ax.spines[s].set_color("#bbbbbb")
    ax.tick_params(colors="#555555", labelsize=8.5)


def load(run):
    rows = list(csv.DictReader(open(os.path.join(run, "summary", "wp3_summary.csv"))))
    for r in rows:
        r["n"] = int(r["n"])
        for k, v in r.items():
            if k not in ("dataset", "index", "config", "best_rmi", "n"):
                r[k] = float(v)
    # one row per (dataset, n, index): the fastest RMI setting, every other index has one config
    return [r for r in rows if r["index"] != "rmi" or r["best_rmi"] == "1"]


def fig1(rows, out):
    metrics = [("ns", "Latency (ns per lookup, log)", True), ("branch_misses", "Branch misses per lookup", False),
               ("fills_dram", "DRAM fills per lookup", False), ("dtlb_l2_miss", "Page walks per lookup", False)]
    fig, axs = plt.subplots(2, 4, figsize=(15, 7.2), sharex=True)
    for i, ds in enumerate(["uniform", "lognormal"]):
        for j, (col, label, logy) in enumerate(metrics):
            ax = axs[i][j]
            for key, name, c, m, ls in ST:
                pts = sorted((r["n"], r[col]) for r in rows if r["dataset"] == ds and r["index"] == key)
                ax.plot([p[0] for p in pts], [p[1] for p in pts], color=c, marker=m, ls=ls, lw=2, ms=6,
                        markeredgecolor="white", label=name)
            ax.axvline(LLC_KEYS, color="#999999", ls=":", lw=1.2)
            ax.set_xscale("log")
            if logy:
                ax.set_yscale("log")
                ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
                ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: f"{v:g}" if str(v)[0] in "25" else ""))
            else: ax.set_ylim(bottom=0)
            ax.set_title(f"{ds}: {label}", fontsize=9.5, color="#333333", loc="left")
            if i == 1: ax.set_xlabel("Keys", color="#444444")
            style(ax)
    axs[0][0].text(LLC_KEYS * 1.12, 0.04, "keys exceed\n16 MB L3", fontsize=7.5, color="#777777",
                   transform=axs[0][0].get_xaxis_transform())
    h, l = axs[0][0].get_legend_handles_labels()
    fig.suptitle("Per-lookup hardware counters, AMD Ryzen AI 7 350 (WSL2), median of 3 trials", fontsize=10,
                 color="#333333", x=0.01, y=0.99, ha="left")
    fig.legend(h, l, loc="upper center", bbox_to_anchor=(0.5, 0.955), ncol=6, frameon=False, fontsize=9)
    fig.tight_layout(rect=(0, 0, 1, 0.935))
    fig.savefig(os.path.join(out, "fig3_1_counters_vs_keys.png"), dpi=160)
    plt.close(fig)


def fig2(rows, out, small, large):
    """Cycles against branch misses (in cache, with a least-squares line) and against DRAM fills (out of cache)."""
    import statistics as st
    fig, axs = plt.subplots(1, 2, figsize=(11, 4.6))
    panels = [(small, "branch_misses", f"{small/1e3:g}K keys (array fits in the 1 MB L2): cycles vs branch misses",
               "Branch misses per lookup"),
              (large, "fills_dram", f"{large/1e6:g}M keys (800 MB, main memory): cycles vs DRAM fills", "DRAM fills per lookup")]
    for ax, (size, xcol, title, xlabel) in zip(axs, panels):
        xs, ys = [], []
        for key, name, c, m, ls in ST:
            for ds, fill in (("uniform", c), ("lognormal", "white")):
                pts = [r for r in rows if r["dataset"] == ds and r["index"] == key and abs(r["n"] - size) / size < 0.03]
                xs += [r[xcol] for r in pts]; ys += [r["cycles"] for r in pts]
                ax.scatter([r[xcol] for r in pts], [r["cycles"] for r in pts], s=60, marker=m, facecolor=fill,
                           edgecolor=c, linewidth=1.8, zorder=3, label=name if ds == "uniform" else None)
        if xcol == "branch_misses":
            fit = st.linear_regression(xs, ys)
            gx = [0, max(xs) * 1.05]
            ax.plot(gx, [fit.intercept + fit.slope * v for v in gx], color="#999999", lw=1.2, ls="--", zorder=2)
            ax.text(0.3, fit.intercept + fit.slope * max(xs) * 0.9,
                    f"cycles = {fit.intercept:.0f} + {fit.slope:.0f} x misses\nr = {st.correlation(xs, ys):.2f}, {len(xs)} points",
                    fontsize=8, color="#555555", va="top")
        else:
            bs = [(x, y) for x, y in zip(xs, ys) if x == max(xs)][0]
            ax.annotate("mostly speculative fills,\noverlapped", bs, xytext=(bs[0] * 0.62, bs[1] * 0.45), fontsize=8,
                        color="#555555", arrowprops=dict(arrowstyle="-", color="#999999", lw=0.8))
        ax.set_xlim(left=0); ax.set_ylim(bottom=0)
        ax.set_title(title, fontsize=9.5, color="#333333", loc="left")
        ax.set_xlabel(xlabel, color="#444444")
        style(ax)
    axs[0].set_ylabel("Cycles per lookup", color="#444444")
    h, l = axs[0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", bbox_to_anchor=(0.5, 0.99), ncol=6, frameon=False, fontsize=8.5)
    fig.text(0.01, 0.01, "Filled markers: uniform keys. Hollow markers: lognormal keys. RMI = fastest of 4 leaf counts.",
             fontsize=8, color="#555555")
    fig.tight_layout(rect=(0, 0.03, 1, 0.92))
    fig.savefig(os.path.join(out, "fig3_2_in_vs_out_of_cache.png"), dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    run = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(run, "summary")
    os.makedirs(out, exist_ok=True)
    rows = load(run)
    sizes = sorted({r["n"] for r in rows if r["dataset"] == "uniform"})
    fig1(rows, out)
    fig2(rows, out, 100_000, sizes[-1])
    print("wrote figures to", out)
