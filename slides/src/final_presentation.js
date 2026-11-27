// Generates slides/final_presentation.pptx, the team's final deck.
// Run from slides/src:  node final_presentation.js
// Needs: npm install pptxgenjs react react-dom react-icons sharp   (icons are rendered to PNG with sharp)
// Optional: set PPTX_THEME_HELPER to the pptx skill's scripts/apply_theme.js to embed the palette in the theme.
// Structure follows the course rubric: six questions (better? why? where it fails? transfer? cost? use?).
// Learned indexes are drawn in warm colors (HOT, AMBER) and traditional ones in cool colors (COOL) on every chart.
// Every number on a slide has its source in that slide's speaker notes.
const pptxgen = require('pptxgenjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const Lu = require('react-icons/lu');

let applyTheme = async () => {};
try { if (process.env.PPTX_THEME_HELPER) ({ applyTheme } = require(process.env.PPTX_THEME_HELPER)); } catch (e) { console.warn('theme helper not loaded; skipping'); }

// ---------- palette and type
const NIGHT = '0E1726', NIGHT2 = '1B2840', INK = '162033', BODY = '2A3447', MUTED = '5E6B80', FAINT = '98A3B5';
const LINE = 'DDE2EA', TINT = 'F2F5F9', WHITE = 'FFFFFF', HOT = 'E4572E', HOTSOFT = 'FCEAE4', AMBER = 'F2A541';
const COOL = '3B6EA8', COOL2 = '8FA9C9', COOLSOFT = 'E8EEF6', ONDARK = 'C9D3E3', X86 = '33415C', ARM = '1F8A70';
const HF = 'Cambria', BF = 'Calibri';
const THEME = { name: 'Learned Indexes', headFontFace: HF, bodyFontFace: BF,
  colors: { dk1: INK, lt1: WHITE, dk2: NIGHT, lt2: TINT, accent1: HOT, accent2: AMBER, accent3: COOL, accent4: COOL2,
            accent5: ARM, accent6: X86, hlink: COOL, folHlink: '6D4C9F' } };
const FIG = '../figures/';
const OUT = '../final_presentation.pptx';
const QUESTIONS = ['Is it better?', 'Why does it win?', 'Where does it fail?', 'Does it transfer?', 'What does it cost?', 'Would anyone use it?'];

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pres.title = 'Do Learned Indexes Still Win on Modern Hardware?';
pres.author = 'CIS 4930 Team 01';
pres.theme = { headFontFace: HF, bodyFontFace: BF };

// ---------- layouts
pres.defineSlideMaster({ title: 'DARK', background: { color: NIGHT }, objects: [] });
pres.defineSlideMaster({ title: 'CONTENT', background: { color: WHITE },
  slideNumber: { x: 12.1, y: 7.02, w: 0.63, h: 0.25, fontFace: BF, fontSize: 9, color: FAINT, align: 'right' },
  objects: [
    { text: { text: 'Do learned indexes still win on modern hardware?   ·   CIS 4930 Team 01',
              options: { x: 0.6, y: 7.02, w: 8, h: 0.25, fontFace: BF, fontSize: 9, color: FAINT, margin: 0 } } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.88, w: 12.13, h: 0.62, fontFace: HF, fontSize: 30,
                                bold: true, color: INK, margin: 0, align: 'left', valign: 'top' }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.6, y: 1.5, w: 12.13, h: 0.36, fontFace: BF, fontSize: 14,
                                color: MUTED, margin: 0, align: 'left', valign: 'top' }, text: '' } }] });

// ---------- helpers
const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BF, fontSize: 14, color: BODY, valign: 'top' }, o));
const ICONS = {};
async function loadIcons(spec) { // spec: { key: [IconName, hexColor] }
  for (const [key, [name, color]] of Object.entries(spec)) {
    const svg = renderToStaticMarkup(React.createElement(Lu[name], { size: 256, color: '#' + color }));
    const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    ICONS[key] = 'image/png;base64,' + buf.toString('base64');
  }
}
const icon = (s, key, x, y, d, bg) => {
  if (bg) s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg } });
  const p = bg ? d * 0.24 : 0;
  s.addImage({ data: ICONS[key], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
};
const badge = (s, label, dark) => {
  const w = 0.42 + label.length * 0.093;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.42, w, h: 0.32, rectRadius: 0.16,
    fill: { color: dark ? NIGHT2 : HOTSOFT }, line: { color: dark ? NIGHT2 : HOTSOFT } });
  T(s, label, { x: 0.6, y: 0.42, w, h: 0.32, fontSize: 10.5, bold: true, color: dark ? AMBER : HOT, align: 'center', valign: 'middle', charSpacing: 1 });
};
const content = (sec, badgeText, title, sub) => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: sec });
  badge(s, badgeText);
  s.addText(title, { placeholder: 'title' });
  if (sub) s.addText(sub, { placeholder: 'sub' });
  return s;
};
const source = (s, text) => T(s, text, { x: 0.6, y: 6.68, w: 12.13, h: 0.3, fontSize: 10, color: MUTED, valign: 'bottom' });
const stat = (s, x, y, w, big, label, color) => {
  T(s, big, { x, y, w, h: 0.62, fontFace: HF, fontSize: 32, bold: true, color: color || HOT, valign: 'bottom' });
  T(s, label, { x, y: y + 0.68, w, h: 0.7, fontSize: 13, color: BODY });
};
const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || TINT }, line: { color: fill || TINT } });
const chip = (s, x, y, color, label) => { // legend chip: colored square + label
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + 0.05, w: 0.18, h: 0.18, rectRadius: 0.04, fill: { color }, line: { color } });
  T(s, label, { x: x + 0.26, y, w: 2.2, h: 0.28, fontSize: 12, color: BODY, valign: 'middle' });
};
// The motif: a sorted array with a predicted position and its search window, as a learned index sees it.
const arrayStrip = (s, x, y, n, cw, gap, w0, w1, hit, base, winFill) => {
  for (let i = 0; i < n; i++) {
    const c = i === hit ? HOT : (i >= w0 && i <= w1 ? winFill : base);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + i * (cw + gap), y, w: cw, h: cw, rectRadius: 0.04, fill: { color: c }, line: { color: c } });
  }
};
const progress = (s, active) => { // six-question tracker on divider slides
  QUESTIONS.forEach((q, i) => {
    const on = active.includes(i), x = 0.6 + i * 2.045;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 6.35, w: 1.9, h: 0.5, rectRadius: 0.25, fill: { color: on ? HOT : NIGHT2 }, line: { color: on ? HOT : NIGHT2 } });
    T(s, q, { x, y: 6.35, w: 1.9, h: 0.5, fontSize: 11.5, bold: on, color: on ? WHITE : 'B4BED0', align: 'center', valign: 'middle' });
  });
};
const divider = (sec, num, question, sub, active) => {
  pres.addSection({ title: sec });
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: sec });
  T(s, num, { x: 0.6, y: 1.2, w: 4, h: 1.9, fontFace: HF, fontSize: 120, bold: true, color: HOT, valign: 'bottom' });
  T(s, question, { x: 0.6, y: 3.25, w: 12, h: 1.0, fontFace: HF, fontSize: 48, bold: true, color: WHITE, valign: 'top' });
  T(s, sub, { x: 0.6, y: 4.35, w: 10.5, h: 0.9, fontSize: 18, color: ONDARK });
  progress(s, active);
  return s;
};
// Charts: every chart shares one label style.
const axis = (o) => Object.assign({
  catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontFace: BF, valAxisLabelFontFace: BF,
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLineShow: true, catAxisLineColor: LINE, valAxisLineShow: false,
  valGridLine: { color: 'E6EAF0', size: 0.75 }, catGridLine: { style: 'none' },
  dataLabelFontFace: BF, dataLabelFontSize: 10, dataLabelColor: BODY,
  showLegend: false, legendFontFace: BF, legendFontSize: 12, legendColor: BODY,
  valAxisTitleFontFace: BF, valAxisTitleFontSize: 11, valAxisTitleColor: MUTED, catAxisTitleFontFace: BF, catAxisTitleFontSize: 11, catAxisTitleColor: MUTED,
}, o);

// ---------- data (copied from the summary CSVs named in each slide's notes)
const WP4 = { // M ops/s at 0, 10, 50, 90% inserts
  books: { ALEX: [43.838, 36.223, 15.968, 13.041], DynPGM: [18.051, 7.79, 8.631, 12.693], BTree: [7.123, 6.383, 5.897, 5.238] },
  osm: { ALEX: [15.439, 12.819, 6.846, 5.724], DynPGM: [14.228, 6.472, 7.434, 12.439], BTree: [7.951, 6.557, 4.925, 5.491] },
  rangeOsm: { ALEX: [157.515, 407.135, 1529.448], PGM: [122.028, 194.863, 549.729], BTree: [198.139, 349.301, 1028.165] },
  build: { books: [17.77, 51.46, 71.57, 781.34], osm: [18.67, 103.54, 128.98, 1418.63] }, // B+tree, PGM, DynPGM, ALEX (ms, 10M keys)
};
const SIZES = ['100K', '1M', '10M', '50M', '100M'];
const WP5 = { // ns per lookup: [binary search], [best RMI]
  ryzen: { uni: { bs: [103.41, 158.61, 320.13, 458.77, 525.48], rmi: [31.71, 41.93, 56.32, 72.22, 81.13] },
           logn: { bs: [99.9, 155.97, 314.45, 449.13, 514.78], rmi: [70.2, 88.03, 119.66, 130.8, 131.81] } },
  m6: { uni: { bs: [25.46, 37.37, 134.88, 254.76, 290.81], rmi: [10.09, 10.73, 23.82, 31.99, 33.91] },
        logn: { bs: [24.71, 30.85, 97.2, 218.71, 303.76], rmi: [26.05, 32.31, 52.33, 71.55, 75.27] } },
  intel: { uni: { bs: [119.2, 214.95, 1019.51, 1363.1, 1691.75], rmi: [39.76, 48.81, 108.01, 175.26, 180.51] },
           logn: { bs: [121.1, 232.08, 955.3, 1283.19, 1642.4], rmi: [86.89, 110.6, 193.59, 253.31, 278.94] } },
};
const INTEL = '8E6BBF';
const ratio = (a, b) => a.map((v, i) => +(v / b[i]).toFixed(2));

// SOSD results (questions 1 and 2) are read straight from the summary CSVs, so the slides cannot drift from the data.
const fs = require('fs');
const readCsv = (p) => {
  const [head, ...lines] = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const H = head.split(',');
  return lines.map(l => { const c = l.split(','); return Object.fromEntries(H.map((k, i) => [k, c[i] !== '' && !isNaN(+c[i]) ? +c[i] : c[i]])); });
};
const SOSD_ROWS = readCsv('../../report/figures/objective1/wp12_summary.csv');
const SOSD_DS = [['books_200M_uint64', 'books'], ['fb_200M_uint64', 'fb'], ['osm_cellids_200M_uint64', 'osm'], ['wiki_ts_200M_uint64', 'wiki']];
const LEARNED_IDX = ['rmi', 'pgm', 'radixspline'];
const NONLEARNED_IDX = ['binary_search', 'binary_search_branchless', 'interpolation', 'eytzinger', 'btree'];
const bestOf = (ds, idxs, maxBytes = Infinity) => SOSD_ROWS.filter(r => r.dataset === ds && idxs.includes(r.index) && r.bytes <= maxBytes)
  .reduce((a, r) => (!a || r.mean_ns < a.mean_ns ? r : a), null);
const IDX_NAME = { binary_search: 'std::lower_bound', binary_search_branchless: 'branchless binary search', interpolation: 'interpolation search',
  eytzinger: 'Eytzinger layout', btree: 'B+tree', rmi: 'RMI', pgm: 'PGM-index', radixspline: 'RadixSpline', oracle: 'oracle' };
const fmtBytes = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(b >= 1e7 ? 0 : 1) + ' MB' : b >= 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B';

async function build() {
  await loadIcons({
    cpu: ['LuCpu', HOT], db: ['LuDatabase', HOT], layers: ['LuLayers', HOT], brain: ['LuBrain', HOT], alert: ['LuTriangleAlert', HOT],
    help: ['LuCircleHelp', HOT], chart: ['LuChartColumn', FAINT], server: ['LuServer', HOT], shield: ['LuShieldCheck', HOT],
    refresh: ['LuRefreshCw', HOT], ban: ['LuBan', HOT], gauge: ['LuGauge', HOT], laptop: ['LuLaptop', HOT],
    checkD: ['LuCheck', AMBER], xD: ['LuX', COOL2], zapD: ['LuZap', AMBER], scale: ['LuScale', HOT], coins: ['LuCoins', HOT],
    search: ['LuSearch', HOT], memory: ['LuMemoryStick', HOT], fork: ['LuGitFork', HOT], ruler: ['LuRuler', HOT],
  });

  // ================= 1. Title
  pres.addSection({ title: 'Introduction' });
  { const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Introduction' });
    T(s, 'CIS 4930  ·  MACHINE LEARNING FOR COMPUTER SYSTEMS  ·  FALL 2026', { x: 0.6, y: 0.7, w: 12, h: 0.3, fontSize: 12, bold: true, color: AMBER, charSpacing: 2 });
    T(s, 'Do Learned Indexes Still Win on Modern Hardware?', { x: 0.6, y: 1.35, w: 10.2, h: 2.1, fontFace: HF, fontSize: 48, bold: true, color: WHITE, valign: 'bottom' });
    T(s, 'RMI, PGM-index, RadixSpline and ALEX against classic indexes, on x86 and ARM laptops', { x: 0.6, y: 3.65, w: 10.5, h: 0.5, fontSize: 20, color: ONDARK });
    T(s, [{ text: 'Team 01', options: { bold: true, color: WHITE } }, { text: '   Riyon Praveen  ·  Vishakha Tiwari  ·  Sevara Badriddinova  ·  Tuan Khang Phan', options: { color: ONDARK } }],
      { x: 0.6, y: 4.65, w: 12, h: 0.35, fontSize: 15 });
    T(s, 'December 2, 2026', { x: 0.6, y: 5.05, w: 6, h: 0.3, fontSize: 13, color: FAINT });
    arrayStrip(s, 0.6, 6.25, 32, 0.32, 0.067, 18, 24, 21, NIGHT2, '5A2A22');
    T(s, 'predicted position, then a small search window', { x: 0.6 + 18 * 0.387, y: 5.85, w: 7 * 0.387 + 1.5, h: 0.3, fontSize: 11, italic: true, color: AMBER });
    s.addNotes('Team members in alphabetical order by first name, as on the proposal. The strip at the bottom is the deck motif: a sorted array, the position a learned index predicts (solid), and the small window it then searches.'); }

  // ================= 2. Motivation
  { const s = content('Introduction', 'MOTIVATION', 'A model beat the B+tree in 2018. Does it still win?');
    card(s, 0.6, 1.75, 4.9, 4.85, NIGHT);
    T(s, 'THE 2018 CLAIM [1]', { x: 0.95, y: 2.05, w: 4.2, h: 0.3, fontSize: 12, bold: true, color: AMBER, charSpacing: 1.5 });
    T(s, '70%', { x: 0.95, y: 2.75, w: 4.2, h: 1.0, fontFace: HF, fontSize: 60, bold: true, color: WHITE, valign: 'bottom' });
    T(s, 'faster than a cache-optimized B+tree', { x: 0.95, y: 3.8, w: 4.2, h: 0.35, fontSize: 15, color: ONDARK });
    T(s, '10×', { x: 0.95, y: 4.65, w: 4.2, h: 1.0, fontFace: HF, fontSize: 60, bold: true, color: WHITE, valign: 'bottom' });
    T(s, 'less memory, up to an order of magnitude', { x: 0.95, y: 5.7, w: 4.2, h: 0.35, fontSize: 15, color: ONDARK });
    const rows = [
      ['cpu', 'The hardware changed', 'Caches are much larger, and ARM now sits next to x86. A lookup mostly waits on main memory, so the hardware decides the cost.'],
      ['alert', 'Headlines hide weak spots', 'Hard-to-model data, insert-heavy workloads, range scans and build time do not show up in lookup averages.'],
      ['help', 'Our question', 'When, and why, do learned indexes outperform traditional indexes on 2026 laptops?'],
    ];
    rows.forEach(([ic, head, body], i) => {
      const y = 1.85 + i * 1.6;
      icon(s, ic, 5.95, y, 0.75, HOTSOFT);
      T(s, head, { x: 6.95, y: y - 0.02, w: 5.78, h: 0.4, fontFace: HF, fontSize: 19, bold: true, color: INK });
      T(s, body, { x: 6.95, y: y + 0.42, w: 5.78, h: 0.95, fontSize: 14, color: BODY });
    });
    s.addNotes('Source: project proposal and [1] Kraska et al., The Case for Learned Index Structures, SIGMOD 2018, doi:10.1145/3183713.3196909. "Up to 70% faster than cache-optimized B+trees while using an order of magnitude less memory."'); }

  // ================= 3. How a learned index works
  { const s = content('Introduction', 'BACKGROUND', 'Learned indexes predict a position, then search nearby');
    const lane = (y, label, sub, color) => {
      T(s, label, { x: 0.6, y, w: 2.3, h: 0.4, fontFace: HF, fontSize: 19, bold: true, color });
      T(s, sub, { x: 0.6, y: y + 0.45, w: 2.2, h: 0.9, fontSize: 13, color: MUTED });
    };
    const arrow = (x, y, w) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: FAINT, width: 1.75, endArrowType: 'triangle' } });
    const pill = (x, y, w, h, text, fill, color) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill } });
      T(s, text, { x, y, w, h, fontSize: 14, bold: true, color, align: 'center', valign: 'middle' });
    };
    // traditional lane
    card(s, 0.6, 1.95, 12.13, 2.05, TINT);
    lane(2.15, 'B+tree', 'Traditional: walk the tree, one node per level', COOL);
    pill(3.2, 2.55, 1.05, 0.6, 'key', WHITE, INK);
    arrow(4.3, 2.85, 0.55);
    ['root', 'inner node', 'leaf'].forEach((t, i) => { pill(4.95 + i * 2.0, 2.55, 1.45, 0.6, t, COOLSOFT, COOL); if (i < 2) arrow(6.45 + i * 2.0, 2.85, 0.45); });
    arrow(10.45, 2.85, 0.45);
    pill(11.0, 2.55, 1.5, 0.6, 'position', WHITE, INK);
    T(s, 'Each level is a dependent memory access. Once the tree is larger than the cache, each one can wait on DRAM.', { x: 3.2, y: 3.32, w: 9.3, h: 0.5, fontSize: 13, color: MUTED });
    // learned lane
    card(s, 0.6, 4.2, 12.13, 2.4, TINT);
    lane(4.4, 'Learned index', 'Predict where the key sits in the sorted array', HOT);
    pill(3.2, 4.85, 1.05, 0.6, 'key', WHITE, INK);
    arrow(4.3, 5.15, 0.55);
    pill(4.95, 4.75, 2.05, 0.8, 'model\nf(key) ≈ position', HOT, WHITE);
    arrow(7.05, 5.15, 0.5);
    arrayStrip(s, 7.7, 4.95, 12, 0.36, 0.05, 4, 8, 6, WHITE, 'F7C6B6');
    T(s, 'search ± ε', { x: 7.7 + 4 * 0.41, y: 5.38, w: 5 * 0.41, h: 0.3, fontSize: 12, bold: true, color: HOT, align: 'center' });
    T(s, 'A wrong prediction costs time, never correctness: the last-mile search still finds the key.', { x: 3.2, y: 5.85, w: 9.3, h: 0.5, fontSize: 13, color: MUTED });
    s.addNotes('RMI [1]: a top model routes the key to one of many small linear models, which predict the position. PGM-index [3]: piecewise linear segments with error bounded by epsilon. RadixSpline [4]: a spline plus a radix table over key prefixes. ALEX [5]: an updatable tree of models over gapped arrays. In every case a bounded search around the prediction corrects the error.'); }

  // ================= 4. Roadmap
  { const s = content('Introduction', 'ROADMAP', 'Six questions frame our five objectives');
    const items = [
      ['Objectives 1 and 2', 'Tuned baselines and an oracle; latency, tail latency, memory'],
      ['Objective 3', 'Hardware counters: branch misses, DRAM fills, page walks'],
      ['Objective 4', 'Hard-to-model data, inserts, range scans'],
      ['Objective 5', 'x86 vs ARM laptops, in-cache vs main-memory sizes'],
      ['Cost', 'Build time against lookup savings: the break-even point'],
      ['Deployment', 'Where it would run, and what happens when it is wrong'],
    ];
    items.forEach(([obj, body], i) => {
      const x = 0.6 + (i % 3) * 4.14, y = 1.95 + Math.floor(i / 3) * 2.4, w = 3.85, h = 2.15;
      card(s, x, y, w, h);
      T(s, String(i + 1).padStart(2, '0'), { x: x + 0.3, y: y + 0.22, w: 0.9, h: 0.5, fontFace: HF, fontSize: 26, bold: true, color: HOT });
      T(s, QUESTIONS[i], { x: x + 1.0, y: y + 0.29, w: w - 1.15, h: 0.45, fontFace: HF, fontSize: 18, bold: true, color: INK });
      T(s, obj, { x: x + 0.3, y: y + 0.92, w: w - 0.6, h: 0.3, fontSize: 12, bold: true, color: HOT, charSpacing: 0.5 });
      T(s, body, { x: x + 0.3, y: y + 1.22, w: w - 0.6, h: 0.8, fontSize: 14, color: BODY });
    });
    s.addNotes('The six questions come from the course\'s final project expectations. Each later section answers one of them; the badge at the top of each slide names the question that slide answers.'); }

  // ================= 5. Setup
  { const s = content('Introduction', 'SETUP', 'Three laptops, nine indexes, real and synthetic keys');
    const cols = [
      ['laptop', 'Machines', [['AMD Ryzen AI 7 350', 'x86-64, 16 MB L3, Windows; Linux VM for counters'], ['Intel Core i7-1355U', 'x86-64, 12 MB L3, Objective 5'], ['Apple M6', 'ARM64, 16 GB, macOS, Apple clang 17']]],
      ['layers', 'Indexes', [['Learned', 'RMI, PGM-index, RadixSpline, ALEX'], ['Traditional, tuned', 'B+tree, binary search with and without branches, Eytzinger layout, interpolation search, oracle']]],
      ['db', 'Data', [['SOSD real data [2]', 'books, fb, osm, wiki (200M keys)'], ['Synthetic', 'uniform and lognormal, 100K to 100M keys, fixed seeds']]],
    ];
    cols.forEach(([ic, head, rows], i) => {
      const x = 0.6 + i * 4.14, w = 3.85;
      card(s, x, 1.95, w, 3.75);
      icon(s, ic, x + 0.3, 2.2, 0.62, HOTSOFT);
      T(s, head, { x: x + 1.05, y: 2.3, w: w - 1.3, h: 0.45, fontFace: HF, fontSize: 20, bold: true, color: INK });
      rows.forEach(([a, b], j) => {
        const y = 3.1 + j * 0.85;
        const col = a === 'Learned' ? HOT : a === 'Traditional' ? COOL : INK;
        T(s, a, { x: x + 0.3, y, w: w - 0.6, h: 0.3, fontSize: 14, bold: true, color: col });
        T(s, b, { x: x + 0.3, y: y + 0.3, w: w - 0.6, h: 0.55, fontSize: 13, color: BODY });
      });
    });
    card(s, 0.6, 5.95, 12.13, 0.68, NIGHT);
    [['Single thread', 2.2], ['Median of 3 trials', 2.6], ['Every number checked against raw logs', 4.0], ['Same checksum from every index', 3.3]].reduce((x, [t, w]) => {
      icon(s, 'checkD', x, 6.12, 0.34);
      T(s, t, { x: x + 0.45, y: 5.95, w: w - 0.5, h: 0.68, fontSize: 13, bold: true, color: WHITE, valign: 'middle' });
      return x + w;
    }, 0.9);
    s.addNotes('Machines: see the report\'s Experimental Setup. Objective 3 ran in Ubuntu 24.04 under WSL2 on the Ryzen (g++ 13.3, perf_event_open). The SOSD ARM64 port builds RadixSpline, PGM-index, STX B+tree, RobinHash and binary search; RMI, ALEX and others need x86-only code. ALEX was patched for ARM64 (42/42 unit tests pass). The Intel i7-1355U results (pushed Nov 25) are in the Objective 5 slides; its run conditions (pinning, power, compiler) still need to be recorded. References: [2] Marcus et al., PVLDB 14(1) 2020; [3] Ferragina and Vinciguerra, PVLDB 13(8) 2020; [4] Kipf et al., aiDM 2020; [5] Ding et al., SIGMOD 2020.'); }

  // ================= Q1: Is it better?
  const S1 = 'Q1: Is it better?';
  divider(S1, '01', 'Is it better?', 'Objectives 1 and 2: the RMI against tuned non-learned search and an oracle, then lookup speed and memory on four SOSD datasets', [0]);
  { const s = content(S1, 'Q1  ·  IS IT BETTER?', 'Against a tuned baseline, the RMI\'s lead shrinks to 2.5×',
      'RMI speedup over std::lower_bound (the usual bar) and over the fastest tuned non-learned search. Below the grey line, the RMI loses.');
    const BL = { uni: { std: [2.35, 3.63, 5.98, 5.92, 6.39], best: [0.71, 0.88, 1.87, 2.41, 2.46] },
                 logn: { std: [1.40, 1.68, 2.73, 3.52, 3.92], best: [0.28, 0.45, 0.89, 1.33, 1.47] } };
    const sp = (x, title, d) => {
      T(s, title, { x, y: 2.0, w: 4.3, h: 0.32, fontSize: 14, bold: true, color: INK });
      s.addChart(pres.charts.LINE, [
        { name: 'vs std::lower_bound', labels: SIZES, values: BL[d].std },
        { name: 'vs best tuned search', labels: SIZES, values: BL[d].best },
        { name: 'tie (1×)', labels: SIZES, values: [1, 1, 1, 1, 1] }],
        axis({ x: x - 0.05, y: 2.35, w: 4.45, h: 3.5, chartColors: [COOL2, HOT, 'B8C0CC'], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
          valAxisMinVal: 0, valAxisMaxVal: 7, valAxisMajorUnit: 1, valAxisLabelFormatCode: '0"×"' }));
    };
    sp(0.6, 'uniform keys', 'uni');
    sp(5.15, 'lognormal keys', 'logn');
    chip(s, 0.6, 5.95, COOL2, 'RMI vs std::lower_bound'); chip(s, 3.4, 5.95, HOT, 'RMI vs best tuned search');
    T(s, 'Best tuned search: branchless at 100K, Eytzinger from 1M; interpolation ties it at 100M uniform.', { x: 0.6, y: 6.25, w: 9.0, h: 0.42, fontSize: 13.5 });
    card(s, 9.85, 2.0, 2.88, 4.6, HOTSOFT);
    stat(s, 10.1, 2.15, 2.5, '6.4× → 2.5×', 'RMI lead at 100M uniform keys: vs the default, vs the best tuned search');
    stat(s, 10.1, 3.6, 2.5, '3.6×', 'branchless binary search over the RMI at 100K lognormal keys (in cache)', COOL);
    stat(s, 10.1, 5.05, 2.5, '8.3×', 'RMI slower than an oracle that knows each position, at 100M uniform keys', COOL);
    source(s, 'learned-index-bench --baselines, AMD Ryzen AI 7 350: same keys and 2M queries for every search, median of 5 runs, each checked against std::lower_bound.');
    s.addNotes('Source: report/figures/objective1/baselines_summary.csv (learned-index-bench/baselines.py over results/ryzen_ai7_350_x86_baselines.csv). Tuned non-learned searches: branchless binary search (cmov), Eytzinger layout with prefetching [Khuong and Morin, JEA 2017], interpolation search (8 probes, then binary search). Oracle: the true position is given; the lookup reads that key. Uniform ns at 100M: std::lower_bound 655.8, branchless 769.8, Eytzinger 260.1, interpolation 252.0, RMI 102.6, oracle 12.4. Lognormal at 100M: 632.6, 768.3, 237.5, 1,560.7, 161.2, 11.5. At 100K: branchless 29.4 (uniform) and 26.1 (lognormal) vs RMI 41.2 and 93.3. Spread (max/median of 5 runs): at most 1.11 for the RMI and 1.20 for the best non-learned search. This run was a median 1.28x slower in absolute terms than the Objective 5 Ryzen run (browser open, low free memory), so only within-run ratios are used; the RMI vs std::lower_bound ratio matches (6.4x vs 6.5x at 100M uniform). The Eytzinger layout keeps a second copy of the keys (800 MB at 100M); the RMI needs about 37 MB.'); }
  // ---- SOSD 200M (questions 1 and 2), numbers computed from report/figures/objective1/wp12_summary.csv
  const SRC12 = 'wp12 on the AMD Ryzen AI 7 350 (Windows, pinned): 200M SOSD keys, 2M queries, every index checked on every query; mean = median of 3 trials.';
  const sosd = SOSD_DS.map(([ds, lab]) => {
    const std = bestOf(ds, ['binary_search']), tuned = bestOf(ds, NONLEARNED_IDX), learned = bestOf(ds, LEARNED_IDX), orc = bestOf(ds, ['oracle']);
    const b10t = bestOf(ds, NONLEARNED_IDX, 1e7), b10l = bestOf(ds, LEARNED_IDX, 1e7);
    return { ds, lab, std, tuned, learned, orc, b10t, b10l, vsTuned: tuned.mean_ns / learned.mean_ns, vsStd: std.mean_ns / learned.mean_ns,
             vsOracle: learned.mean_ns / orc.mean_ns, budget: b10t.mean_ns / b10l.mean_ns };
  });
  const rng = (vals, d = 1) => { const lo = Math.min(...vals), hi = Math.max(...vals); return lo.toFixed(d) + ' to ' + hi.toFixed(d) + '×'; };
  const wins = sosd.filter(r => r.vsTuned > 1);
  const loss = sosd.filter(r => r.vsTuned <= 1);
  { const s = content(S1, 'Q1  ·  IS IT BETTER?', `Learned indexes win on ${wins.length} of 4 real datasets, by up to ${Math.max(...wins.map(r => r.vsTuned)).toFixed(1)}×`,
      'Mean lookup latency (ns) on 200M SOSD keys: the best setting of each family');
    const labels = sosd.map(r => r.lab);
    s.addChart(pres.charts.BAR, [
      { name: 'std::lower_bound', labels, values: sosd.map(r => Math.round(r.std.mean_ns)) },
      { name: 'best tuned non-learned (Eytzinger)', labels, values: sosd.map(r => Math.round(r.tuned.mean_ns)) },
      { name: 'best learned', labels, values: sosd.map(r => Math.round(r.learned.mean_ns)) }],
      axis({ x: 0.55, y: 2.0, w: 9.0, h: 3.75, barDir: 'col', chartColors: [COOL2, COOL, HOT], barGapWidthPct: 60, valAxisMinVal: 0, valAxisMaxVal: 900,
        valAxisMajorUnit: 300, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0', dataLabelFontSize: 11, catAxisLabelFontSize: 14 }));
    chip(s, 0.6, 5.85, COOL2, 'std::lower_bound'); chip(s, 2.75, 5.85, COOL, 'best tuned search'); chip(s, 5.05, 5.85, HOT, 'best learned index');
    T(s, 'The best tuned search is always the Eytzinger layout, which keeps a second copy of the keys (1.6 GB).', { x: 0.6, y: 6.2, w: 9.0, h: 0.42, fontSize: 13.5 });
    card(s, 9.85, 2.0, 2.88, 4.6, HOTSOFT);
    stat(s, 10.1, 2.15, 2.5, rng(sosd.map(r => r.vsStd)), 'best learned over std::lower_bound, the usual bar');
    stat(s, 10.1, 3.6, 2.5, rng(wins.map(r => r.vsTuned), 1), `over the best tuned search on ${wins.map(r => r.lab).join(', ')}`);
    stat(s, 10.1, 5.05, 2.5, loss.map(r => r.vsTuned.toFixed(2) + '×').join(', ') || 'none', loss.length ? `on ${loss.map(r => r.lab).join(', ')}: the learned index loses` : 'no dataset where it loses', COOL);
    source(s, SRC12);
    s.addNotes('Source: report/figures/objective1/wp12_summary.csv (wp12/scripts/summarize_wp12.py). Mean ns, best setting per family. ' +
      sosd.map(r => `${r.lab}: std::lower_bound ${r.std.mean_ns.toFixed(0)}, best tuned ${IDX_NAME[r.tuned.index]} ${r.tuned.mean_ns.toFixed(0)}, best learned ${IDX_NAME[r.learned.index]} (${r.learned.config}, ${fmtBytes(r.learned.bytes)}) ${r.learned.mean_ns.toFixed(0)}, oracle ${r.orc.mean_ns.toFixed(0)}; learned vs tuned ${r.vsTuned.toFixed(2)}x, vs std ${r.vsStd.toFixed(1)}x, vs oracle ${r.vsOracle.toFixed(0)}x slower; throughput ${(1000 / r.learned.mean_ns).toFixed(1)} M lookups/s.`).join(' ') +
      ' The mean is a closed loop of independent lookups. Mean trial spread is in the summary CSV (mean_spread).'); }

  { const s = content(S1, 'Q1  ·  IS IT BETTER?', `At 10 MB or less, learned indexes beat a B+tree by ${rng(sosd.map(r => r.budget))}`,
      'Mean latency against index size, every setting of every index, 200M SOSD keys (log-log; lower left is better)');
    s.addImage({ path: FIG + 'wp12_size_vs_latency.png', x: 0.6, y: 1.98, w: 8.7, h: 8.7 * 1290 / 2880,
      altText: 'Mean lookup latency against index size for B+tree, RMI, PGM-index and RadixSpline on books, fb, osm and wiki, with std::lower_bound and the Eytzinger layout as references' });
    T(s, [
      { text: `Except for the RMI on fb, every learned family sits below the B+tree at every size. The fastest learned settings take ${(() => { const b = sosd.filter(r => r.lab !== 'osm').map(r => r.learned.bytes); return fmtBytes(Math.min(...b)).replace(' MB', '') + ' to ' + fmtBytes(Math.max(...b)); })()} on books, fb and wiki; osm needs ${fmtBytes(sosd.find(r => r.lab === 'osm').learned.bytes)}.`, options: { bullet: true, breakLine: true } },
      { text: 'Even a 24 KB PGM-index is nearly 2× faster than std::lower_bound on books.', options: { bullet: true } },
    ], { x: 0.6, y: 5.95, w: 9.0, h: 0.7, fontSize: 13, paraSpaceAfter: 2 });
    card(s, 9.85, 2.0, 2.88, 4.6, HOTSOFT);
    const wk = sosd.find(r => r.lab === 'wiki'), bk = sosd.find(r => r.lab === 'books');
    stat(s, 10.1, 2.15, 2.5, wk.budget.toFixed(1) + '×', `wiki: ${IDX_NAME[wk.b10l.index]} (${fmtBytes(wk.b10l.bytes)}) over the B+tree (${fmtBytes(wk.b10t.bytes)})`);
    stat(s, 10.1, 3.6, 2.5, bk.budget.toFixed(1) + '×', `books: ${IDX_NAME[bk.b10l.index]} (${fmtBytes(bk.b10l.bytes)}) over the B+tree (${fmtBytes(bk.b10t.bytes)})`);
    stat(s, 10.1, 5.05, 2.5, '1.6 GB', 'what the Eytzinger layout spends to stay close: a full copy of the keys', COOL);
    source(s, SRC12);
    s.addNotes('Source: report/figures/objective2/obj2_budget.csv and fig2_1_size_vs_latency.png. Best within 10 MB (non-learned may also use the 0-byte searches): ' +
      sosd.map(r => `${r.lab}: ${IDX_NAME[r.b10t.index]} ${r.b10t.config} ${r.b10t.mean_ns.toFixed(0)} ns (${fmtBytes(r.b10t.bytes)}) vs ${IDX_NAME[r.b10l.index]} ${r.b10l.config} ${r.b10l.mean_ns.toFixed(0)} ns (${fmtBytes(r.b10l.bytes)}), ${r.budget.toFixed(1)}x.`).join(' ') +
      ' The B+tree indexes every s-th key (s = 8 to 8192) and binary-searches the gap, as SOSD\'s BTree does; a full B+tree over 200M keys would not fit in memory beside the keys.'); }

  const armSlide = () => { const s = content('Q4: Does it transfer?', 'Q4  ·  DOES IT TRANSFER?', 'On ARM, RadixSpline is also the fastest ordered index',
      'SOSD on Apple M6, lognormal 1M keys, 100K lookups (50% unsuccessful), 1 thread, median of 3 trials');
    s.addImage({ path: FIG + 'arm64_sosd_latency_vs_size.png', x: 0.6, y: 2.0, w: 6.75, h: 6.75 * 880 / 1440,
      altText: 'Median lookup latency versus index size for RadixSpline, PGM-index and STX B+tree, with binary search and RobinHash as references' });
    const h = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: INK } } });
    const L = (t) => ({ text: t, options: { bold: true, color: HOT } });
    const C = (t) => ({ text: t, options: { bold: true, color: COOL } });
    const rows = [[h('Index'), h('Best config'), h('Latency'), h('Size')],
      [C('RobinHash'), 'hash table', '9.7 ns', '64 MiB'],
      [L('RadixSpline'), '17 radix bits', '21.8 ns', '438 KiB'],
      [L('RadixSpline'), '11 radix bits', '22.7 ns', '20 KiB'],
      [C('STX B+tree'), 'every 512th key', '28.4 ns', '36 KiB'],
      [L('PGM-index'), 'ε = 64', '31.6 ns', '2.3 KiB'],
      [C('Binary search'), 'no index', '49.2 ns', '0']];
    s.addTable(rows, { x: 7.7, y: 2.05, w: 5.03, colW: [1.45, 1.53, 1.0, 1.05], fontFace: BF, fontSize: 13, color: BODY, rowH: 0.36,
      border: { type: 'solid', pt: 0.75, color: LINE }, valign: 'middle', margin: [0, 0.08, 0, 0.08] });
    T(s, [
      { text: 'RadixSpline is 23% faster than the best B+tree and 31% faster than the best PGM-index.', options: { bullet: true, breakLine: true } },
      { text: 'Its size barely matters: 20 KiB is within 4% of 438 KiB.', options: { bullet: true, breakLine: true } },
      { text: 'The hash table is 2.3× faster still, but cannot answer range queries.', options: { bullet: true } },
    ], { x: 7.7, y: 4.75, w: 5.03, h: 1.85, fontSize: 14, paraSpaceAfter: 6 });
    source(s, `Our SOSD port to Apple Silicon (RMI, ALEX and others need x86-only code): 1M keys, unpinned, on battery. On the AMD laptop at 200M keys, RadixSpline is also the fastest learned index on ${sosd.filter(r => r.learned.index === 'radixspline').length} of 4 datasets.`);
    s.addNotes('Source: sosd-arm64/runs/20261125-100608-release/summary/lookup_pareto.csv and build.csv. Apple M6 MacBook Pro (Mac18,1), 16 GB, macOS 27.2.1, Apple clang 17, SOSD arm64-support 28b078c, flags -O3 -DNDEBUG -march=native. Latency = median over 3 trials of the per-trial median of 5 repeats. B+tree "every 512th key" = SOSD size_scale 512 (sparse tree plus last-mile binary search). Build times: RadixSpline 4.7 ms (17 bits), 4.0 ms (11 bits), PGM 6.3 ms, B+tree under 0.01 ms, RobinHash 26.1 ms.'); }

  // ================= Q2: Why does it win?
  const S2 = 'Q2: Why does it win?';
  divider(S2, '02', 'Why does it win?', 'Objective 3: hardware counters per lookup, read with perf_event_open on the AMD Ryzen AI 7 350 (Linux)', [1]);
  const SRC3 = 'AMD Ryzen AI 7 350, Ubuntu 24.04 in WSL2, g++ 13 -O3, 1 thread, same 2M queries for every index, median of 3 trials.';
  { const s = content(S2, 'Q2  ·  WHY DOES IT WIN?', 'In cache, branch misses decide; in memory, DRAM waits do',
      'Cycles per lookup against the counter that tracks them, at 100K keys (fits in L2) and 100M keys (main memory)');
    s.addImage({ path: FIG + 'wp3_in_vs_out_of_cache.png', x: 0.6, y: 2.0, w: 8.75, h: 8.75 * 736 / 1760,
      altText: 'Cycles per lookup versus branch misses at 100K keys and versus DRAM fills at 100M keys, for six indexes on uniform and lognormal keys' });
    card(s, 9.6, 2.0, 3.13, 4.6);
    stat(s, 9.85, 2.15, 2.75, '29 cycles', 'per branch miss in cache (r = 0.97, 12 points)');
    stat(s, 9.85, 3.6, 2.75, '4.5×', 'branchless binary search over std::lower_bound at 100K keys', COOL);
    stat(s, 9.85, 5.05, 2.75, '1.5×', 'std::lower_bound over branchless at 100M, despite 5× the DRAM fills', COOL);
    T(s, [
      { text: 'In cache there is no DRAM traffic, so latency follows branch misses. The RMI\'s in-cache lead is a lead in branch misses.', options: { bullet: true, breakLine: true } },
      { text: 'In memory, what counts is how many misses a lookup waits for one after another. Fills on guessed paths overlap and cost little.', options: { bullet: true } },
    ], { x: 0.6, y: 5.75, w: 8.75, h: 0.9, fontSize: 14, paraSpaceAfter: 4 });
    source(s, SRC3);
    s.addNotes('Source: wp3/runs/20261126-205955-ryzen-wsl/summary/wp3_summary.csv (report Tables 3.2 and 3.3). Fit at 100K keys: cycles = 92 + 29 x branch misses, r = 0.97, 12 points (6 indexes x 2 datasets, best RMI). std::lower_bound mispredicts 9.4 of 17 comparisons; branchless search 0 misses, 79 vs 346 cycles. At 100K the branchless search beats the best RMI: 26.1 vs 37.7 ns uniform, 25.9 vs 82.8 ns lognormal. At 1M (in L3) the RMI wins again: 53 vs 97 ns uniform. At 100M: std::lower_bound 707 ns with 43.5 DRAM fills (mostly on discarded guessed paths); branchless 1,094 ns with 8.8 fills that each wait on the previous one. Caveats: WSL2 VM, clock 2.7 to 3.3 GHz, latency trial spread median 1.18x; counts are stable (branch misses within 4%).'); }

  { const s = content(S2, 'Q2  ·  WHY DOES IT WIN?', 'Learned indexes make the fewest trips to main memory',
      '100M uniform keys (800 MB): DRAM fills and latency per lookup');
    const cats = ['RMI', 'RadixSpline', 'PGM-index', 'STX B+tree', 'Binary search, branchless', 'std::lower_bound'];
    const colors = [HOT, HOT, HOT, COOL, COOL, COOL];
    const hbar = (x, title, vals, fmt, max) => {
      T(s, title, { x, y: 1.98, w: 4.4, h: 0.32, fontSize: 14, bold: true, color: INK });
      s.addChart(pres.charts.BAR, [{ name: title, labels: cats, values: vals }], axis({ x: x - 0.05, y: 2.3, w: 4.45, h: 3.15, barDir: 'bar',
        chartColors: colors.slice(), catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 45,
        showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: fmt, catAxisLabelFontSize: 11.5, valAxisMinVal: 0, valAxisMaxVal: max }));
    };
    hbar(0.6, 'DRAM fills per lookup', [2.34, 3.16, 5.30, 8.31, 8.84, 43.52], '0.0', 52);
    hbar(5.15, 'Latency per lookup (ns)', [96, 128, 228, 832, 1094, 707], '#,##0', 1320);
    chip(s, 0.6, 5.55, HOT, 'Learned'); chip(s, 1.9, 5.55, COOL, 'Traditional');
    T(s, 'std::lower_bound\'s 43.5 fills are mostly on guessed paths that overlap (previous slide).', { x: 3.3, y: 5.55, w: 6.2, h: 0.3, fontSize: 12, italic: true, color: MUTED, valign: 'middle' });
    T(s, 'A less accurate model means a wider last-mile search and more DRAM fills. Page walks per lookup: about 1 for learned indexes, 27 to 29 for std::lower_bound.',
      { x: 0.6, y: 5.95, w: 8.9, h: 0.65, fontSize: 14 });
    card(s, 9.85, 2.0, 2.88, 4.6, HOTSOFT);
    stat(s, 10.1, 2.15, 2.5, '2.3 vs 8.3', 'DRAM fills per lookup: RMI vs STX B+tree');
    stat(s, 10.1, 3.6, 2.5, '8.6×', 'RMI over the B+tree in latency (96 vs 832 ns)');
    stat(s, 10.1, 5.05, 2.5, '6.2 → 32.9', 'RMI fills on lognormal keys as the model shrinks from 37 MB to 0.6 MB');
    source(s, SRC3);
    s.addNotes('Source: wp3/runs/20261126-205955-ryzen-wsl/summary/wp3_summary.csv, uniform, n = 99,999,994, best RMI (97,656 leaves). DRAM fills / ns: RMI 2.34 / 96.5, RadixSpline 3.16 / 127.7, PGM (eps 64) 5.30 / 228.2, STX B+tree 8.31 / 832.0, branchless binary search 8.84 / 1,093.9, std::lower_bound 43.52 / 706.8. Lognormal 100M: RMI 6.2 / 174, RadixSpline 3.3 / 273, PGM 5.3 / 321, B+tree 8.5 / 807, branchless 9.6 / 1,081, lower_bound 41.0 / 740. RMI on lognormal 100M: 1.5M leaves (37 MB) window 2^6.6, 6.2 fills, 174 ns; 24K leaves (0.6 MB) window 2^11.9, 32.9 fills, 437 ns. Page walks = dTLB L2 misses: learned about 1.1, B+tree 2.8, branchless 6.8, std::lower_bound 27.5 (uniform) and 29.2 (lognormal).'); }

  // ================= Q3: Where does it fail?
  const S3 = 'Q3: Where does it fail?';
  divider(S3, '03', 'Where does it fail?', 'Outliers and tails on the SOSD data; then hard-to-model data, inserts, range scans and build time with ALEX on the Apple M6', [2]);
  { // outliers and tails, from the SOSD run and the fb outlier ablation
    const ABL = readCsv('../../report/figures/objective1/wp12_fb_outliers.csv');
    const fb = sosd.find(r => r.lab === 'fb'), wk = sosd.find(r => r.lab === 'wiki');
    const ablBest = (cond, idx) => ABL.filter(r => r.condition === cond && r.index === idx).reduce((a, r) => (!a || r.mean_ns < a.mean_ns ? r : a), null);
    const rmiFb = ablBest('kept', 'rmi'), rmiFbClean = ablBest('removed', 'rmi'), stdFb = ablBest('kept', 'binary_search');
    const rmiWk = bestOf('wiki_ts_200M_uint64', ['rmi']), rsWk = bestOf('wiki_ts_200M_uint64', ['radixspline']);
    const s = content(S3, 'Q3  ·  WHERE DOES IT FAIL?', 'Two weak spots: 20 outlier keys, and the RMI\'s tail',
      'p99 latency (ns) of lookups timed one at a time, best setting of each index, 200M SOSD keys');
    const P = [['eytzinger', 'Eytzinger (tuned search)', COOL], ['pgm', 'PGM-index', AMBER], ['radixspline', 'RadixSpline', '9C3D1E'], ['rmi', 'RMI', HOT]];
    const labels = sosd.map(r => r.lab);
    s.addChart(pres.charts.BAR, P.map(([i, name]) => ({ name, labels, values: SOSD_DS.map(([ds]) => Math.round(bestOf(ds, [i]).p99_ns)) })),
      axis({ x: 0.55, y: 2.0, w: 9.0, h: 3.75, barDir: 'col', chartColors: P.map(p => p[2]), barGapWidthPct: 55, valAxisMinVal: 0, valAxisMaxVal: 2500,
        valAxisMajorUnit: 500, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0', dataLabelFontSize: 9.5, catAxisLabelFontSize: 14 }));
    P.forEach(([, name, c], i) => chip(s, 0.6 + i * 2.25, 5.85, c, name));
    T(s, 'The PGM-index bounds the error of every segment, so its tail stays near the tuned search and the outliers do not touch it. The RMI bounds its error per leaf, and a few wide leaves hold its slowest lookups.',
      { x: 0.6, y: 6.15, w: 9.0, h: 0.5, fontSize: 12.5 });
    card(s, 9.85, 2.0, 2.88, 4.6, COOLSOFT);
    stat(s, 10.1, 2.15, 2.5, '20 keys', `of 200M put the RMI on fb at about std::lower_bound speed (${rmiFb.mean_ns.toFixed(0)} vs ${stdFb.mean_ns.toFixed(0)} ns)`, COOL);
    stat(s, 10.1, 3.6, 2.5, (rmiFb.mean_ns / rmiFbClean.mean_ns).toFixed(1) + '×', `faster RMI on fb once those keys are removed (${rmiFbClean.mean_ns.toFixed(0)} ns); RadixSpline gains ${(ablBest('kept', 'radixspline').mean_ns / ablBest('removed', 'radixspline').mean_ns).toFixed(1)}×`);
    stat(s, 10.1, 5.05, 2.5, (rmiWk.p99_ns / rsWk.p99_ns).toFixed(1) + '×', `RMI p99 over RadixSpline on wiki, though their means are ${rmiWk.mean_ns.toFixed(0)} and ${rsWk.mean_ns.toFixed(0)} ns`, COOL);
    source(s, SRC12);
    s.addNotes('Sources: report/figures/objective1/wp12_summary.csv, and wp12_fb_outliers.csv for the 21-key numbers (ablation: fb as-is and fb without its 20 keys above 2^40, 3 trials each, run back to back on battery, so compared only with each other; std::lower_bound and PGM were 11 to 15% slower in the second run). ' +
      'fb keys: 99.9999% are below 2^37, but 20 lie between 2^40 and 2^64 (8 above 2^60; the key 2^64-1 is dropped for every index). A least-squares root model is pulled flat by them, so almost every key lands in one leaf: average window 2^' + rmiFb.log2err.toFixed(1) + ' keys. ' +
      'p99 ns (Eytzinger / PGM / RadixSpline / RMI): ' + SOSD_DS.map(([ds, lab]) => lab + ' ' + P.map(([i]) => bestOf(ds, [i]).p99_ns.toFixed(0)).join(' / ')).join('; ') +
      '. p99 = median of 3 trials of the 99th percentile of 500K lookups each timed alone (rdtsc, 20 to 30 ns timer cost subtracted, 10 ns resolution).'); }
  const SRC4 ='Apple M6, -O3, 1 thread, median of 3 trials, AC power. books and osm from SOSD: 10M distinct keys sampled from 800M. All indexes returned identical checksums.';
  { const s = content(S3, 'Q3  ·  WHERE DOES IT FAIL?', 'Hard-to-model keys and inserts erase ALEX\'s lead',
      'Bulk-load half the keys, then 2M operations mixing lookups and inserts: throughput in million operations per second');
    const mix = (x, title, d) => {
      T(s, title, { x, y: 2.0, w: 4.4, h: 0.32, fontSize: 14, bold: true, color: INK });
      s.addChart(pres.charts.BAR, [
        { name: 'ALEX', labels: ['0%', '10%', '50%', '90%'], values: d.ALEX },
        { name: 'Dynamic PGM', labels: ['0%', '10%', '50%', '90%'], values: d.DynPGM },
        { name: 'STX B+tree', labels: ['0%', '10%', '50%', '90%'], values: d.BTree }],
        axis({ x: x - 0.05, y: 2.35, w: 4.5, h: 3.45, barDir: 'col', chartColors: [HOT, AMBER, COOL], barGapWidthPct: 55,
          valAxisMinVal: 0, valAxisMaxVal: 50, valAxisMajorUnit: 10, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0', dataLabelFontSize: 9.5,
          showCatAxisTitle: true, catAxisTitle: 'share of inserts' }));
    };
    mix(0.6, 'books: easy to model', WP4.books);
    mix(5.2, 'osm: hard to model', WP4.osm);
    chip(s, 0.6, 5.9, HOT, 'ALEX'); chip(s, 1.65, 5.9, AMBER, 'Dynamic PGM'); chip(s, 3.3, 5.9, COOL, 'STX B+tree');
    T(s, 'On books ALEX leads at every mix. On osm, Dynamic PGM wins once half the operations are inserts.', { x: 0.6, y: 6.25, w: 9.1, h: 0.4, fontSize: 14 });
    card(s, 9.95, 2.0, 2.78, 4.6, HOTSOFT);
    stat(s, 10.2, 2.15, 2.4, '6.2× → 1.9×', 'ALEX over the B+tree with no inserts, books → osm');
    stat(s, 10.2, 3.6, 2.4, '1.04×', 'ALEX over the B+tree at 90% inserts on osm: a tie');
    stat(s, 10.2, 5.05, 2.4, '2.2×', 'Dynamic PGM over ALEX at 90% inserts on osm', AMBER);
    source(s, SRC4);
    s.addNotes('Source: wp4/runs/20261125-111310-m6/summary/wp4_summary.csv (mixed rows). M ops/s, books/osm. 0%: ALEX 43.8/15.4, B+tree 7.1/8.0, DynPGM 18.1/14.2. 10%: 36.2/12.8, 6.4/6.6, 7.8/6.5. 50%: 16.0/6.9, 5.9/4.9, 8.6/7.4. 90%: 13.0/5.7, 5.2/5.5, 12.7/12.4. Synthetic uniform and lognormal behave like books (report Table 4.1). Inserts are random keys from the same dataset; no sequential inserts or deletes tested. Replicated on battery for synthetic data (median difference 3.4%).'); }

  { const s = content(S3, 'Q3  ·  WHERE DOES IT FAIL?', 'Static PGM wins long scans; ALEX builds up to 76× slower',
      'Range scans on osm (ns per scan), and bulk-load time for all 10M keys (ms)');
    T(s, 'Range scan time on osm (ns)', { x: 0.6, y: 2.0, w: 5.8, h: 0.32, fontSize: 14, bold: true, color: INK });
    const L3 = ['10 keys', '100 keys', '1000 keys'];
    s.addChart(pres.charts.BAR, [{ name: 'ALEX', labels: L3, values: WP4.rangeOsm.ALEX }, { name: 'PGM-index (static)', labels: L3, values: WP4.rangeOsm.PGM },
      { name: 'STX B+tree', labels: L3, values: WP4.rangeOsm.BTree }],
      axis({ x: 0.55, y: 2.35, w: 5.9, h: 2.75, barDir: 'col', chartColors: [HOT, AMBER, COOL], barGapWidthPct: 55, valAxisMinVal: 0, valAxisMaxVal: 1800, valAxisMajorUnit: 600,
        showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0', dataLabelFontSize: 9.5 }));
    chip(s, 0.6, 5.15, HOT, 'ALEX'); chip(s, 1.65, 5.15, AMBER, 'PGM-index'); chip(s, 3.1, 5.15, COOL, 'STX B+tree');
    T(s, [
      { text: 'On books, ALEX is fastest for 10-key scans: 2.6× faster than the B+tree.', options: { bullet: true, breakLine: true } },
      { text: 'On osm, ALEX loses to the B+tree at 100 and 1000 keys. A static PGM over a plain array is 1.7 to 2.8× faster than ALEX at 1000 keys.', options: { bullet: true } },
    ], { x: 0.6, y: 5.5, w: 5.9, h: 1.15, fontSize: 13.5, paraSpaceAfter: 4 });
    T(s, 'Bulk-load time, 10M keys (ms)', { x: 6.95, y: 2.0, w: 5.8, h: 0.32, fontSize: 14, bold: true, color: INK });
    const IDX = ['STX B+tree', 'PGM-index', 'Dynamic PGM', 'ALEX'];
    s.addChart(pres.charts.BAR, [{ name: 'books', labels: IDX, values: WP4.build.books }, { name: 'osm', labels: IDX, values: WP4.build.osm }],
      axis({ x: 6.9, y: 2.35, w: 5.9, h: 2.75, barDir: 'bar', chartColors: [COOL2, X86], barGapWidthPct: 45, catAxisOrientation: 'maxMin',
        valAxisHidden: true, valGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: 1700, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0' }));
    chip(s, 6.95, 5.15, COOL2, 'books'); chip(s, 8.0, 5.15, X86, 'osm');
    T(s, [
      { text: 'ALEX builds 44× slower than the B+tree on books and 76× on osm.', options: { bullet: true, breakLine: true } },
      { text: 'osm slows every learned build 1.8 to 2.0×; the B+tree barely changes.', options: { bullet: true } },
    ], { x: 6.95, y: 5.5, w: 5.78, h: 1.15, fontSize: 13.5, paraSpaceAfter: 4 });
    source(s, SRC4);
    s.addNotes('Source: wp4/runs/20261125-111310-m6/summary/wp4_summary.csv. Range ns/query (books/osm). L=10: ALEX 73/158, B+tree 188/198, PGM 94/122, DynPGM 222/275. L=100: ALEX 265/407, B+tree 320/349, PGM 169/195, DynPGM 535/582. L=1000: ALEX 861/1529, B+tree 917/1028, PGM 498/550, DynPGM 3546/3615 (left off the chart: off scale). Build ms (books/osm/uniform/lognormal): B+tree 18/19/23/17, PGM 51/104/55/55, DynPGM 72/129/87/86, ALEX 781/1419/317/1365. Lognormal makes ALEX build as slowly as osm, yet its lookups stay fast, so build cost and lookup difficulty are separate signals. Static PGM eps=64; others library defaults.'); }

  // ================= Q4: Does it transfer?
  const S4 = 'Q4: Does it transfer?';
  divider(S4, '04', 'Does it transfer?', 'Objective 5: the same benchmark on x86 and ARM laptops, from in-cache to main-memory sizes', [3]);
  const SRC5 = 'learned-index-bench: 2M random lookups of existing keys, median of 5 runs after a warm-up; RMI = fastest of 4 leaf counts. Ryzen pinned; M6 unpinned, on battery; Intel conditions not recorded.';
  const CPUS = [['ryzen', 'AMD Ryzen AI 7 350 (x86)', X86], ['intel', 'Intel Core i7-1355U (x86)', INTEL], ['m6', 'Apple M6 (ARM)', ARM]];
  const cpuChips = (s, y) => CPUS.forEach(([, label, color], i) => chip(s, 0.6 + i * 2.95, y, color, label));
  { const s = content(S4, 'Q4  ·  DOES IT TRANSFER?', 'Slow main memory hurts binary search more than the RMI',
      'Lookup latency (ns, log scale) on three laptops, uniform keys. 100K and 1M keys fit in cache; 10M and up do not.');
    const lat = (x, title, key) => {
      T(s, title, { x, y: 2.0, w: 4.3, h: 0.32, fontSize: 14, bold: true, color: INK });
      s.addChart(pres.charts.LINE, CPUS.map(([c, label]) => ({ name: label, labels: SIZES, values: WP5[c].uni[key] })),
        axis({ x: x - 0.05, y: 2.35, w: 4.45, h: 3.5, chartColors: CPUS.map(c => c[2]), lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
          valAxisLogScaleBase: 10, valAxisMinVal: 10, valAxisMaxVal: 10000, valAxisLabelFormatCode: '#,##0' }));
    };
    lat(0.6, 'Binary search (std::lower_bound)', 'bs');
    lat(5.15, 'RMI, best of 4 sizes', 'rmi');
    cpuChips(s, 5.95);
    T(s, 'Past the cache, main memory sets the pace; on the Intel it costs binary search the most.', { x: 0.6, y: 6.25, w: 9.0, h: 0.42, fontSize: 13.5 });
    card(s, 9.85, 2.0, 2.88, 4.6, COOLSOFT);
    stat(s, 10.1, 2.15, 2.5, '4.0 to 5.1×', 'M6 over Ryzen for binary search, up to 1M keys (in cache)', COOL);
    stat(s, 10.1, 3.6, 2.5, '3.2×', 'Intel slower than Ryzen for binary search at 100M keys', COOL);
    stat(s, 10.1, 5.05, 2.5, '2.1 to 2.2×', 'Intel slower than Ryzen for the RMI at 100M keys');
    source(s, SRC5);
    s.addNotes('Source: report/figures/objective5/wp5_summary.csv (from learned-index-bench/compare_cpus.py with three CPUs). Uniform binary search ns Ryzen/Intel/M6: 100K 103.4/119.2/25.5, 1M 158.6/215.0/37.4, 10M 320.1/1,019.5/134.9, 100M 525.5/1,691.8/290.8. Best RMI: 100K 31.7/39.8/10.1, 100M 81.1/180.5/33.9. Lognormal behaves the same way: at 100M, Intel binary search 1,642 ns vs Ryzen 515 (3.2x); RMI 279 vs 132 (2.1x). M6 over Ryzen at 100M: binary search 1.7 to 1.8x, RMI 1.8 to 2.4x. Cache: Ryzen 16 MB L3, Intel 12 MB L3, M6 20 MB L2. Intel pinning, power and core type (P or E) were not recorded; Ryzen unpinned rerun was up to 1.59x slower, so ratios under about 1.5x are uncertain.'); }

  { const s = content(S4, 'Q4  ·  DOES IT TRANSFER?', 'Learned wins grow with size; small wins depend on the CPU',
      'RMI speedup over binary search on each CPU. Above the grey line, the learned index is faster.');
    const sp = (x, title, d) => {
      T(s, title, { x, y: 2.0, w: 4.3, h: 0.32, fontSize: 14, bold: true, color: INK });
      s.addChart(pres.charts.LINE, CPUS.map(([c, label]) => ({ name: label, labels: SIZES, values: ratio(WP5[c][d].bs, WP5[c][d].rmi) }))
        .concat([{ name: 'tie (1×)', labels: SIZES, values: [1, 1, 1, 1, 1] }]),
        axis({ x: x - 0.05, y: 2.35, w: 4.45, h: 3.5, chartColors: CPUS.map(c => c[2]).concat(['B8C0CC']), lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
          valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2, valAxisLabelFormatCode: '0"×"', showValue: false }));
    };
    sp(0.6, 'uniform keys: easy to model', 'uni');
    sp(5.15, 'lognormal keys: harder to model', 'logn');
    cpuChips(s, 5.95);
    T(s, 'On all three CPUs the speedup climbs past the cache. In cache, the M6\'s fast binary search wins.', { x: 0.6, y: 6.25, w: 9.0, h: 0.42, fontSize: 13.5 });
    card(s, 9.85, 2.0, 2.88, 4.6, HOTSOFT);
    stat(s, 10.1, 2.15, 2.5, '9.4×', 'RMI over binary search at 100M uniform keys on the Intel (Ryzen 6.5×, M6 8.6×)');
    stat(s, 10.1, 3.6, 2.5, '0.95×', 'RMI vs binary search on the M6, lognormal 100K and 1M: the RMI loses', COOL);
    stat(s, 10.1, 5.05, 2.5, '1.4 to 2.1×', 'Same lognormal sizes on both x86 laptops: the RMI still wins');
    source(s, SRC5);
    s.addNotes('Speedup = binary search / best RMI, 100K to 100M keys. Uniform: Ryzen 3.3, 3.8, 5.7, 6.4, 6.5; Intel 3.0, 4.4, 9.4, 7.8, 9.4; M6 2.5, 3.5, 5.7, 8.0, 8.6. Lognormal: Ryzen 1.4, 1.8, 2.6, 3.4, 3.9; Intel 1.4, 2.1, 4.9, 5.1, 5.9; M6 0.95, 0.95, 1.9, 3.1, 4.0. M6 lognormal 100K: RMI 26.1 ns vs binary search 24.7 ns; 1M: 32.3 vs 30.9. On lognormal keys the last-mile search covers about 128 to 512 keys. The Intel gains most because its binary search slows 3.2x relative to the Ryzen in main memory while its RMI slows only about 2.2x.'); }
  armSlide();

  // ================= Q5 + Q6: cost and deployment
  const S5 = 'Q5 and Q6: Is it worth it?';
  divider(S5, '05', 'Is it worth it?', 'What a learned index costs to build, when that cost pays back, and where it would run in a real system', [4, 5]);
  { const s = content(S5, 'Q5  ·  WHAT DOES IT COST?', 'Easy data repays the build in under one lookup per key',
      'Break-even lookups per key against a B+tree: learned indexes on 200M SOSD keys (AMD laptop), ALEX on 10M keys (Apple M6)');
    card(s, 0.6, 2.0, 4.6, 4.6, NIGHT);
    T(s, 'BREAK-EVEN', { x: 0.9, y: 2.25, w: 4, h: 0.3, fontSize: 12, bold: true, color: AMBER, charSpacing: 1.5 });
    T(s, 'N*  =', { x: 0.9, y: 2.75, w: 1.3, h: 0.6, fontFace: HF, fontSize: 28, bold: true, color: WHITE, valign: 'middle' });
    T(s, 'extra build time per key', { x: 2.2, y: 2.62, w: 2.8, h: 0.35, fontFace: HF, fontSize: 16, color: WHITE, align: 'center' });
    s.addShape(pres.shapes.LINE, { x: 2.25, y: 3.05, w: 2.7, h: 0, line: { color: ONDARK, width: 1.25 } });
    T(s, 'time saved per lookup', { x: 2.2, y: 3.12, w: 2.8, h: 0.35, fontFace: HF, fontSize: 16, color: WHITE, align: 'center' });
    T(s, 'An index that answers more than N* lookups per key before it is rebuilt pays for its slower build.', { x: 0.9, y: 3.85, w: 4.0, h: 0.9, fontSize: 14, color: ONDARK });
    T(s, [{ text: '3.5×', options: { fontFace: HF, fontSize: 30, bold: true, color: AMBER, breakLine: true } },
          { text: 'higher break-even for ALEX on osm than on books', options: { fontSize: 13, color: ONDARK } }], { x: 0.9, y: 5.15, w: 4.0, h: 1.3 });
    const nstar = (lab) => { const r = sosd.find(x => x.lab === lab), bt = bestOf(r.ds, ['btree']);
      return +(((r.learned.build_ms - bt.build_ms) * 1e6 / r.learned.n) / (bt.mean_ns - r.learned.mean_ns)).toFixed(2); };
    const cases = ['RadixSpline, books 200M', 'PGM-index, fb 200M', 'ALEX, books 10M', 'ALEX, osm 10M', 'ALEX, osm 10M, 90% inserts'];
    T(s, 'Lookups per key before the learned index pays off', { x: 5.6, y: 2.0, w: 7.1, h: 0.32, fontSize: 14, bold: true, color: INK });
    s.addChart(pres.charts.BAR, [{ name: 'N*', labels: cases, values: [nstar('books'), nstar('fb'), 0.65, 2.3, 18.9] }],
      axis({ x: 5.55, y: 2.4, w: 7.2, h: 3.0, barDir: 'bar', chartColors: [HOT, HOT, HOT, AMBER, X86], catAxisOrientation: 'maxMin', valAxisHidden: true,
        valGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: 22, barGapWidthPct: 40, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0#', dataLabelFontSize: 12, catAxisLabelFontSize: 12.5 }));
    T(s, 'With 90% inserts on osm, ALEX saves only 7 ns per operation, so its build needs about 19 operations per key to pay back.', { x: 5.6, y: 5.55, w: 7.1, h: 0.75, fontSize: 14 });
    source(s, 'Learned vs the fastest B+tree setting, mean latency, median of 3 trials. ALEX: extra build time per key from the 10M-key bulk load; time saved from the read-only or 90% insert mix (estimates).');
    s.addNotes('SOSD 200M rows: report Table 6 (wp12/scripts/report_tables.py), learned index vs the fastest B+tree setting. Earlier M6 data point: RadixSpline vs STX B+tree (SOSD, M6, lognormal 1M): N* = 0.71. ALEX vs B+tree on books (wp4_summary.csv): build 78.13 vs 1.78 ns per key = 76.36 ns extra; mixed 0% inserts 22.81 vs 140.40 ns per op = 117.59 ns saved; N* = 0.65. osm: 141.86 vs 1.87 = 140.00 ns extra; 64.77 vs 125.77 = 61.00 ns saved; N* = 2.30. osm at 90% inserts: 174.72 vs 182.11 ns per op = 7.39 ns saved; N* = 18.9. Caveat: the mixed workload runs on a half-loaded index (5M keys), while build time is per key of the 10M-key load; treat N* as an estimate. Training cost here is the build itself: learned indexes need no labels and no GPU.'); }

  { const s = content(S5, 'Q6  ·  WOULD ANYONE USE IT?', 'Use it on read-mostly data; a wrong model only costs time');
    const cells = [
      ['server', 'Where it runs', 'Inside a storage engine, over sorted data that is read far more often than written, for example immutable sorted files that are rebuilt during bulk loads or compaction.'],
      ['shield', 'What happens when it is wrong', 'The last-mile search still finds the key; a bad prediction only widens the search. With PGM-index (ε = 64), a lookup searches at most 129 positions.'],
      ['refresh', 'When it is rebuilt', 'When the data changes enough to widen the error window. ALEX adapts online, but its bulk load is 44 to 76× slower than a B+tree\'s.'],
      ['ban', 'When not to use it', 'Small data that fits in cache on a fast CPU, insert-heavy hard data, and long range scans. A B+tree or a branchless binary search is the safer default there.'],
    ];
    cells.forEach(([ic, head, body], i) => {
      const x = 0.6 + (i % 2) * 6.17, y = 1.95 + Math.floor(i / 2) * 2.4, w = 5.96, h = 2.2;
      card(s, x, y, w, h);
      icon(s, ic, x + 0.3, y + 0.3, 0.7, HOTSOFT);
      T(s, head, { x: x + 1.25, y: y + 0.35, w: w - 1.5, h: 0.45, fontFace: HF, fontSize: 19, bold: true, color: INK });
      T(s, body, { x: x + 1.25, y: y + 0.85, w: w - 1.5, h: 1.25, fontSize: 14 });
    });
    s.addNotes('Answers question 6 of the course expectations. Support: Objective 3 (branchless binary search beats the best RMI at 100K keys in cache), Objective 4 (ALEX ties the B+tree at 90% inserts on osm; static PGM wins long scans; ALEX build 44x and 76x slower), Objective 5 (RMI loses to binary search on the M6 for lognormal 100K and 1M keys). PGM-index guarantees the true position lies within epsilon of the prediction, so the search covers 2 x 64 + 1 = 129 positions.'); }

  // ================= Conclusion
  pres.addSection({ title: 'Conclusion' });
  { const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Conclusion' });
    badge(s, 'CONCLUSION', true);
    T(s, 'Learned indexes still win, but only in the right conditions', { x: 0.6, y: 0.88, w: 12.13, h: 0.65, fontFace: HF, fontSize: 30, bold: true, color: WHITE });
    const col = (x, ic, head, color, items) => {
      card(s, x, 1.85, 5.96, 3.2, NIGHT2);
      icon(s, ic, x + 0.3, 2.1, 0.42);
      T(s, head, { x: x + 0.85, y: 2.08, w: 4.8, h: 0.45, fontFace: HF, fontSize: 20, bold: true, color });
      T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
        { x: x + 0.35, y: 2.75, w: 5.3, h: 2.2, fontSize: 14, color: ONDARK, paraSpaceAfter: 8 });
    };
    col(0.6, 'checkD', 'When they win', AMBER, [
      `Large, smooth real data: ${rng(wins.map(r => r.vsTuned), 1)} over the best tuned search, ${rng(sosd.map(r => r.budget))} over a B+tree at 10 MB.`,
      'Out of cache: 2 to 6 DRAM fills per lookup, against 8 to 10 for a B+tree. The build pays back within 0.3 lookups per key.',
      'On all three CPUs the lead over binary search grows with data size: 6.5× (AMD), 9.4× (Intel), 8.6× (Apple) at 100M keys.']);
    col(6.77, 'xD', 'When they do not', COOL2, [
      `Outliers: 20 keys of fb break the RMI and RadixSpline, and the best learned index loses to the tuned search (${loss.map(r => r.vsTuned.toFixed(2)).join(', ')}×).`,
      'In cache: a tuned search beats the RMI by 1.1 to 3.6×; on the M6, even plain binary search does.',
      'Heavy inserts, long scans and tight latency targets (the RMI p99 tail) favor simpler or error-bounded designs.']);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.35, w: 12.13, h: 1.1, rectRadius: 0.12, fill: { color: NIGHT }, line: { color: FAINT, width: 1, dashType: 'dash' } });
    T(s, [{ text: 'Does the 2018 claim hold?  ', options: { bold: true, color: AMBER } },
          { text: `In direction, not in size. Against the best tuned search the learned lead is ${rng(wins.map(r => r.vsTuned), 1)}, not the ${rng(sosd.map(r => r.vsStd))} measured against std::lower_bound. Per byte of memory it is clear.`, options: { color: WHITE } }],
      { x: 0.9, y: 5.45, w: 11.6, h: 0.9, fontSize: 14, valign: 'middle' });
    s.addNotes('Numbers: report Sections 5 to 8 (Tables 3, 4 and 6, from wp12_summary.csv), Section 6 (counters) and Section 7 (ALEX on the M6; three CPUs). Keep in sync with the Conclusion of the report.'); }

  { const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Conclusion' });
    T(s, 'Questions?', { x: 0.6, y: 1.6, w: 12, h: 1.4, fontFace: HF, fontSize: 66, bold: true, color: WHITE, valign: 'bottom' });
    T(s, 'Code, data and results: github.com/khangpt2k6/CIS4930', { x: 0.6, y: 3.2, w: 12, h: 0.45, fontSize: 20, color: ONDARK });
    T(s, 'Riyon Praveen  ·  Vishakha Tiwari  ·  Sevara Badriddinova  ·  Tuan Khang Phan', { x: 0.6, y: 3.75, w: 12, h: 0.4, fontSize: 15, color: FAINT });
    arrayStrip(s, 0.6, 6.25, 32, 0.32, 0.067, 18, 24, 21, NIGHT2, '5A2A22');
    s.addNotes('References: [1] Kraska et al., SIGMOD 2018. [2] Marcus et al., PVLDB 14(1) 2020. [3] Ferragina and Vinciguerra, PVLDB 13(8) 2020. [4] Kipf et al., aiDM 2020. [5] Ding et al., SIGMOD 2020.'); }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('written ' + OUT);
}
build().catch(e => { console.error(e); process.exit(1); });
