#!/usr/bin/env python3
"""WP5: compare learned-index-bench results across CPUs.

Usage (from learned-index-bench/):
  python compare_cpus.py OUTDIR "Label|color|LLC_bytes|results/file.csv" ["Label|color|LLC_bytes|results/file2.csv" ...]

Example:
  python compare_cpus.py ../report/figures/wp5 \
    "AMD Ryzen AI 7 350 (x86)|#c0392b|16777216|results/ryzen_ai7_350_x86.csv" \
    "Apple M6 (ARM)|#257de0|20971520|results/apple_m6_arm.csv"

Add an Intel laptop by appending one more "Label|color|LLC_bytes|csv" argument.
Writes OUTDIR/wp5_summary.csv, OUTDIR/fig5_1_latency_vs_keys.png and OUTDIR/fig5_2_rmi_speedup.png.
For each CPU, dataset and key count: binary-search median latency, the fastest of the RMI leaf-count settings,
and speedup = binary search / best RMI. Key counts are matched across CPUs after rounding (lognormal and
uniform sizes differ by a few keys between machines because duplicates are removed).
"""
import csv, os, sys
from collections import defaultdict
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mt
from matplotlib.lines import Line2D


def bucket(n):
    return round(n, -5) if n >= 1_000_000 else round(n, -4)


def load(path):
    bs, rmi = {}, defaultdict(list)
    for r in csv.DictReader(open(path)):
        k = (r["dataset"], bucket(int(r["n"])))
        if r["index"] == "binary_search":
            bs[k] = float(r["median_ns"])
        else:
            rmi[k].append((float(r["median_ns"]), int(r["leaves"]), int(r["bytes"])))
    return {k: (bs[k],) + min(rmi[k]) for k in bs}  # (bs_ns, rmi_ns, leaves, bytes)


def main():
    out = sys.argv[1]
    cpus = []
    for spec in sys.argv[2:]:
        label, color, llc, path = spec.split("|")
        cpus.append((label, color, int(llc), load(path)))
    os.makedirs(out, exist_ok=True)

    with open(os.path.join(out, "wp5_summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["cpu", "dataset", "n", "binary_search_ns", "best_rmi_ns", "best_rmi_leaves", "best_rmi_bytes", "rmi_speedup"])
        for label, _, _, d in cpus:
            for (ds, n), (b, r, lv, by) in sorted(d.items()):
                w.writerow([label, ds, n, b, r, lv, by, round(b / r, 3)])

    plt.rcParams.update({"font.size": 9, "axes.titlesize": 9, "axes.labelsize": 9, "xtick.labelsize": 7, "ytick.labelsize": 7,
                         "legend.fontsize": 7, "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False,
                         "axes.titlelocation": "left", "savefig.dpi": 400, "savefig.bbox": "tight"})
    names = {1e5: "100k", 1e6: "1M", 1e7: "10M", 1e8: "100M"}
    fmt = mt.FuncFormatter(lambda x, _: names.get(x, ""))
    DS = [("uniform", "uniform keys"), ("lognormal", "lognormal keys")]

    def xs(d, ds):
        return sorted(n for (dd, n) in d if dd == ds)

    def axis(ax, title):
        for _, color, llc, _ in cpus:
            ax.axvline(llc / 8, color=color, lw=0.8, ls=":", alpha=0.8)
        ax.set_xscale("log"); ax.xaxis.set_major_formatter(fmt); ax.xaxis.set_minor_formatter(mt.NullFormatter())
        ax.set_xlabel("Keys (log scale)"); ax.set_title(title)

    # Figure 5.1: latency vs key count
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 3.0), sharey=True)
    for ax, (ds, title) in zip(axs, DS):
        for label, color, llc, d in cpus:
            x = xs(d, ds)
            ax.plot(x, [d[(ds, n)][0] for n in x], color=color, ls="--", marker="o", ms=4, lw=1.5)
            ax.plot(x, [d[(ds, n)][1] for n in x], color=color, ls="-", marker="s", ms=4, lw=1.5)
        axis(ax, title); ax.set_yscale("log"); ax.yaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: f"{v:g}")); ax.margins(0.05)
    axs[0].set_ylabel("Lookup latency (ns, log scale)")
    h = [Line2D([], [], color=c, lw=2, label=l) for l, c, _, _ in cpus] + [
        Line2D([], [], color="#555", ls="--", marker="o", ms=4, label="binary search"),
        Line2D([], [], color="#555", ls="-", marker="s", ms=4, label="RMI (best of 4 sizes)"),
        Line2D([], [], color="#555", ls=":", label="keys exceed LLC")]
    fig.legend(handles=h, loc="lower center", ncol=len(h), bbox_to_anchor=(0.5, -0.08))
    fig.tight_layout(); fig.savefig(os.path.join(out, "fig5_1_latency_vs_keys.png")); plt.close(fig)

    # Figure 5.2: RMI speedup over binary search
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.8), sharey=True)
    for ax, (ds, title) in zip(axs, DS):
        for label, color, llc, d in cpus:
            x = xs(d, ds)
            ax.plot(x, [d[(ds, n)][0] / d[(ds, n)][1] for n in x], color=color, marker="o", ms=4, lw=1.8, label=label)
        ax.axhline(1, color="#888", lw=0.8); axis(ax, title); ax.set_ylim(0, 9.5)
    axs[0].set_ylabel("RMI speedup over\nbinary search (×)")
    hh, ll = axs[0].get_legend_handles_labels()
    axs[0].legend(hh + [Line2D([], [], color="#555", ls=":", lw=0.8)], ll + ["keys exceed LLC"], loc="upper left")
    axs[1].text(0.02, 0.97, "↑ higher = learned index wins more", transform=axs[1].transAxes, va="top", fontsize=7, color="#888")
    fig.tight_layout(); fig.savefig(os.path.join(out, "fig5_2_rmi_speedup.png")); plt.close(fig)
    print("wrote", out)


if __name__ == "__main__":
    main()
