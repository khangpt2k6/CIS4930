## Introduction

Database systems rely on index structures to find data quickly. The two most widely used are B+trees, which answer both exact-match lookups and range queries, and hash tables, which answer exact-match lookups fast but cannot answer range queries. Both are general-purpose: they behave the same whatever the key distribution, and they make no use of patterns in the data.

Kraska et al. [1] proposed *learned indexes*, which replace the tree with a model of the mapping from each key to its position in a sorted array. A lookup predicts an approximate position, then searches a small window around the prediction. In their experiments, learned indexes were up to 70% faster than cache-optimized B+trees while using an order of magnitude less memory [1].

Those results were obtained on hardware that is now several years old. Modern processors have much larger caches and more varied architectures, x86 and ARM among them, and the cost of an index lookup depends heavily on how often it waits on main memory. It is therefore not clear that the reported advantages still hold. Learned indexes also have known weaknesses that headline lookup numbers do not show: data that is hard to model, insert-heavy workloads, range queries and build time.

**Goal.** This project asks *when and why learned indexes outperform traditional indexes on modern hardware*. We benchmark learned indexes (RMI [1], PGM-index [3], RadixSpline [4] and the updatable ALEX [5]) against a B+tree, a hash table and binary search, building on the SOSD benchmark [2]. Our five objectives are:

1. Compare lookup performance: average and 99th-percentile latency and throughput on four datasets.
2. Measure the trade-off between index memory and lookup speed.
3. Explain the results with hardware performance counters (cache misses, branch mispredictions, instructions per lookup).
4. Identify where learned indexes fall short: hard-to-model data, inserts, range queries and build time.
5. Assess the effect of modern hardware: repeat key experiments on different processor architectures, at sizes smaller and larger than the cache.

**Contributions so far.** [TODO (final assembly): add one line per objective once Objectives 1–3 are in.]
- **Objective 4.** On an Apple M6, the updatable learned index ALEX loses most of its lookup advantage over a B+tree on hard-to-model data (osm) and ties it at 90% inserts there. For long range scans and for bulk loading, it trails simpler structures.
- **Objective 5.** On both an AMD x86 laptop and an Apple ARM laptop, a learned index's advantage over binary search grows once the keys no longer fit in cache. At cache-resident sizes, whether it wins at all depends on the CPU.
- **Tooling.** Two ports to Apple Silicon (the SOSD benchmark and ALEX), seeded and checksummed datasets, and validation scripts that check every reported number against the raw logs.
