// Builds report/final_report.docx from report/final_report.md (run build_final_report.py first).
//   node report/build_docx.js            needs the npm package docx (npm install docx)
// Then make the PDF with Word:  powershell -File report/docx_to_pdf.ps1
// Style: US Letter, 1 inch margins, single column, Times New Roman 11 pt, black text, hyphen lists, colored figures.
// Handles the Markdown subset the section files use: headings, paragraphs, **bold**, *italic*, `code`, x^y
// superscripts, pipe tables, images and "- " lists. References start on a new page (they do not count toward 8 pages).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, HeadingLevel, PageBreak, Footer, PageNumber, ShadingType,
} = require('docx');

const HERE = __dirname;
const SRC = path.join(HERE, 'final_report.md');
const OUT = path.join(HERE, 'final_report.docx');
const FONT = 'Times New Roman';
const TEXT_W = 9360; // 6.5 in in DXA
const BODY = 22, SMALL = 18; // half-points: 11 pt body, 9 pt tables

function inline(text, base = {}) {
  // split into runs: **bold**, *italic*, `code`, a^b superscript
  const runs = [];
  text = text.replace(/\\\*/g, '\u0001'); // an escaped \* is a literal asterisk
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\d\^[\d.]+)/g;
  let last = 0, m;
  const push = (t, o = {}) => { if (t) runs.push(new TextRun(Object.assign({ text: t.replace(/\u0001/g, '*'), font: FONT }, base, o))); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith('`')) push(tok.slice(1, -1));
    else if (tok.startsWith('*')) push(tok.slice(1, -1), { italics: true });
    else { const [a, b] = tok.split('^'); push(a); push(b, { superScript: true }); }
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return runs;
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(lines) {
  const rows = lines.map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const align = rows[1].map(c => (c.endsWith(':') ? AlignmentType.RIGHT : AlignmentType.LEFT));
  const body = [rows[0]].concat(rows.slice(2));
  const ncol = rows[0].length;
  // column widths: proportional to the longest cell text, with a floor
  const lens = Array.from({ length: ncol }, (_, j) => Math.max(...body.map(r => (r[j] || '').replace(/[*`]/g, '').length)));
  const weights = lens.map(l => Math.max(6, Math.min(l, 60)));
  const tot = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(w => Math.floor(TEXT_W * w / tot));
  widths[ncol - 1] += TEXT_W - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: body.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => new TableCell({
        width: { size: widths[j], type: WidthType.DXA }, borders,
        margins: { top: 30, bottom: 30, left: 70, right: 70 },
        shading: i === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFFFF' } : undefined,
        children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : align[j], spacing: { before: 0, after: 0 },
          children: inline(c, { size: SMALL, bold: i === 0 ? true : undefined }) })],
      })),
    })),
  });
}

function build() {
  const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
  const children = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const text = para.join(' ');
    const caption = /^\*\*(Table|Figure) \d/.test(text);
    children.push(new Paragraph({ spacing: { before: caption ? 120 : 0, after: caption ? 60 : 120 }, keepNext: caption && text.startsWith('**Table'),
      alignment: AlignmentType.JUSTIFIED, children: inline(text, { size: caption ? 20 : BODY }) }));
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('> ')) { flush(); continue; } // build notes are not part of the document
    let m;
    if ((m = line.match(/^# (.*)/))) {
      flush();
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: inline(m[1], { size: 32, bold: true }) }));
      continue;
    }
    if ((m = line.match(/^(##+) (.*)/))) {
      flush();
      const level = m[1].length;
      const title = m[2];
      if (/^References/.test(title)) children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ heading: level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, keepNext: true,
        spacing: { before: level === 2 ? 200 : 140, after: 80 }, children: inline(title, { size: level === 2 ? 26 : BODY, bold: true, color: '000000' }) }));
      continue;
    }
    if (/^\*CIS 4930/.test(line)) {
      flush();
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: inline(line.replace(/^\*|\*$/g, ''), { size: BODY, italics: true }) }));
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const block = [];
      while (i < lines.length && lines[i].startsWith('|')) block.push(lines[i++]);
      i--;
      children.push(table(block));
      children.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }));
      continue;
    }
    if ((m = line.match(/^!\[[^\]]*\]\(([^)]+)\)/))) {
      flush();
      const img = pngSize(path.join(HERE, m[1]));
      const w = 6.5 * 96, h = Math.round(w * img.h / img.w);
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 60, after: 0 },
        children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: w, height: h },
          altText: { title: path.basename(m[1]), description: path.basename(m[1]), name: path.basename(m[1]) } })] }));
      continue;
    }
    if ((m = line.match(/^- (.*)/))) {
      flush();
      children.push(new Paragraph({ indent: { left: 360, hanging: 216 }, spacing: { after: 60 }, alignment: AlignmentType.LEFT,
        children: inline('- ' + m[1], { size: BODY }) }));
      continue;
    }
    para.push(line.trim());
  }
  flush();
  const doc = new Document({
    creator: 'CIS 4930 Team 01', title: 'Do Learned Indexes Still Win on Modern Hardware?',
    styles: {
      default: { document: { run: { font: FONT, size: BODY, color: '000000' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 26, bold: true, color: '000000' }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: BODY, bold: true, color: '000000' }, paragraph: { spacing: { before: 140, after: 80 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('wrote ' + OUT); });
}

build().catch(e => { console.error(e); process.exit(1); });
