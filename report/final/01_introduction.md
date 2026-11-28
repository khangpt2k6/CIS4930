## 1 Introduction

Database systems spend much of their time finding keys in sorted data. The usual tools are B+trees and binary search. Kraska et al. [1] proposed to replace them with a model that predicts where a key sits, a *learned index*. They reported lookups up to 70% faster than a cache-optimized B+tree, with an order of magnitude less memory.

The decision this report informs is practical. Should a system that looks up keys in large, read-mostly sorted arrays use a learned index, or a well-tuned non-learned search? Two things make the 2018 answer uncertain. Hardware has changed: caches are larger, ARM sits next to x86, and a lookup in a large array mostly waits on main memory. And learned indexes are usually compared with `std::lower_bound`, not with the best non-learned search tuned with the same effort.

We benchmark four learned indexes (RMI, PGM-index, RadixSpline and ALEX) against five tuned non-learned searches and an oracle. We use four 200M-key real datasets and synthetic keys, on three laptop CPUs (AMD and Intel x86, Apple ARM). Our claims, each on the course's ladder of evidence:

- **Rung 1: learned indexes are better.** On four 200M-key real datasets, the best learned index is 2.3 to 5.4× faster than `std::lower_bound`, but only 1.2 to 1.9× faster than the best tuned search, and slower on one dataset. At equal memory it beats a B+tree by 1.5 to 3.5× (Section 5).
- **Rung 2: because they wait for fewer memory accesses.** Out of cache, a learned lookup waits for 2 to 6 DRAM fills, against 8 to 10 dependent fills for a B+tree or a branchless search, and short independent lookups overlap well. In cache, its lead over `std::lower_bound` is a lead in branch misses, which a branchless search removes (Section 6).
- **Rung 3: except on outliers, small data, changing data and some CPUs.** On fb, 20 outlier keys out of 200M make the RMI nearly as slow as binary search, and removing them speeds it up 3.2×. A tuned search wins while the keys fit in cache, the RMI's p99 is 1.4 to 2.4× the PGM-index's, inserts and long scans erase ALEX's lead, and on the Apple M6 a small-data win turns into a loss (Section 7).
- **Rung 4: and the build pays off quickly.** Training needs no labels or GPU. Against a B+tree, the build is repaid after 0.03 to 0.28 lookups per key (Section 8).

Sections 2 to 4 describe the baselines, the learned indexes and the setup. Sections 5 to 8 answer the six questions of the course: is it better, why, where does it fail, does it transfer, what does it cost, and would anyone use it.
