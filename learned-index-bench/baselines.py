#!/usr/bin/env python3
"""Is the RMI better than a tuned non-learned search? Summarize one `bench --baselines` CSV.

Usage (from learned-index-bench/):
  python baselines.py results/ryzen_ai7_350_x86_baselines.csv ../report/figures/objective1 "AMD Ryzen AI 7 350" [llc_bytes]

For each dataset and key count it reports the median latency of every index, the fastest RMI leaf count, the
fastest non-learned search (std::lower_bound, branchless binary search, Eytzinger layout, interpolation search),
and three ratios:
  rmi_vs_std          std::lower_bound / best RMI     (the usual headline: learned vs the default)
  rmi_vs_best_non_ml  best non-learned / best RMI     (the honest one: above 1 means the RMI really wins)
  rmi_vs_oracle       best RMI / oracle               (how far the RMI is from a perfect model)
Spreads are max/median over the 5 timed runs.
Writes OUTDIR/baselines_summary.csv and OUTDIR/fig1_1_tuned_baselines.png.
"""
import csv, os, sys
from collections import defaultdict
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mt

NON_ML = ["binary_search", "binary_search_branchless", "eytzinger", "interpolation"]
STYLE = {  # learned in warm colors, non-learned in cool colors, as in the slides
    "binary_search": ("std::lower_bound", "#8FA9C9", "--", "o"),
    "binary_search_branchless": ("branchless binary search", "#3B6EA8", "-", "s"),
    "eytzinger": ("Eytzinger + prefetch", "#1B2840", "-", "D"),
    "interpolation": ("interpolation search", "#4E9A96", "-", "^"),
    "rmi": ("RMI (best of 4 sizes)", "#E4572E", "-", "v"),
    "oracle": ("oracle (perfect model)", "#98A3B5", ":", "x"),
}


def load(path):
    d = defaultdict(dict)  # (dataset, n) -> index -> (median_ns, spread, bytes, leaves)
    for r in csv.DictReader(open(path)):
        k, idx = (r["dataset"], int(r["n"])), r["index"]
        v = (float(r["median_ns"]), float(r["max_ns"]) / float(r["median_ns"]), int(r["bytes"]), int(r["leaves"]))
        if idx != "rmi" or "rmi" not in d[k] or v[0] < d[k]["rmi"][0]:
            d[k][idx] = v
    missing = [k for k, v in d.items() if not all(i in v for i in STYLE)]
    if missing:
        sys.exit(f"{path}: no --baselines rows for {missing}; rerun bench with --baselines")
    return d


def main():
    path, out, cpu = sys.argv[1], sys.argv[2], sys.argv[3]
    llc = int(sys.argv[4]) if len(sys.argv) > 4 else 16 * 2**20  # last-level cache, bytes
    d = load(path)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "baselines_summary.csv"), "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["cpu", "dataset", "n"] + [f"{i}_ns" for i in STYLE] +
                   ["best_rmi_leaves", "best_rmi_bytes", "best_non_ml", "best_non_ml_ns", "rmi_spread", "best_non_ml_spread",
                    "rmi_vs_std", "rmi_vs_best_non_ml", "rmi_vs_oracle"])
        for (ds, n), v in sorted(d.items()):
            best = min(NON_ML, key=lambda i: v[i][0])
            rmi = v["rmi"][0]
            w.writerow([cpu, ds, n] + [v[i][0] for i in STYLE] +
                       [v["rmi"][3], v["rmi"][2], best, v[best][0], round(v["rmi"][1], 3), round(v[best][1], 3),
                        round(v["binary_search"][0] / rmi, 3), round(v[best][0] / rmi, 3), round(rmi / v["oracle"][0], 2)])

    plt.rcParams.update({"font.size": 9, "axes.titlesize": 9, "axes.labelsize": 9, "xtick.labelsize": 7, "ytick.labelsize": 7,
                         "legend.fontsize": 7, "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False,
                         "axes.titlelocation": "left", "savefig.dpi": 400, "savefig.bbox": "tight"})
    names = {1e5: "100k", 1e6: "1M", 1e7: "10M", 1e8: "100M"}
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 3.0), sharey=True)
    for ax, ds in zip(axs, ["uniform", "lognormal"]):
        xs = sorted(n for (dd, n) in d if dd == ds)
        for idx, (label, color, ls, mk) in STYLE.items():
            ax.plot(xs, [d[(ds, n)][idx][0] for n in xs], color=color, ls=ls, marker=mk, ms=4,
                    lw=2.2 if idx == "rmi" else 1.4, label=label)
        ax.axvline(llc / 8, color="#888", lw=0.8, ls=":")
        ax.set_xscale("log"); ax.set_yscale("log")
        ax.xaxis.set_major_formatter(mt.FuncFormatter(lambda x, _: names.get(x, "")))
        ax.xaxis.set_minor_formatter(mt.NullFormatter())
        ax.yaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: f"{v:g}"))
        ax.set_xlabel("Keys (log scale)"); ax.set_title(f"{ds} keys")
    axs[0].set_ylabel("Lookup latency (ns, log scale)")
    h, l = axs[0].get_legend_handles_labels()
    fig.legend(h, l, loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.13))
    fig.suptitle(f"{cpu}: RMI against tuned non-learned search (dotted line: keys exceed the {llc / 2**20:g} MB last-level cache)", x=0.01, ha="left", fontsize=9)
    fig.tight_layout(); fig.savefig(os.path.join(out, "fig1_1_tuned_baselines.png")); plt.close(fig)
    print("wrote", out)


if __name__ == "__main__":
    main()
