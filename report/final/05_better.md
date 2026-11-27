## 5 Is it better?

**Against a tuned baseline.** Table 3 compares, on each SOSD dataset, the best setting of any learned index with the best tuned non-learned search. Figure 1 shows the best setting of every index.

**Table 3. Main result: mean lookup latency in ns on 200M SOSD keys (AMD laptop, median of 3 trials). The best tuned non-learned search is the Eytzinger layout on every dataset; it needs a second copy of the keys (1.6 GB, 0.7 GB for wiki).**

| Dataset | `std::lower_bound` | Best tuned non-learned | Best learned (size) | Learned vs tuned | Learned vs `std::lower_bound` | Oracle |
|---|---:|---|---|---:|---:|---:|
| books | 762 | Eytzinger 279 | RadixSpline, 22 bits, error 16: **170** (41 MB) | 1.64× | 4.5× | 12 |
| fb | 749 | Eytzinger 272 | PGM, ε = 32: **327** (17 MB) | 0.83× | 2.3× | 13 |
| osm | 733 | Eytzinger 292 | RadixSpline, 24 bits, error 8: **253** (144 MB) | 1.16× | 2.9× | 13 |
| wiki | 649 | Eytzinger 233 | RadixSpline, 22 bits, error 16: **121** (17 MB) | 1.93× | 5.4× | 12 |

- Against `std::lower_bound`, the usual bar, the best learned index is 2.3 to 5.4× faster.
- Against the best tuned search, the gain is much smaller: 1.6× on books and 1.9× on wiki, but only 1.16× on osm, where RadixSpline needs 144 MB to get there. On fb the learned index loses (0.83×).
- The best learned index is still 10 to 26× slower than the oracle, so better models have room to gain.
- On synthetic keys the picture is the same. At 100M keys the RMI's lead falls from 6.4× over `std::lower_bound` to 2.5× over the best tuned search (uniform keys), and from 3.9× to 1.5× (lognormal keys).

![Figure 1](figures/objective1/fig1_2_sosd_mean_p99.png)

**Figure 1.** Best setting of every index on each dataset: closed-loop mean (circles) and p99 of lookups timed one at a time (diamonds). Shaded rows are learned indexes.

**At the same memory budget.** The Eytzinger layout's speed costs a full copy of the keys. Figure 2 plots every setting of every index by size. With at most 10 MB of index, which is 0.6% of the keys' size, the learned indexes win clearly (Table 4).

**Table 4. Fastest index with at most 10 MB of extra memory (mean ns). The 0-byte searches count as non-learned options.**

| Dataset | Best non-learned, at most 10 MB | Best learned, at most 10 MB | Learned faster by |
|---|---|---|---:|
| books | B+tree every 512: 519 ns (6.7 MB) | RadixSpline 18 bits, error 64: 186 ns (4.2 MB) | 2.8× |
| fb | B+tree every 512: 524 ns (6.7 MB) | PGM ε = 128: 360 ns (4.1 MB) | 1.5× |
| osm | B+tree every 512: 515 ns (6.7 MB) | RadixSpline 16 bits, error 128: 350 ns (5.2 MB) | 1.5× |
| wiki | B+tree every 512: 463 ns (3.0 MB) | RadixSpline 20 bits, error 32: 131 ns (4.4 MB) | 3.5× |

![Figure 2](figures/objective2/fig2_1_size_vs_latency.png)

**Figure 2.** Mean lookup latency against index size for every setting. The dashed line is `std::lower_bound`, which needs no index; the cross is the Eytzinger layout.

Except for the RMI on fb, every learned family sits below the B+tree at every size in Figure 2. With 1 MB, the best learned index is 1.2 to 2.7× faster than the best B+tree of that size, and a 24 KB PGM-index is still nearly 2× faster than `std::lower_bound` on books. The fastest learned settings take 17 to 41 MB, 1 to 3% of the keys' size, and settings of about 4 MB are within 10% of them, except on osm.

**Answer.** Yes, on three of four datasets, but by 1.2 to 1.9× over the best tuned search, not the 2.3 to 5.4× measured against `std::lower_bound`. Per byte of memory the learned indexes win clearly: 1.5 to 3.5× over a B+tree of the same size.
