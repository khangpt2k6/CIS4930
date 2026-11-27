#!/usr/bin/env python3
"""Figures for Objectives 1 and 2 from <run>/summary/wp12_summary.csv (run summarize_wp12.py first).

  python wp12/scripts/plot_wp12.py wp12/runs/<run> [--copy report/figures]

fig1_2_sosd_mean_p99.png    per dataset: best configuration of each index, closed-loop mean and isolated p99
fig2_1_size_vs_latency.png  per dataset: mean latency against index size for every configuration
Palette: categorical slots checked with the dataviz validator (CVD and normal-vision separation pass).
"""
import csv, os, shutil, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mt

DS = [("books_200M_uint64", "books"), ("fb_200M_uint64", "fb"), ("osm_cellids_200M_uint64", "osm"),
      ("wiki_ts_200M_uint64", "wiki")]
ROWS = [("binary_search", "std::lower_bound"), ("binary_search_branchless", "Branchless binary search"),
        ("interpolation", "Interpolation search"), ("eytzinger", "Eytzinger + prefetch"), ("btree", "B+tree"),
        ("radixspline", "RadixSpline"), ("pgm", "PGM-index"), ("rmi", "RMI"), ("oracle", "Oracle")]
LEARNED = {"rmi", "pgm", "radixspline"}
MEAN_C, P99_C = "#257de0", "#f47230"
FAMILY = {"btree": ("B+tree", "#257de0", "s"), "rmi": ("RMI", "#f47230", "o"), "pgm": ("PGM-index", "#00b894", "^"),
          "radixspline": ("RadixSpline", "#6a4ce2", "D")}
INK, MUTED, GRID = "#1f1f1f", "#5c5c5c", "#e3e3e3"


def load(run):
    rows = list(csv.DictReader(open(os.path.join(run, "summary", "wp12_summary.csv"))))
    for r in rows:
        for k in ("bytes", "mean_ns", "p99_ns", "p50_ns"):
            r[k] = float(r[k])
    return rows


def style():
    plt.rcParams.update({"font.size": 8, "axes.titlesize": 9, "axes.labelsize": 8, "xtick.labelsize": 7,
                         "ytick.labelsize": 7, "legend.fontsize": 7, "axes.spines.top": False,
                         "axes.spines.right": False, "legend.frameon": False, "axes.titlelocation": "left",
                         "axes.edgecolor": MUTED, "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED,
                         "text.color": INK, "savefig.dpi": 400, "savefig.bbox": "tight"})


def fig_obj1(rows, out):
    fig, axs = plt.subplots(1, 4, figsize=(7.2, 3.1), sharey=True)
    for ax, (ds, label) in zip(axs, DS):
        sub = [r for r in rows if r["dataset"] == ds]
        for y, (idx, name) in enumerate(ROWS):
            c = [r for r in sub if r["index"] == idx]
            if not c: continue
            b = min(c, key=lambda r: r["mean_ns"])
            ax.plot([b["mean_ns"], b["p99_ns"]], [y, y], color=GRID, lw=2, zorder=1, solid_capstyle="round")
            ax.scatter(b["mean_ns"], y, s=26, color=MEAN_C, zorder=3, edgecolor="white", linewidth=0.8,
                       label="mean, closed loop" if y == 0 else None)
            ax.scatter(b["p99_ns"], y, s=26, color=P99_C, marker="D", zorder=3, edgecolor="white", linewidth=0.8,
                       label="p99, one lookup at a time" if y == 0 else None)
        ax.axhspan(4.5, 7.5, color="#f5f5f5", zorder=0)
        ax.set_xscale("log")
        ax.xaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: "%g" % v))
        ax.grid(axis="x", color=GRID, lw=0.6); ax.set_axisbelow(True)
        ax.set_title(label)
        ax.set_xlabel("ns (log)")
        ax.tick_params(axis="y", length=0)
    axs[0].set_yticks(range(len(ROWS)), [n for _, n in ROWS])
    axs[0].invert_yaxis()
    h, l = axs[0].get_legend_handles_labels()
    fig.legend(h, l, loc="lower center", ncol=2, bbox_to_anchor=(0.55, -0.06))
    fig.suptitle("Best configuration of each index on 200M SOSD keys (shaded rows: learned indexes)",
                 x=0.01, ha="left", fontsize=9)
    fig.tight_layout()
    p = os.path.join(out, "fig1_2_sosd_mean_p99.png"); fig.savefig(p); plt.close(fig)
    return p


def fig_obj2(rows, out):
    fig, axs = plt.subplots(1, 4, figsize=(7.2, 2.9), sharey=True)
    for ax, (ds, label) in zip(axs, DS):
        sub = [r for r in rows if r["dataset"] == ds]
        for idx, (name, color, mk) in FAMILY.items():
            c = sorted((r for r in sub if r["index"] == idx), key=lambda r: r["bytes"])
            ax.plot([r["bytes"] for r in c], [r["mean_ns"] for r in c], color=color, marker=mk, ms=4, lw=1.6,
                    label=name, markeredgecolor="white", markeredgewidth=0.6)
        bs = [r for r in sub if r["index"] == "binary_search"]
        if bs:
            ax.axhline(bs[0]["mean_ns"], color=MUTED, lw=1, ls="--", label="std::lower_bound (no index)")
        ey = [r for r in sub if r["index"] == "eytzinger"]
        if ey:
            ax.scatter(ey[0]["bytes"], ey[0]["mean_ns"], color=INK, marker="x", s=22, zorder=4,
                       label="Eytzinger (copy of keys)")
        ax.set_xscale("log"); ax.set_yscale("log")
        ax.xaxis.set_major_locator(mt.LogLocator(base=10, numticks=10))
        ax.xaxis.set_major_formatter(mt.FuncFormatter(
            lambda v, _: {1e3: "1 KB", 1e5: "100 KB", 1e7: "10 MB", 1e9: "1 GB"}.get(v, "")))
        ax.xaxis.set_minor_formatter(mt.NullFormatter())
        ax.yaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: "%g" % v))
        ax.yaxis.set_minor_formatter(mt.FuncFormatter(lambda v, _: "%g" % v if v in (200, 300, 500) else ""))
        ax.grid(color=GRID, lw=0.6); ax.set_axisbelow(True)
        ax.set_title(label); ax.set_xlabel("Index size (log)")
    axs[0].set_ylabel("Mean lookup latency (ns, log)")
    h, l = axs[0].get_legend_handles_labels()
    fig.legend(h, l, loc="lower center", ncol=6, bbox_to_anchor=(0.5, -0.08))
    fig.suptitle("Index size against lookup latency, 200M SOSD keys (lower left is better)", x=0.01, ha="left",
                 fontsize=9)
    fig.tight_layout()
    p = os.path.join(out, "fig2_1_size_vs_latency.png"); fig.savefig(p); plt.close(fig)
    return p


def main():
    run = sys.argv[1]
    copy = sys.argv[sys.argv.index("--copy") + 1] if "--copy" in sys.argv else None
    rows = load(run)
    style()
    sd = os.path.join(run, "summary")
    p1, p2 = fig_obj1(rows, sd), fig_obj2(rows, sd)
    print("wrote", p1, p2)
    if copy:
        for p, sub in ((p1, "objective1"), (p2, "objective2")):
            os.makedirs(os.path.join(copy, sub), exist_ok=True)
            shutil.copy(p, os.path.join(copy, sub, os.path.basename(p)))
        print("copied figures to", copy)


if __name__ == "__main__":
    main()
