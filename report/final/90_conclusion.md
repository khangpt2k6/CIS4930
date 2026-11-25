## Conclusion

*Draft. It covers the objectives with verified results (4 and 5); [TODO (final assembly)] add the conclusions of Objectives 1–3 and revise the overall answer.*

We asked when and why learned indexes beat traditional indexes on modern hardware. The results so far give a conditional answer.

**When they win.**
- On both an x86 and an ARM laptop, a learned index (RMI) beats binary search by more as the data grows past the cache. At 100M uniform keys it is 6.5× faster on the AMD Ryzen and 8.6× faster on the Apple M6 (Objective 5).
- For read-mostly point lookups on data that is easy to model, the updatable ALEX is 4.3–6.2× faster than a B+tree at 10M keys (books, uniform and lognormal; Objective 4).

**When they do not.**
- On data that is hard to model (osm), ALEX's read-only lead over the B+tree drops to 1.9×, and at 90% inserts the two tie.
- On the M6, with cache-resident lognormal keys, the RMI is 5% slower than plain binary search, while on the AMD laptop it still wins. The same index and data can win or lose depending on the processor.
- Long range scans favour a static PGM-index over ALEX (1.7–2.8× faster at 1000 keys).
- Bulk loading ALEX takes 14–78× longer than a B+tree.
- Under insert-heavy mixes, a different learned design (the dynamic PGM-index) is faster than ALEX on three of four datasets.

**Why.** Our measurements are consistent with lookup cost being set by cache misses once the keys exceed the cache. There, a learned model saves the most, because it replaces many dependent memory accesses with a prediction and a short search. Within the cache, fast binary search on a modern core narrows or erases that saving. [TODO (Objective 3): confirm or refute this with the `perf` counter results; until then it is an interpretation, not a measurement.]

**Does [1] still hold?** In part. The core claim, that a learned model can beat a general-purpose index on lookups, holds on both laptops once the data exceeds the cache. But the size of the win depends on the processor, the key distribution and the workload, and the costs of inserts, range scans and build time are real. [TODO (Objectives 1–2): add the lookup and memory comparison on the four SOSD datasets, including whether learned indexes still use an order of magnitude less memory than B+trees at equal speed.]

**Future work.** Sequential and append-only inserts, deletes, full-size (200M–800M key) runs, and an Intel data point for the CPU comparison.
