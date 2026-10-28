# Midterm presentation script (Team 01)

Total: 6 minutes talking, then 4 minutes of questions. Each speaker covers the boxes in slide order and hands over to the next person. Pronunciation hints are in italic parentheses.

| Order | Speaker | Boxes | Time |
|---|---|---|---|
| 1 | Vishakha | 1 The decision, 2 Beat what | 1:15 |
| 2 | Riyon | 3 Our approach | 1:00 |
| 3 | Khang | 4 First result | 1:50 |
| 4 | Sevara | 5 What surprised us, 6 Next six weeks, gate check, closing question | 1:55 |

## 1. Vishakha: boxes 1 and 2 (about 1 minute 15 seconds)

- Hello everyone. We are Team 1, and our project asks whether learned indexes *(LURND IN-dek-siz)* still outperform traditional indexes on modern hardware.
- Every database lookup must decide where a key is stored in a sorted array. Today, this decision is made by a B+tree *(bee-plus tree)*, which follows a sequence of comparisons from the root to a leaf.
- A poor decision never returns an incorrect result. However, each additional step can cause a cache miss, and each miss to main memory costs approximately one hundred nanoseconds *(NAN-oh-sek-unds)*.
- The baseline we must beat is binary search over the sorted array, implemented with the standard library function lower_bound *(LOH-er bound)* and compiled with full optimization. This is the reference baseline in the SOSD *(ess-oh-ess-dee)* benchmark. On our test machine, it requires 525 nanoseconds per lookup at one hundred million keys.
- A tuned B+tree and a hash table will be added as baselines in the next phase. I will now hand over to Riyon, who will explain our approach.

## 2. Riyon: box 3 (about 1 minute)

- A learned index replaces the tree with a model. The model learns the relationship between each key and its position in the sorted array, and it predicts where a key should be.
- We will evaluate four designs: the Recursive Model Index, or RMI *(ar-em-eye)*, the PGM-index *(pee-jee-em)*, RadixSpline *(RAY-diks-spline)*, and ALEX *(AL-eks)*, which also supports inserts.
- An important advantage is that the training labels are free, because they are simply the positions of the keys in the sorted array.
- One inference costs only a few multiply-add operations. The model also stores its maximum error, so the final step is a small local search inside that error bound, and the result is always exact. Khang will now present our first result.

## 3. Khang: box 4 (about 1 minute 50 seconds)

- For our first result, we implemented a two-stage linear RMI, following the original paper by Kraska *(KRAS-kah)* and colleagues, and compared it with binary search. We used two synthetic key distributions, uniform and lognormal *(log-NOR-mul)*, from one hundred thousand to one hundred million keys.
- The horizontal axis shows the number of keys on a logarithmic *(log-uh-RITH-mik)* scale, and the vertical axis shows the median lookup latency in nanoseconds. The dashed lines are the binary search baseline. The solid lines are the RMI, using the best of four model sizes at each point.
- Binary search slows down sharply after the dotted line, where the data no longer fits in the 16-megabyte L3 *(el-three)* cache. Beyond that point, each lookup must wait on main memory several times.
- The RMI remains much flatter. At one hundred million uniform keys, it reduces the lookup time from 525 to 81 nanoseconds, a speedup of approximately 6.5 times, with a model of only 2.3 megabytes.
- All measurements were taken on an AMD Ryzen *(RY-zen)* AI 7 350 laptop processor. Each point is the median of five runs of two million random lookups, after a warm-up run. This processor combines two types of cores. Without pinning the thread to one core, the results were about ten percent slower and noticeably noisier, so every run is now pinned. Sevara will now discuss what surprised us.

## 4. Sevara: boxes 5 and 6, gate check, closing (about 1 minute 55 seconds)

- The most surprising observation concerns the key distribution. With the same 2.3-megabyte model at one hundred million keys, lognormal lookups required 226 nanoseconds, compared with 81 nanoseconds for uniform keys.
- With a very small model of 58 kilobytes at ten million keys, the RMI was in fact slower than binary search, at 341 compared with 314 nanoseconds. A simple linear model cannot follow a skewed distribution, so the error window, and therefore the local search, becomes large. Results on uniform data therefore overstate the benefit.
- Over the next six weeks, the experiment that decides the project is the full SOSD benchmark on four real datasets, with hardware performance counters, on AMD, Intel, and ARM processors. The main risk is that the Linux perf *(purf)* tool cannot read hardware counters inside WSL2 *(dub-ul-yoo ess el two)* or on macOS. Our fallback is to rent bare-metal *(bair-MET-ul)* cloud machines on AWS.
- For the gate check, a wrong prediction is safe because the search is bounded, the labels are free, and the model uses about 0.3 percent of the data size. We are still unsure whether we beat a tuned baseline, because the B+tree is not yet integrated, and whether the approach survives new workloads, because inserts have not been tested.
- We would like to close with a question for the class: for the remaining weeks, should we prioritize more real datasets, or insert-heavy workloads with ALEX? Thank you.

## Q&A preparation

Everyone should be able to answer every question. The person listed answers first.

| Likely question | Answers first | Short answer |
|---|---|---|
| Why compare against binary search and not a B+tree? | Vishakha | Binary search is the reference baseline in SOSD. A tuned B+tree is usually faster than binary search on large data, so our 6.5x is an upper bound. The B+tree is the next baseline we add. |
| You tuned the RMI (best of four sizes) but not the baseline. Is that fair? | Khang | Binary search has no parameter to tune. Even the smallest RMI we tested (0.6 MB) takes 97 ns at 100M uniform keys, still 5.4x faster. The memory vs speed curve is Objective 2. |
| Why does binary search get so slow after 16 MB? | Vishakha | 100M keys need about 27 search steps. The first steps stay in cache, but the last ones each miss to main memory, at about 100 ns per miss. The RMI makes one prediction and then searches a small window. |
| Why is lognormal data hard for the RMI? | Riyon | The linear root model sends most keys into a few leaves, so their error windows grow. PGM-index and RadixSpline fit segments with a fixed error bound, so they should handle skew better. That is what we test next. |
| What about inserts? | Sevara | A static RMI must be retrained after inserts. ALEX leaves gaps in its arrays so it can insert in place. Insert-heavy workloads are Objective 4. |
| Where is p99 latency? | Khang | Not measured yet. Timing each lookup with a normal timer adds about 20 ns, which is close to a full lookup, so we will use the CPU cycle counter (rdtsc) for p99. |
| Why Windows and not Linux? | Khang | This first result was a quick run on a laptop. The full study runs SOSD on Linux, where perf counters are available. |
| Do the conclusions of Kraska et al. still hold? | Khang | On this machine, for read-only uniform data against binary search, yes. Whether they hold on real data, against a tuned B+tree, and on other CPUs is exactly what the rest of the project tests. |
