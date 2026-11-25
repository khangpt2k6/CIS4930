// Generates slides/final_presentation.pptx: the team's final deck (WP7 structure).
// Run from slides/src:  node final_presentation.js
// Once teammates start editing the .pptx in PowerPoint, edit the .pptx directly; this script only builds the starting structure.
const pptxgen = require('pptxgenjs');
const path = require('path');
// Optional: a helper that writes THEME's colors into the deck (set PPTX_THEME_HELPER to its path); the deck is fine without it.
let applyTheme = async () => {};
try { if (process.env.PPTX_THEME_HELPER) ({ applyTheme } = require(process.env.PPTX_THEME_HELPER)); } catch (e) { console.warn('theme helper not loaded; skipping'); }
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.title = 'Do Learned Indexes Still Win on Modern Hardware?';
pres.author = 'CIS 4930 Team 01';
const FIG = '../figures/';
const TEAL = '2E8A80', INK = '222222', MUTED = '666666', F = 'Arial', DARK = '17302D', PALE = 'EEF6F5';
const THEME = { name: 'CIS4930 Team 01', colors: { dk1: '222222', lt1: 'FFFFFF', dk2: DARK, lt2: PALE, accent1: TEAL, accent2: '257DE0',
  accent3: 'F47230', accent4: 'F2A600', accent5: '00B894', accent6: 'C0392B', hlink: '257DE0', folHlink: '6D4C9F' } };
pres.theme = { headFontFace: F, bodyFontFace: F };
const FOOTER = { text: 'CIS 4930 · Team 01 · Do learned indexes still win on modern hardware?', options: { x: 0.5, y: 7.15, w: 9, h: 0.25, fontFace: F, fontSize: 9, color: '999999' } };
const SLIDENUM = { x: 12.3, y: 7.15, w: 0.6, h: 0.25, fontFace: F, fontSize: 9, color: '999999', align: 'right' };

pres.defineSlideMaster({ title: 'TITLE', background: { color: DARK },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.2, w: 11.7, h: 1.6, fontFace: F, fontSize: 40, bold: true, color: 'FFFFFF', valign: 'bottom', align: 'left' }, text: '' } },
            { placeholder: { options: { name: 'sub', type: 'body', x: 0.8, y: 4.0, w: 11.7, h: 1.6, fontFace: F, fontSize: 18, color: 'CFE6E3', valign: 'top', align: 'left' }, text: '' } }] });
pres.defineSlideMaster({ title: 'CONTENT', background: { color: 'FFFFFF' }, slideNumber: SLIDENUM,
  objects: [{ text: FOOTER },
            { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontFace: F, fontSize: 28, bold: true, color: INK, margin: 0, align: 'left', valign: 'top' }, text: '' } },
            { placeholder: { options: { name: 'sub', type: 'body', x: 0.5, y: 1.05, w: 12.3, h: 0.35, fontFace: F, fontSize: 13, color: MUTED, margin: 0, align: 'left', valign: 'top' }, text: '' } }] });

const card = (s, x, y, w, h, head, body) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText(head, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.45, fontFace: F, fontSize: 17, bold: true, color: TEAL, margin: 0, isTextBox: true });
  s.addText(body, { x: x + 0.25, y: y + 0.7, w: w - 0.5, h: h - 0.85, fontFace: F, fontSize: 14, color: INK, margin: 0, valign: 'top', isTextBox: true });
};
const placeholderSlide = (sec, tag, what, input) => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: sec });
  s.addText(`[${tag}] Title: the slide's one takeaway`, { placeholder: 'title' });
  s.addText('PLACEHOLDER: to be completed by the ' + tag + ' owner', { placeholder: 'sub' });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.65, w: 8.9, h: 4.9, fill: { color: 'FAFAFA' }, line: { color: 'AAAAAA', width: 1, dashType: 'dash' } });
  s.addText('Chart goes here', { x: 0.5, y: 3.7, w: 8.9, h: 0.6, fontFace: F, fontSize: 18, color: 'AAAAAA', align: 'center', isTextBox: true });
  s.addText([{ text: 'What this slide should show', options: { bold: true, color: TEAL, breakLine: true } }, { text: what, options: { breakLine: true } },
             { text: ' ', options: { breakLine: true } }, { text: 'Available input', options: { bold: true, color: TEAL, breakLine: true } }, { text: input }],
    { x: 9.85, y: 1.65, w: 3.0, h: 4.9, fontFace: F, fontSize: 12.5, color: INK, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes(`Placeholder for ${tag}. Replace the dashed box with the chart, keep the title as a one-sentence takeaway, and put sources in these notes.`);
};

// ---------- Title
{ pres.addSection({ title: 'Introduction' });
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Introduction' });
  s.addText('Do Learned Indexes Still Win on Modern Hardware?', { placeholder: 'title' });
  s.addText([{ text: 'CIS 4930 ML for Computer Systems · Final Project, Team 01', options: { breakLine: true } },
             { text: 'Riyon Praveen · Vishakha Tiwari · Sevara Badriddinova · Tuan Khang Phan', options: { breakLine: true } },
             { text: 'December 2, 2026' }], { placeholder: 'sub' });
  s.addNotes('Team members in alphabetical order by first name, as on the proposal.'); }

// ---------- Motivation
{ const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Introduction' });
  s.addText('A model can replace a tree, but the hardware has changed', { placeholder: 'title' });
  s.addText('Motivation', { placeholder: 'sub' });
  card(s, 0.5, 1.65, 6.0, 2.35, 'Learned indexes [1]', 'Replace a B+tree with a model that predicts where a key sits in a sorted array, then search a small window around the prediction.');
  card(s, 6.85, 1.65, 6.0, 2.35, 'The reported win (2018)', 'Up to 70% faster than cache-optimized B+trees, with an order of magnitude less memory [1].');
  card(s, 0.5, 4.25, 6.0, 2.35, 'What changed since', 'Much larger caches and new architectures (x86 and ARM). Lookup cost depends on how often a lookup waits on main memory.');
  card(s, 6.85, 4.25, 6.0, 2.35, 'Known weak spots', 'Hard-to-model data, insert-heavy workloads, range queries and build time, which headline lookup numbers do not show.');
  s.addNotes('Source: project proposal. [1] Kraska et al., The Case for Learned Index Structures, SIGMOD 2018, doi:10.1145/3183713.3196909.'); }

// ---------- Objectives and setup
{ const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Introduction' });
  s.addText('When and why do learned indexes win on modern hardware?', { placeholder: 'title' });
  s.addText('Five objectives, building on the SOSD benchmark [2]', { placeholder: 'sub' });
  const rows = [['1', 'Lookup performance', 'Average and p99 latency, throughput; 4 SOSD datasets'],
                ['2', 'Memory vs. speed', 'Latency against index size'],
                ['3', 'Hardware counters', 'Cache misses, branch misses, instructions per lookup (perf)'],
                ['4', 'Where learned indexes fall short', 'Hard data, inserts, range scans, build time'],
                ['5', 'Effect of modern hardware', 'x86 vs ARM laptops, in-cache vs out-of-cache sizes']];
  s.addTable(rows.map(r => [{ text: r[0], options: { bold: true, color: 'FFFFFF', fill: { color: TEAL }, align: 'center' } }, { text: r[1], options: { bold: true } }, r[2]]),
    { x: 0.5, y: 1.65, w: 8.2, colW: [0.5, 3.0, 4.7], fontFace: F, fontSize: 14, color: INK, rowH: 0.62, valign: 'middle', border: { type: 'solid', pt: 0.75, color: 'D0D0D0' } });
  card(s, 9.05, 1.65, 3.8, 4.95, 'Indexes', 'Learned: RMI [1], PGM-index [3], RadixSpline [4], ALEX [5]\n\nTraditional: B+tree, hash table, binary search\n\nData: SOSD books, fb, osm, wiki [2]; seeded synthetic uniform and lognormal');
  s.addNotes('References: [2] Marcus et al., PVLDB 14(1) 2020; [3] Ferragina & Vinciguerra, PVLDB 13(8) 2020; [4] Kipf et al., aiDM 2020; [5] Ding et al., SIGMOD 2020. Machines: see the report\'s Experimental Setup.'); }

// ---------- Objectives 1-3: placeholders
pres.addSection({ title: 'Objective 1: Lookup performance' });
placeholderSlide('Objective 1: Lookup performance', 'Objective 1', 'Average lookup latency and throughput of RMI, PGM-index, RadixSpline, B+tree, hash table and binary search on books, fb, osm and wiki.', 'Report section: report/objective1_*.md (to be added).');
placeholderSlide('Objective 1: Lookup performance', 'Objective 1', 'p99 latency per index and dataset; where the tail differs from the average.', 'SOSD reports per-repeat means only; p99 needs per-lookup timing.');
pres.addSection({ title: 'Objective 2: Memory vs. speed' });
placeholderSlide('Objective 2: Memory vs. speed', 'Objective 2', 'Latency vs index size on books and osm (log size axis), one line per index.', 'SOSD multi-configuration runs on the 4 datasets.');
placeholderSlide('Objective 2: Memory vs. speed', 'Objective 2', 'Latency vs index size on fb and wiki; which index is on the Pareto front for each dataset.', 'SOSD multi-configuration runs on the 4 datasets.');
// Slide 1: ARM64 SOSD lookup results
{ const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Objective 2: Memory vs. speed' });
s.addText('ARM64 preview: lookup latency vs index size', { placeholder: 'title' });
s.addText('SOSD on Apple M6, lognormal 1M uint64 keys, 100K lookups (50% unsuccessful), 1 thread, -O3, median of 5 repeats per run, median of 3 trials', { placeholder: 'sub' });

const hdr = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL } } });
const rows = [
  [hdr('Index'), hdr('Best config'), hdr('Latency'), hdr('Size'), hdr('Build')],
  ['RobinHash', 'hash table', '9.7 ns', '64 MiB', '26.1 ms'],
  ['RadixSpline', '17 radix bits', '21.8 ns', '438 KiB', '4.7 ms'],
  ['RadixSpline', '11 radix bits', '22.7 ns', '20 KiB', '4.0 ms'],
  ['STX B+tree', 'every 512th key', '28.4 ns', '36 KiB', '<0.01 ms'],
  ['PGM-index', 'ε = 64', '31.6 ns', '2.3 KiB', '6.3 ms'],
  ['Binary search', 'no index', '49.2 ns', '0', '0'],
];
s.addTable(rows, { x: 0.5, y: 1.65, w: 5.9, colW: [1.45, 1.55, 0.95, 0.95, 1.0], fontFace: 'Arial', fontSize: 13, color: INK,
  border: { type: 'solid', pt: 0.75, color: 'D0D0D0' }, rowH: 0.38, align: 'left', valign: 'middle', margin: 0.06 });

s.addText('Key findings', { x: 0.5, y: 4.55, w: 5.9, h: 0.35, fontFace: 'Arial', fontSize: 16, bold: true, color: TEAL, margin: 0, isTextBox: true });
s.addText([
  { text: 'RadixSpline is the fastest ordered index: 23% below the best B+tree and 31% below the best PGM.', options: { bullet: true, breakLine: true } },
  { text: 'RadixSpline size barely matters: 20 KiB is within 4% of 438 KiB (95% less memory).', options: { bullet: true, breakLine: true } },
  { text: 'A tuned B+tree beats PGM here. The hash table is 2.3× faster still, but has no range queries.', options: { bullet: true } },
], { x: 0.5, y: 4.95, w: 5.9, h: 1.65, fontFace: 'Arial', fontSize: 14, color: INK, paraSpaceAfter: 6, valign: 'top', margin: 0, isTextBox: true });

s.addImage({ path: FIG + 'arm64_sosd_latency_vs_size.png', x: 6.75, y: 1.6, w: 6.1, h: 6.1 * 880 / 1440, altText: 'Median lookup latency versus index size for RadixSpline, PGM-index and STX B+tree, with binary search and RobinHash as references' });
s.addText('Limits: 1M keys only (8 MB of keys), one machine, laptop on battery, macOS cannot pin threads. Input for Objectives 1–2; the four 200M-key SOSD datasets are still to come.',
  { x: 6.75, y: 5.5, w: 6.1, h: 1.1, fontFace: 'Arial', fontSize: 12, color: MUTED, valign: 'top', margin: 0, isTextBox: true });
s.addNotes('Source: sosd-arm64/runs/20261125-100608-release/summary/lookup_pareto.csv and build.csv. Apple M6 MacBook Pro (Mac18,1), 16 GB, macOS 27.2.1, Apple clang 17, SOSD arm64-support 28b078c, flags -O3 -DNDEBUG -march=native. Latency = median over 3 trials of the per-trial median of 5 repeats. Build time from --build mode, median of 3 trials. B+tree "every 512th key" = SOSD size_scale 512 (sparse tree plus last-mile binary search).');
}


pres.addSection({ title: 'Objective 3: Hardware counters' });
placeholderSlide('Objective 3: Hardware counters', 'Objective 3', 'LLC misses, branch misses and instructions per lookup per index, at an in-cache size and at 200M keys.', 'Needs native Linux (perf). Not measurable on the Apple laptop.');
placeholderSlide('Objective 3: Hardware counters', 'Objective 3', 'How the counters explain the Objective 1 and 5 gaps (e.g. misses per lookup vs latency).', 'Objective 1 latencies; Objective 5 in-cache vs out-of-cache results.');

pres.addSection({ title: 'Objective 4: Where learned indexes fall short' });
const title = (s, t, sub) => { s.addText(t, { placeholder: 'title' }); s.addText(sub, { placeholder: 'sub' }); };
const stat = (s, x, y, big, small) => {
  s.addText(big, { x, y, w: 2.9, h: 0.6, fontFace: F, fontSize: 30, bold: true, color: TEAL, margin: 0, isTextBox: true });
  s.addText(small, { x, y: y + 0.6, w: 2.9, h: 0.75, fontFace: F, fontSize: 12.5, color: INK, margin: 0, valign: 'top', isTextBox: true });
};
const foot = (s, t) => s.addText(t, { x: 0.5, y: 6.72, w: 12.3, h: 0.4, fontFace: F, fontSize: 10.5, color: MUTED, margin: 0, isTextBox: true });
const FOOT = 'Apple M6, -O3, single thread, median of 3 trials, AC power. books and osm from SOSD, 10M distinct keys sampled from 800M. ALEX ported to ARM64 (42/42 unit tests pass). All indexes returned identical checksums.';

// Slide 1: hard data + inserts
let s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Objective 4: Where learned indexes fall short' });
title(s, 'Hard-to-model keys and inserts erase ALEX’s lead',
  'Bulk-load half the keys, then 2M operations mixing lookups and inserts: easy (books) vs hard (osm) real data');
s.addImage({ path: FIG + 'wp4_mixed_books_osm.png', x: 0.5, y: 1.6, w: 8.9, h: 8.9 * 760 / 1800, altText: 'Throughput versus insert percentage for ALEX, Dynamic PGM and STX B+tree on books and osm data' });
stat(s, 9.85, 1.65, '6.2× → 1.9×', 'ALEX over the B+tree with no inserts, books → osm');
stat(s, 9.85, 3.15, '1.04×', 'ALEX over the B+tree at 90% inserts on osm: a tie');
stat(s, 9.85, 4.65, '2.2×', 'Dynamic PGM over ALEX at 90% inserts on osm');
s.addText('On books ALEX leads at every mix. On osm, Dynamic PGM wins once half the operations are inserts.',
  { x: 0.5, y: 5.6, w: 8.9, h: 0.9, fontFace: F, fontSize: 15, color: INK, margin: 0, valign: 'top', isTextBox: true });
foot(s, FOOT);
s.addNotes('Source: wp4/runs/20261125-111310-m6/summary/wp4_summary.csv (mixed rows). M ops/s, books/osm. 0%: ALEX 43.8/15.4, B+tree 7.1/8.0, DynPGM 18.1/14.2. 10%: 36.2/12.8, 6.4/6.6, 7.8/6.5. 50%: 16.0/6.9, 5.9/4.9, 8.6/7.4. 90%: 13.0/5.7, 5.2/5.5, 12.7/12.4. Synthetic uniform and lognormal behave like books (report Table 4.1). Inserts are random keys from the same dataset; no sequential inserts or deletes tested. Replicated on battery for synthetic data (median difference 3.4%).');

// Slide 2: range scans + build
s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Objective 4: Where learned indexes fall short' });
title(s, 'Learned indexes find where a range starts; ALEX builds slowly',
  'Range scans of 10, 100 and 1000 keys, and bulk-load time for all 10M keys');
s.addImage({ path: FIG + 'wp4_range_books_osm.png', x: 0.5, y: 1.6, w: 7.2, h: 7.2 * 760 / 1800, altText: 'Range query time versus scan length on books and osm for ALEX, B+tree, static PGM and Dynamic PGM' });
s.addImage({ path: FIG + 'wp4_build_4datasets.png', x: 7.95, y: 1.5, w: 4.9, h: 4.9 * 840 / 1280, altText: 'Bulk-load time per index on books, osm, uniform and lognormal data' });
s.addText([
  { text: 'Short scans (10 keys) on books: ALEX is fastest, 2.6× faster than the B+tree.', options: { bullet: true, breakLine: true } },
  { text: 'On osm, ALEX loses to the B+tree at 100 and 1000 keys (1,529 vs 1,028 ns). A static PGM over a plain array is 1.7–2.8× faster than ALEX at 1000 keys.', options: { bullet: true } },
], { x: 0.5, y: 4.8, w: 7.2, h: 1.9, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 6, margin: 0, valign: 'top', isTextBox: true });
s.addText([
  { text: 'ALEX builds 44× slower than the B+tree on books and 76× on osm.', options: { bullet: true, breakLine: true } },
  { text: 'osm slows every learned build 1.8–2.0×; the B+tree barely changes.', options: { bullet: true } },
], { x: 7.95, y: 4.85, w: 4.9, h: 1.85, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 6, margin: 0, valign: 'top', isTextBox: true });
foot(s, FOOT);
s.addNotes('Range ns/query (books/osm). L=10: ALEX 73/158, B+tree 188/198, PGM 94/122, DynPGM 222/275. L=100: ALEX 265/407, B+tree 320/349, PGM 169/195. L=1000: ALEX 861/1529, B+tree 917/1028, PGM 498/550, DynPGM 3546/3615. Build ms (books/osm/uniform/lognormal): B+tree 18/19/23/17, PGM 51/104/55/55, DynPGM 72/129/87/86, ALEX 781/1419/317/1365. Lognormal makes ALEX build as slowly as osm, yet its lookups stay fast, so build cost and lookup difficulty are separate signals. Static PGM eps=64; others library defaults.');

// Objective 5 (compare CPUs)
pres.addSection({ title: 'Objective 5: Effect of modern hardware' });
const FOOT5 = 'learned-index-bench: 2M random lookups of existing keys, median of 5 runs after a warm-up. RMI = fastest of 4 leaf counts. Ryzen run pinned; M6 unpinned, on battery. No Intel CSV yet.';
s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Objective 5: Effect of modern hardware' });
title(s, 'M6 is 4–5× faster in cache, under 2× in memory',
  'Lookup latency vs key count, AMD Ryzen AI 7 350 (x86) vs Apple M6 (ARM), uniform and lognormal keys');
s.addImage({ path: FIG + 'wp5_latency_vs_keys.png', x: 0.5, y: 1.55, w: 8.9, h: 8.9 * 1302 / 2845, altText: 'Lookup latency versus number of keys for binary search and RMI on the Ryzen and the M6' });
stat(s, 9.85, 1.65, '4.0–5.1×', 'M6 over Ryzen for binary search, up to 1M keys (fits in cache)');
stat(s, 9.85, 3.15, '1.7–1.8×', 'M6 over Ryzen for binary search at 100M keys (main memory)');
stat(s, 9.85, 4.65, '1.8–2.4×', 'M6 over Ryzen for the RMI at 100M keys');
s.addText('Past the cache limit (dotted lines), main memory sets the pace, and the two laptops move closer together.',
  { x: 0.5, y: 5.85, w: 8.9, h: 0.7, fontFace: F, fontSize: 15, color: INK, margin: 0, valign: 'top', isTextBox: true });
foot(s, FOOT5);
s.addNotes('Source: report/figures/wp5/wp5_summary.csv (from learned-index-bench/compare_cpus.py). Binary search ns Ryzen/M6: uniform 100K 103.4/25.5, 1M 158.6/37.4, 100M 525.5/290.8; lognormal 100K 99.9/24.7, 1M 156.0/30.9, 100M 514.8/303.8. Best RMI at 100M: uniform 81.1/33.9, lognormal 131.8/75.3. LLC: Ryzen 16 MB L3 (README), M6 20 MB L2 (sysctl). Ryzen OS/compiler/power not recorded; its unpinned rerun was up to 1.59x slower, so ratios under ~1.5x are uncertain.');

s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Objective 5: Effect of modern hardware' });
title(s, 'Learned wins grow with size; small wins depend on CPU',
  'RMI speedup over binary search on each CPU (above 1 = learned index faster)');
s.addImage({ path: FIG + 'wp5_rmi_speedup.png', x: 0.5, y: 1.55, w: 8.9, h: 8.9 * 1092 / 2845, altText: 'RMI speedup over binary search versus number of keys on the Ryzen and the M6' });
stat(s, 9.85, 1.65, '6.5× vs 8.6×', 'RMI speedup at 100M uniform keys, Ryzen vs M6');
stat(s, 9.85, 3.15, '0.95×', 'RMI vs binary search on the M6, lognormal 100K and 1M: the RMI loses');
stat(s, 9.85, 4.65, '1.4–1.8×', 'Same lognormal sizes on the Ryzen: the RMI still wins');
s.addText([
  { text: 'On both CPUs the speedup climbs once keys exceed the cache.', options: { bullet: true, breakLine: true } },
  { text: 'An inaccurate model (lognormal, last-mile search over ~128–512 keys) cannot beat the M6’s fast in-cache binary search.', options: { bullet: true } },
], { x: 0.5, y: 5.15, w: 8.9, h: 1.5, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 6, margin: 0, valign: 'top', isTextBox: true });
foot(s, FOOT5);
s.addNotes('Speedup = binary search / best RMI. Uniform Ryzen 3.3, 3.8, 5.7, 6.4, 6.5; M6 2.5, 3.5, 5.7, 8.0, 8.6 (100K..100M). Lognormal Ryzen 1.4, 1.8, 2.6, 3.4, 3.9; M6 0.95, 0.95, 1.9, 3.1, 4.0. M6 lognormal 100K: RMI 26.1 ns vs binary search 24.7 ns; 1M: 32.3 vs 30.9.');

// ---------- Conclusion
pres.addSection({ title: 'Conclusion' });
{ const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Conclusion' });
  s.addText('Learned indexes still win, but only under the right conditions', { placeholder: 'title' });
  s.addText('Conclusion (draft: Objectives 4–5 in; Objectives 1–3 to be added)', { placeholder: 'sub' });
  card(s, 0.5, 1.65, 6.0, 3.0, 'When they win', 'Data larger than the cache: RMI beats binary search by 6.5× (x86) and 8.6× (ARM) at 100M uniform keys.\nRead-mostly, easy-to-model data: ALEX is 4.3–6.2× faster than a B+tree.');
  card(s, 6.85, 1.65, 6.0, 3.0, 'When they do not', 'Hard data (osm): ALEX’s lead falls to 1.9×, and it ties the B+tree at 90% inserts.\nIn cache on the M6: RMI is 5% slower than binary search on lognormal keys.\nLong scans and bulk loads favour simpler structures.');
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.9, w: 12.35, h: 1.7, fill: { color: 'FAFAFA' }, line: { color: 'AAAAAA', width: 1, dashType: 'dash' } });
  s.addText('[TODO: Objectives 1–3] Add the lookup, memory and hardware-counter conclusions here, and the answer to “do the conclusions of [1] still hold?”', { x: 0.75, y: 5.05, w: 11.9, h: 1.4, fontFace: F, fontSize: 14, italic: true, color: MUTED, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes('Numbers: report Objective 4 (Tables 4.1–4.3) and Objective 5 (Table 5.1). Keep in sync with the report\'s Conclusion.'); }
{ const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: 'Conclusion' });
  s.addText('Questions?', { placeholder: 'title' });
  s.addText('Code, data and results: github.com/khangpt2k6/CIS4930', { placeholder: 'sub' }); }

(async () => {
  await pres.writeFile({ fileName: '../final_presentation.pptx' });
  await applyTheme('../final_presentation.pptx', THEME);
  console.log('written ../final_presentation.pptx');
})();
