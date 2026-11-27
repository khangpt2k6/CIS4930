# Do Learned Indexes Still Win on Modern Hardware?

CIS 4930 Machine Learning for Computer Systems (USF, Fall 2026), final project of Team 01: Riyon Praveen, Vishakha Tiwari, Sevara Badriddinova, Tuan Khang Phan.

We benchmark learned indexes (RMI, PGM-index, RadixSpline, ALEX) against tuned non-learned search (binary search with and without branches, the Eytzinger layout, interpolation search, a B+tree) and an oracle. We use the four 200M-key SOSD datasets and synthetic keys on three laptop CPUs (AMD and Intel x86, Apple ARM), and explain the results with hardware counters.

## Reproduce the main results table

```bash
bash reproduce.sh            # seconds: rebuilds Table 3 and every summary and figure from the raw results in this repo
bash reproduce.sh --rerun    # about an hour: reruns the SOSD benchmark on this machine first (see wp12/README.md)
```

Needs Python 3 with matplotlib. The rerun also needs a C++17 compiler, about 4 GB of free memory and 7 GB of disk for the data.

## Main results

**Report Table 3: mean lookup latency in ns on 200M SOSD keys (AMD Ryzen AI 7 350, median of 3 trials).**

| Dataset | `std::lower_bound` | Best tuned non-learned | Best learned (size) | Learned vs tuned | Learned vs `std::lower_bound` | Oracle |
|---|---:|---|---|---:|---:|---:|
| books | 762 | Eytzinger 279 | RadixSpline, 22 bits, error 16: **170** (41 MB) | 1.64× | 4.5× | 12 |
| fb | 749 | Eytzinger 272 | PGM, ε = 32: **327** (17 MB) | 0.83× | 2.3× | 13 |
| osm | 733 | Eytzinger 292 | RadixSpline, 24 bits, error 8: **253** (144 MB) | 1.16× | 2.9× | 13 |
| wiki | 649 | Eytzinger 233 | RadixSpline, 22 bits, error 16: **121** (17 MB) | 1.93× | 5.4× | 12 |

- Against a tuned baseline the learned lead is 1.2 to 1.9×, not the 2.3 to 5.4× measured against `std::lower_bound`; on fb the learned index loses. With at most 10 MB of index it beats a B+tree by 1.5 to 3.5×.
- Hardware counters: out of cache a learned lookup waits for 2 to 6 DRAM fills, against 8 to 10 for a B+tree; in cache its lead over `std::lower_bound` is a lead in branch misses (`report/objective3_counters.md`).
- It fails on outliers (20 keys of fb break the RMI and RadixSpline), in cache, under heavy inserts and long range scans (`report/objective4_limitations.md`), and its small-data wins depend on the CPU (`report/objective5_hardware.md`).
- Builds repay their cost after 0.03 to 0.28 lookups per key against a B+tree.

## Deliverables

| File | What it is |
|---|---|
| `report/final_report.pdf` (and `.docx`, `.md`) | the final report: abstract, sections 1 to 9, references, appendices |
| `slides/final_presentation.pptx` (and `.pdf`) | the final presentation |
| `reproduce.sh` | one command for the main results table |

## Repository layout

| Folder | Question | What it holds |
|---|---|---|
| `wp12/` | 1, 2 | every index and baseline on the four SOSD datasets: mean, p50, p99, build time, size |
| `learned-index-bench/` | 1, 4 | RMI against binary search on synthetic keys, run on all three laptops; tuned baselines and oracle |
| `wp3/` | 2 | hardware counters per lookup (Linux `perf_event_open`) |
| `wp4/` | 3 | ALEX, B+tree and PGM-index under inserts, range scans and bulk loading (Apple M6) |
| `sosd-arm64/` | 3, 4 | patches that port SOSD to Apple Silicon, and the ARM runs |
| `report/` | | section files (`report/final/`), longer per-objective write-ups, figures, and the build scripts |
| `slides/` | | the deck and its generator (`slides/src/final_presentation.js`) |

Each benchmark folder has a README with its method and run command. Every run folder records the machine, compiler, flags, power source and data checksums, and earlier runs are never overwritten.

## Rebuild the report and slides

```bash
python report/build_final_report.py                       # report/final/*.md -> report/final_report.md
node report/build_docx.js                                 # -> report/final_report.docx (npm install docx)
powershell -File report/docx_to_pdf.ps1                   # -> report/final_report.pdf (Microsoft Word), prints the page count
cd slides/src && node final_presentation.js               # -> slides/final_presentation.pptx (npm install pptxgenjs react react-dom react-icons sharp)
```

Older material: `Project Proposal.pdf` (the proposal) and `CIS4930_GROUP1.pptx` (the Week 9 progress slide).
