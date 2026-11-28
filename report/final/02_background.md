## 2 Background and baselines

An index over a sorted array of 64-bit keys answers a lookup with the position of the first key that is not smaller than the query. Every structure in this report returns that position, and our drivers check it for every query before timing. Without machine learning, the options are:

- **Binary search** (`std::lower_bound`). It needs no extra memory and about log2 n dependent reads.
- **Branchless binary search.** The same comparisons, with a conditional move instead of a branch. It never mispredicts, but it cannot run ahead of a slow load either.
- **Eytzinger layout with prefetching** [6]. A second copy of the keys in breadth-first tree order, so the next levels of the search share one prefetched cache line.
- **Interpolation search.** It probes where a straight line between the end keys of the range puts the query (up to 8 probes, then binary search). This is a two-point "model" with no training.
- **B+tree** (STX B+tree 0.9, the copy SOSD uses). As in SOSD, it indexes every s-th key and finishes with a binary search inside the gap, so s sets its size.
- **Hash table.** It answers only exact-match lookups and cannot find a lower bound, so it is not in our main comparison.

**Tuning at the same budget.** All baselines run in the same driver as the learned indexes, on the same keys and queries, with the same compiler flags and timing loop. The B+tree gets a size sweep like each learned index (6 values of s, from 8 to 8192). We report the best setting of every index, and the best setting under equal memory budgets. We call a learned index better only if it beats the fastest of these, not `std::lower_bound`.

**Oracle.** The oracle is given each query's true position and only reads that key. No index can do less work, so the gap to the oracle bounds what a better model could still gain.
