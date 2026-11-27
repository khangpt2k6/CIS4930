## 8 Cost and deployment

**What it costs.** A learned index needs no labels, no GPU and no API spend. Its training is the build, a fit over the sorted keys on one core. Its inference is the lookup itself, which Sections 5 to 7 measure. On 200M keys, one core builds the fastest RadixSpline in 0.9 to 3.4 s, the fastest RMI in 1.2 to 2.7 s and the fastest PGM-index in 3.0 to 9.0 s. The fastest B+tree takes 60 to 143 ms, and the Eytzinger copy 0.2 to 0.7 s. The fastest learned indexes take 17 to 144 MB, against 0.7 to 1.6 GB for the Eytzinger copy.

**Table 6. Break-even N\*: lookups per key before a faster learned index repays its slower build.** N\* = (extra build time per key) / (time saved per lookup). Below 1, the build pays for itself before every key has been looked up once.

| Dataset | Learned index | vs `std::lower_bound` | vs best B+tree | vs Eytzinger |
|---|---|---:|---:|---:|
| books | RadixSpline, 22 bits, error 16 | 0.024 | 0.042 | 0.100 |
| fb | PGM, ε = 32 | 0.107 | 0.276 | never |
| osm | RadixSpline, 24 bits, error 8 | 0.035 | 0.070 | 0.351 |
| wiki | RadixSpline, 22 bits, error 16 | 0.020 | 0.033 | 0.070 |

Against the fastest B+tree, the best learned index repays its build after 0.03 to 0.28 lookups per key. On books that is about 8M lookups, under 2 s of lookup work. Against the Eytzinger layout it takes 0.07 to 0.35 lookups per key, and on fb never, because there the learned index is slower. ALEX on the Apple laptop needs 0.65 lookups per key on books, 2.3 on osm, and 18.9 on osm with 90% inserts, where it saves only 7 ns per operation.

**Where it would run.** A learned index fits sorted data that is written once and read many times. Examples are the immutable sorted files of a log-structured store, rebuilt at each compaction, and the read-only segments of a column store. It runs on every lookup, millions of times per second. The build runs once per file. N\* says that file needs only a few percent of a lookup per key, or about one lookup per key for ALEX on easy data, to repay it.

**What happens when it is wrong.** The model can be wrong, but the answer cannot. Each index stores its largest error at build time, and the last-mile search covers it. A bad prediction only widens the search: the worst case is a binary search over the error window, and with PGM-index (ε = 32) that window is 65 keys. The real risks are slowdowns. Hard data, outliers or new keys widen windows, and fixing that requires a rebuild. Inserts that do not match the model cost time (Section 7). Small or in-cache data is better served by a branchless binary search. A system should therefore keep a non-learned search as its fallback and rebuild the model when the data changes.
