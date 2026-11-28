## 3 Approach

A learned index treats a lookup as regression. The model maps a key to its position, which is the cumulative distribution of the keys scaled by n. The training labels are the positions themselves, so labels cost nothing. Training is a fit over the sorted keys when the index is built. A lookup evaluates the model, then searches a small window around the prediction. Each index stores its largest prediction error at build time, so the window always contains the answer. A bad prediction costs time, but it can never return a wrong result.

We test four learned indexes. Each has a setting that trades memory for accuracy.

**Table 1. Learned indexes and the settings we sweep.**

| Index | Model | Size setting (values swept) |
|---|---|---|
| RMI [1] | a linear root sends the key to one of many linear leaves | leaves: n/32 to n/32768 (6 values) |
| PGM-index [3] | linear segments with error at most ε, searched recursively | ε from 8 to 2048 (5 values) |
| RadixSpline [4] | a spline with bounded error, plus a table on key prefixes | (radix bits, error) from (24, 8) to (14, 256) (6 values) |
| ALEX [5] | an adaptive tree of linear models over gapped arrays; supports inserts | library defaults (Objective 4 only) |

The RMI is our own two-stage linear version. PGM-index, RadixSpline and ALEX are the authors' libraries at pinned commits. Four drivers share this code:

- `wp12` (questions 1 and 2): every index and baseline above on the four SOSD datasets. It reports mean, median and 99th-percentile (p99) latency, build time and index size.
- `learned-index-bench` (questions 1 and 4): the RMI, the binary search variants and the oracle on synthetic keys from 100K to 100M, run on three laptops.
- `wp3` (question 2): hardware counters per lookup, read with Linux `perf_event_open`.
- `wp4` (question 3): ALEX, the B+tree and two PGM variants under inserts, range scans and bulk loading.

The budget of a learned index is its build time (training) and its size (the model). Inference is the lookup itself. We report all three.
