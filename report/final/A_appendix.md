## Appendix A. Contributions

- **Tuan Khang Phan.** Questions 1 and 2 on the SOSD datasets (`wp12`), the tuned baselines and oracle, the hardware counter study (`wp3`), the AMD laptop runs, and assembly of the report, slides and repository.
- **Riyon Praveen.** Memory against speed (question 2) and related work, per the team's task split.
- **Vishakha Tiwari.** The Intel laptop run for the cross-CPU comparison (question 4).
- **Sevara Badriddinova.** Inserts, range scans and build time with ALEX (`wp4`), the SOSD and ALEX ports to Apple Silicon, the Apple laptop runs, and the first drafts of the report and slides.

## Appendix B. AI use

We used an AI coding assistant (Claude, by Anthropic) in this project. It helped write and debug the benchmark drivers and analysis scripts, ran benchmarks on the AMD laptop, drafted report and slide text from our results, and checked citations against Crossref. Every number in this report comes from a raw result file in the repository and is recomputed by a script. The team reviewed the code, results and text, and is responsible for all of it.

## Appendix C. Reproducibility checklist

| Grader's question | Where it is answered |
|---|---|
| The baseline is non-ML, tuned, and run at the same budget | Section 2; Table 3; Figure 2 (equal size budgets) |
| Cost is reported: data, training, inference, money | Section 8 |
| Every number has its number of runs and a spread | Section 4; each table caption |
| One paragraph says where this would run and what happens when it is wrong | Section 8 |
| At least one ablation or profile explains the result | Section 6 (counters; RMI size ablation) |
| The README reproduces the main results table with one command | `bash reproduce.sh` in the repository root |
| At least one test on data, workloads or hardware the method never saw | Section 7 (three CPUs, inserts, range scans) |
| AI use is disclosed | Appendix B |

## Appendix D. Detailed write-ups

Each question has a longer write-up with full tables in the repository: `report/objective1_lookup.md` (tuned baselines on synthetic keys), `wp12/README.md` (SOSD results), `report/objective3_counters.md`, `report/objective4_limitations.md` and `report/objective5_hardware.md`.
