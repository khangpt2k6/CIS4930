import csv, statistics as st
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

d = "results/obj1_50M_r31"
names = {"BS":"Binary search","BTree":"B+tree","PGM":"PGM-index","RMI":"RMI","RS":"RadixSpline","RobinHash":"Hash table"}
order = ["BS","BTree","PGM","RMI","RS","RobinHash"]
datasets = ["books","fb","osm_cellids","wiki_ts"]
rows = []
for ds in datasets:
    for idx in order:
        line = [l for l in open(f"{d}/{ds}_50M_uint64_{idx}.txt") if l.startswith("RESULT:")][0]
        f = line.strip().split(": ", 1)[1].split(",")
        allt = [float(x) for x in f[2:-3]]
        t = allt[1:]  # drop first run as warm-up
        mean, med, sd = st.mean(t), st.median(t), st.stdev(t)
        rows.append([ds, names[idx], len(t), round(mean,1), round(med,1), round(sd,1),
                     round(sd/len(t)**0.5,1), round(min(t),1), round(max(t),1),
                     round(1000/mean,3), round(int(f[-3])/1e6,2), round(int(f[-2])/1e9,2)])
with open(f"{d}/summary_r31.csv", "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["dataset","index","runs_used","mean_ns","median_ns","std_ns","std_error_ns","min_ns","max_ns","throughput_M_per_s","index_MB","build_s"])
    w.writerows(rows)
fig, ax = plt.subplots(figsize=(8,4))
width = 0.13
for i, idx in enumerate(order):
    sel = [[r for r in rows if r[0]==ds and r[1]==names[idx]][0] for ds in datasets]
    ax.bar([j + (i-2.5)*width for j in range(4)], [r[3] for r in sel], width,
           yerr=[r[5] for r in sel], capsize=1.5, label=names[idx])
ax.set_xticks(range(4)); ax.set_xticklabels(datasets)
ax.set_yscale("log"); ax.set_ylabel("Mean lookup latency (ns, log scale, error bars = std dev)")
ax.set_title("Lookup latency at 50M keys, 30 runs (i7-1355U, WSL2)")
ax.legend(fontsize=7, ncol=3)
fig.tight_layout(); fig.savefig(f"{d}/latency_50M_r31.png", dpi=200)
print("wrote summary_r31.csv and latency_50M_r31.png")
