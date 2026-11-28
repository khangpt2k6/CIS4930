## 4 Setup

**Table 2. Machines. All runs are single-threaded.**

| Machine | Details | Used for |
|---|---|---|
| AMD laptop, Windows | Ryzen AI 7 350 (4 Zen 5 and 4 Zen 5c cores; 1 MB L2 per core; 16 MB L3); 15.3 GB; Windows 11; MinGW g++ 16.1, `-O3 -march=native`; pinned to one core; AC power (Section 9 notes one exception) | questions 1, 2, 4 |
| AMD laptop, Linux VM | the same laptop; Ubuntu 24.04 under WSL2; g++ 13.3; pinned | question 2 (counters) |
| Intel laptop | Core i7-1355U (2 performance and 8 efficiency cores; 12 MB L3); OS, compiler, pinning and power not recorded | question 4 |
| Apple laptop | M6 MacBook Pro; 16 GB; macOS 27.2; Apple clang 17, `-O3 -mcpu=native`; macOS cannot pin threads | questions 3, 4 |

**Workloads.**

- **SOSD data [2]**, 200M keys each: books (Amazon book popularity), fb (Facebook user IDs), osm (OpenStreetMap cell IDs) and wiki (Wikipedia edit timestamps). We downloaded them from Harvard Dataverse and checked each file's MD5. Duplicate keys are removed, which leaves 200M keys in books, fb and osm and 90.4M in wiki. We also drop one fb key, 2^64 - 1, which PGM-index reserves as a sentinel.
- **Synthetic data**: uniform and lognormal(0, 2) keys from 100K to 100M, generated from fixed seeds.
- **Workloads beyond lookups** (question 3): 10M-key samples of books and osm, and seeded synthetic sets, under mixed lookups and inserts, range scans and bulk loading.
- **Queries**: 2M keys drawn at random from the data (fixed seed). The same queries go to every index.

**Two latency measures.** The *mean* is the time for all 2M lookups in a loop, divided by 2M. Consecutive lookups are independent, so the core can overlap their memory accesses; 1000 / mean is the single-thread throughput in million lookups per second. The *p50* and *p99* time each lookup on its own between serializing timestamp reads. Then lookups cannot overlap, and each pays its full latency. The timer costs 20 to 30 ns, which we measure and subtract, and it ticks in 10 ns steps.

**Runs and checks.** For SOSD, every number is the median of 3 trials. In each trial a mean is the median of 5 timed passes after a warm-up pass, and a percentile is the median of 3 passes over 500K queries. Other experiments state their repeats with their tables. Before timing, an index must return the right position for every query, or the driver stops. Each run folder records the machine, compiler, flags, power source and data checksums, and scripts rebuild every table from the raw files.
