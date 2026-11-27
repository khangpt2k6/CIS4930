#!/usr/bin/env bash
set -e
cd ~/projects/SOSD
cp benchmarks/benchmark_rmi.cc ~/benchmark_rmi.cc.bak2
cp competitors/rmi/all_rmis.h ~/all_rmis.h.bak

# 1. 50M datasets (every 4th key of the 200M files)
python3 - << 'PYEOF'
import numpy as np, os
for src, dst in [("fb_200M_uint64","fb_50M_uint64"),
                 ("osm_cellids_200M_uint64","osm_cellids_50M_uint64"),
                 ("wiki_ts_200M_uint64","wiki_ts_50M_uint64")]:
    if os.path.exists("data/" + dst):
        print("exists", dst); continue
    m = np.memmap("data/" + src, dtype=np.uint64, mode="r")[1:]
    sub = np.ascontiguousarray(m[::4])
    with open("data/" + dst, "wb") as f:
        np.array([len(sub)], dtype=np.uint64).tofile(f)
        sub.tofile(f)
    print("wrote", dst, len(sub))
PYEOF

# 2. lookup files
for d in books fb osm_cellids wiki_ts; do
  [ -f data/${d}_50M_uint64_equality_lookups_1M ] || ./build/generate data/${d}_50M_uint64 1000000
done

# 3. RMI files (same recipe as build_rmis.sh)
for d in books fb osm_cellids wiki_ts; do
  name=${d}_50M_uint64
  if [ ! -f competitors/rmi/${name}_0.h ]; then
    sed 's/_200M_/_50M_/g' scripts/rmi_specs/${d}_200M_uint64.json > scripts/rmi_specs/${name}.json
    RMI/target/release/rmi data/$name --param-grid scripts/rmi_specs/${name}.json -d rmi_data/ --threads 4 --zero-build-time
    mv ${name}_* competitors/rmi/ 2>/dev/null || true
  fi
  [ -f competitors/rmi/${name}_0.h ] || { echo "RMI files missing for $name"; find . -name "${name}_0.h"; exit 1; }
done

# 4. register the new RMIs in all_rmis.h
tmpl=$(grep -m1 'books_200M_uint64_0\.h"' competitors/rmi/all_rmis.h || true)
[ -n "$tmpl" ] || { echo "cannot find include style in all_rmis.h"; exit 1; }
echo "" >> competitors/rmi/all_rmis.h
for d in books fb osm_cellids wiki_ts; do
  for i in 0 1 2 3 4 5 6 7 8 9; do
    line=$(echo "$tmpl" | sed "s/books_200M_uint64_0/${d}_50M_uint64_${i}/")
    grep -qF "$line" competitors/rmi/all_rmis.h || echo "$line" >> competitors/rmi/all_rmis.h
  done
done

# 5. tell benchmark_rmi.cc about the 50M names
python3 - << 'PYEOF'
p = "benchmarks/benchmark_rmi.cc"
s = open(p).read()
anchor = "  run_rmi_binary_pareto(uint64, fb_200M);\n"
assert anchor in s
if "books_50M" not in s:
    add = "".join("  run_rmi_binary_pareto(uint64, %s_50M);\n" % d for d in ["fb", "osm_cellids", "wiki_ts", "books"])
    open(p, "w").write(s.replace(anchor, add + anchor, 1))
print("benchmark_rmi.cc updated")
PYEOF
echo "PREP DONE"
