## 6 Why it works

We read hardware counters around the lookup loop on the AMD laptop, under Linux (same keys and queries as the synthetic runs). A pointer-chase calibration confirmed that each counter reports the expected cache level inside the virtual machine. Table 5 shows two regimes.

**Table 5. Per lookup, uniform keys, median of 3 trials. RMI is the fastest of 4 leaf counts.**

| Index | 100K keys (in L2): ns | Branch misses | 100M keys (in DRAM): ns | DRAM fills | Page walks |
|---|---:|---:|---:|---:|---:|
| `std::lower_bound` | 118 | 9.4 | 707 | 43.5 | 27.5 |
| Branchless binary search | **26** | 0.0 | 1,094 | 8.8 | 6.8 |
| B+tree | 77 | 5.1 | 832 | 8.3 | 2.8 |
| PGM-index | 69 | 3.8 | 228 | 5.3 | 1.1 |
| RadixSpline | 54 | 2.8 | 128 | 3.2 | 1.1 |
| RMI | 38 | 1.6 | **96** | 2.3 | 1.1 |

**In cache, branch misses set the cost.** At 100K keys no index reaches DRAM. Across six indexes and two key distributions, cycles per lookup follow branch misses closely: cycles ≈ 92 + 29 × misses (r = 0.97, 12 points). `std::lower_bound` mispredicts about half of its 17 comparisons. The RMI beats it mostly because it mispredicts less. A branchless search removes the misses and beats every index, the RMI included.

**Out of cache, dependent misses set the cost.** At 100M keys a learned index fetches 2 to 6 lines from DRAM and walks the page table about once. A B+tree or a branchless search waits for 8 to 10 fetches, one after another. Total traffic is not what counts. `std::lower_bound` fetches over 40 lines, mostly on paths it guesses and then discards, and is still faster than the branchless search. This refines the SOSD explanation [2]. Cache misses matter, but what sets latency is the number of misses a lookup must wait for in sequence.

**Ablation: model accuracy becomes memory traffic.** On 100M lognormal keys, shrinking the RMI from 1.5M leaves (37 MB) to 24K leaves (0.6 MB) widens its search window from 2^6.6 to 2^11.9 keys on average. DRAM fills rise from 6.2 to 32.9 per lookup, and latency from 174 to 437 ns. On uniform keys the model stays accurate at every size (2.1 to 3.5 fills).

**Overlap between lookups.** Our mean runs independent lookups in a loop, so the core works on several at once. Timed alone, `std::lower_bound` and the B+tree slow down 1.5 to 1.6×, the Eytzinger layout 2.1 to 2.2×, and the RMI and RadixSpline 2.3 to 3.3× (SOSD data; books, osm and wiki). Even the oracle's single read takes about 200 ns alone, against 12 ns in the loop. A learned lookup is short and independent of the previous one, so several fit in flight at once. When lookups cannot overlap, the learned lead over the best tuned search shrinks: from 1.64× to 1.31× on books and from 1.93× to 1.47× on wiki.
