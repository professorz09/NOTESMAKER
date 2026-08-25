// ---------------------------------------------------------------------------
// Direct DOCX download — converts the generated notes HTML into a real,
// editable Word document (not a rasterized image like the PDF export).
//
// Walks the sanitized HTML with DOMParser and rebuilds it as `docx` library
// primitives: headings keep their level, lists become real bullet/numbered
// paragraphs, tables become real Word tables (colspan/rowspan respected),
// and inline bold/italic/underline/code formatting is preserved. SVG
// diagrams and <img> tags are rasterized/embedded as images so nothing
// visual is silently dropped, just no longer vector.
// ---------------------------------------------------------------------------

const MAX_IMAGE_WIDTH_PX = 600; // ~ usable content width at 96dpi on an A4 page with normal margins

const BLOCK_TAGS = new Set([
  'div', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'hr', 'svg', 'img', 'blockquote', 'pre',
]);

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadImageBytes(src: string): Promise<Uint8Array> {
  if (src.startsWith('data:')) return dataUrlToUint8Array(src);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

// Named system fonts (Arial, Nirmala UI, ...) render DIFFERENTLY on every
// platform — even when a name resolves to "a font that exists" everywhere,
// each OS ships its own actual typeface under that name, so Hindi/English
// text never looks pixel-consistent across devices, and never matches the
// app's own on-screen/print look (which uses Noto Sans + Noto Sans
// Devanagari via Google Fonts). The only way to guarantee identical
// rendering everywhere is to EMBED the real font file inside the .docx
// itself — Word then uses the embedded font directly instead of asking the
// OS to substitute something. Same font family the app already uses.
const FONT_URLS = {
  latin: '/fonts/NotoSans-Regular.ttf',
  devanagari: '/fonts/NotoSansDevanagari-Regular.ttf',
};
async function loadEmbeddedFonts(): Promise<{ latin: Uint8Array; devanagari: Uint8Array } | null> {
  try {
    const [latinRes, devRes] = await Promise.all([fetch(FONT_URLS.latin), fetch(FONT_URLS.devanagari)]);
    if (!latinRes.ok || !devRes.ok) return null;
    const [latin, devanagari] = await Promise.all([
      latinRes.arrayBuffer().then((b) => new Uint8Array(b)),
      devRes.arrayBuffer().then((b) => new Uint8Array(b)),
    ]);
    return { latin, devanagari };
  } catch (err) {
    console.error('DOCX font embedding fetch failed — falling back to named system fonts:', err);
    return null;
  }
}

// The `docx` package writes the font table (word/fontTable.xml) and the
// obfuscated font files, but has no public option to also flip the
// <w:embedTrueTypeFonts> switch in word/settings.xml — and without that
// switch Word treats the embedded fonts as informational only and still
// resolves "Noto Sans" / "Noto Sans Devanagari" against the OS's installed
// fonts, silently defeating the whole embed. Patched in directly here.
async function enableEmbeddedFontRendering(blob: Blob): Promise<Blob> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(blob);
    const settingsFile = zip.file('word/settings.xml');
    if (!settingsFile) return blob;
    let xml = await settingsFile.async('string');
    const flag = '<w:embedTrueTypeFonts w:val="true"/>';
    if (/<w:displayBackgroundShape[^/]*\/>/.test(xml)) {
      xml = xml.replace(/<w:displayBackgroundShape[^/]*\/>/, (m) => `${m}${flag}`);
    } else if (xml.includes('<w:evenAndOddHeaders')) {
      xml = xml.replace('<w:evenAndOddHeaders', `${flag}<w:evenAndOddHeaders`);
    } else {
      xml = xml.replace(/<w:settings[^>]*>/, (m) => `${m}${flag}`);
    }
    zip.file('word/settings.xml', xml);
    return await zip.generateAsync({ type: 'blob', mimeType: blob.type });
  } catch (err) {
    console.error('DOCX embedTrueTypeFonts patch failed — fonts are embedded but Word may not use them:', err);
    return blob;
  }
}

function naturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = src;
  });
}

function scaleToMaxWidth(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_IMAGE_WIDTH_PX || width <= 0) return { width: Math.round(width) || 1, height: Math.round(height) || 1 };
  const scale = MAX_IMAGE_WIDTH_PX / width;
  return { width: MAX_IMAGE_WIDTH_PX, height: Math.max(1, Math.round(height * scale)) };
}

interface InlineStyle { bold?: boolean; italics?: boolean; underline?: boolean; code?: boolean; size?: number }

export async function exportContentAsDocx(
  content: string,
  opts: { fileName: string; onProgress?: (current: number, total: number) => void },
): Promise<void> {
  const { fileName, onProgress } = opts;
  if (!content.trim()) throw new Error('No content to export.');

  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, ImageRun, AlignmentType, ShadingType, LevelFormat, BorderStyle,
  } = await import('docx');

  // A NAMED font (even a genuinely cross-platform one like Arial) still
  // resolves to a DIFFERENT actual typeface file per OS/viewer — so text
  // never comes out pixel-identical across devices, and never matches the
  // app's own on-screen/print look. Embedding the real font FILE (same
  // family the app already uses everywhere else — Noto Sans + Noto Sans
  // Devanagari) is what actually guarantees identical rendering, because
  // Word draws directly from the embedded font instead of asking the OS to
  // substitute something for the name. Falls back to named system fonts
  // only if the font files can't be fetched (e.g. fully offline).
  const embeddedFonts = await loadEmbeddedFonts();
  const LATIN_FONT_NAME = embeddedFonts ? 'Noto Sans' : 'Arial';
  const DEVANAGARI_FONT_NAME = embeddedFonts ? 'Noto Sans Devanagari' : 'Nirmala UI';
  const BODY_FONT = { ascii: LATIN_FONT_NAME, hAnsi: LATIN_FONT_NAME, cs: DEVANAGARI_FONT_NAME };

  // --- inline run collection (bold/italic/underline/code + real line breaks) ---
  const collectRuns = (node: Node, style: InlineStyle): InstanceType<typeof TextRun>[] => {
    const runs: InstanceType<typeof TextRun>[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text) {
          runs.push(new TextRun({
            text,
            // Always a definite boolean (never undefined) — leaving these
            // unset relies on style inheritance to resolve to "off", which
            // is exactly what went wrong: plain paragraphs came out bold.
            bold: !!style.bold,
            italics: !!style.italics,
            underline: style.underline ? {} : undefined,
            font: style.code ? { ascii: 'Courier New', hAnsi: 'Courier New', cs: 'Courier New' } : BODY_FONT,
            size: style.size,
          }));
        }
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') { runs.push(new TextRun({ text: '', break: 1 })); return; }
      if (BLOCK_TAGS.has(tag)) return; // handled by the block walker, not as inline content
      const next: InlineStyle = { ...style };
      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italics = true;
      if (tag === 'u') next.underline = true;
      if (tag === 'code') next.code = true;
      runs.push(...collectRuns(el, next));
    });
    return runs;
  };

  // Colored callout boxes — matches .note-box / .key-point / .ca-verified in
  // index.css exactly (colors, not just presence) so these don't come out a
  // different color from the on-screen preview, and .key-point wasn't
  // getting ANY box styling at all before (fell through to a plain paragraph).
  const BOX_STYLE: Record<string, { fill: string; border: string }> = {
    'note-box': { fill: 'FEFCE8', border: 'FDE68A' },
    'key-point': { fill: 'EFF6FF', border: '2563EB' },
    'ca-verified': { fill: 'EFF6FF', border: '38BDF8' },
  };
  const getBoxStyle = (el: Element) => {
    for (const cls of Object.keys(BOX_STYLE)) if (el.classList?.contains(cls)) return BOX_STYLE[cls];
    return null;
  };

  // .upsc-question / .essay-title are real <h1>/<h2> tags structurally, but
  // must NOT pick up the generic Heading style (blue, underlined, oversized)
  // — the app deliberately renders them as a plain bold (or italic, for the
  // essay title) line instead. See index.css .upsc-question / .essay-title.
  const isPlainHeadingOverride = (el: Element) =>
    el.classList?.contains('upsc-question') || el.classList?.contains('essay-title');

  const paragraphFromInline = (el: Element, headingLevel?: any): InstanceType<typeof Paragraph> => {
    const box = getBoxStyle(el);
    const plainOverride = !!headingLevel && isPlainHeadingOverride(el);
    // Force bold (and italics for the essay title) through collectRuns itself
    // rather than post-processing the resulting TextRuns — a fresh run built
    // with the right style, not a reach into another run's internals.
    const runs = plainOverride
      ? collectRuns(el, { bold: true, italics: el.classList?.contains('essay-title'), size: 26 })
      : collectRuns(el, {});
    return new Paragraph({
      heading: plainOverride ? undefined : headingLevel,
      children: runs.length ? runs : [new TextRun(plainOverride ? { text: '', bold: true, size: 26 } : '')],
      spacing: headingLevel ? { before: 240, after: 120 } : { before: 60, after: 120 },
      shading: box ? { type: ShadingType.SOLID, color: box.fill, fill: box.fill } : undefined,
      border: box ? { left: { style: BorderStyle.SINGLE, size: 18, color: box.border, space: 8 } } : undefined,
    });
  };

  const svgToImageParagraph = async (svgEl: Element): Promise<InstanceType<typeof Paragraph>> => {
    try {
      const { toPng } = await import('html-to-image');
      const offscreen = document.createElement('div');
      offscreen.style.cssText = 'position:fixed;left:-99999px;top:0;background:#ffffff;padding:8px;';
      const clone = svgEl.cloneNode(true) as HTMLElement;
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);
      try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const rect = offscreen.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width)) || 400;
        const height = Math.max(1, Math.round(rect.height)) || 300;
        const dataUrl = await toPng(offscreen, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const bytes = dataUrlToUint8Array(dataUrl);
        const size = scaleToMaxWidth(width, height);
        return new Paragraph({
          children: [new ImageRun({ data: bytes, transformation: size, type: 'png' } as any)],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        });
      } finally {
        document.body.removeChild(offscreen);
      }
    } catch (err) {
      console.error('DOCX diagram embed failed:', err);
      return new Paragraph({ children: [new TextRun({ text: '[Diagram could not be embedded]', italics: true })] });
    }
  };

  const imgToImageParagraph = async (imgEl: HTMLImageElement): Promise<InstanceType<typeof Paragraph>> => {
    const src = imgEl.getAttribute('src') || '';
    try {
      const [bytes, natural] = await Promise.all([loadImageBytes(src), naturalSize(src)]);
      const size = scaleToMaxWidth(natural.width, natural.height);
      const type = /\.png($|\?)/i.test(src) || src.startsWith('data:image/png') ? 'png' : 'jpg';
      return new Paragraph({
        children: [new ImageRun({ data: bytes, transformation: size, type } as any)],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });
    } catch (err) {
      console.error('DOCX image embed failed:', err);
      return new Paragraph({ children: [new TextRun({ text: `[Image: ${imgEl.getAttribute('alt') || 'unavailable'}]`, italics: true })] });
    }
  };

  // Word restarts an ordered list's numbering per NUMBERING INSTANCE, not
  // per <ol> element — every list sharing the same `instance` continues
  // counting from the last one. Each top-level <ol> gets its own instance
  // (bumped in convertNode's 'ol' case below) so two separate numbered lists
  // in one document both correctly start at 1 instead of the second
  // continuing where the first left off; a nested <ol> shares its parent's
  // instance (same list, just one level deeper), which is correct.
  const listToParagraphs = async (listEl: Element, ordered: boolean, level: number, olInstance: number): Promise<any[]> => {
    const items: any[] = [];
    for (const li of Array.from(listEl.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      const nestedLists = Array.from(li.children).filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()));
      const otherBlocks = Array.from(li.children).filter((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()) && !nestedLists.includes(c));
      const runs = collectRuns(li, {});
      items.push(new Paragraph({
        children: runs.length ? runs : [new TextRun('')],
        bullet: ordered ? undefined : { level },
        numbering: ordered ? { reference: 'nm-numbered', level, instance: olInstance } : undefined,
        indent: { left: 360 + level * 360 },
        spacing: { before: 40, after: 40 },
      }));
      for (const blk of otherBlocks) items.push(...await convertNode(blk));
      for (const nested of nestedLists) {
        items.push(...await listToParagraphs(nested, nested.tagName.toLowerCase() === 'ol', level + 1, olInstance));
      }
    }
    return items;
  };

  // Word auto-fits column widths from cell content when none are given,
  // which is exactly what made exported tables look "off" — a table that's
  // clean and evenly spaced on screen comes out with erratic, content-driven
  // column widths and (with no borders set at all) either invisible or
  // default-style gridlines that don't match the app's thin slate borders.
  const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' } as const;
  const TABLE_WIDTH_DXA = 9000; // usable content width at default 1" margins

  const tableToDocxTable = async (tableEl: Element): Promise<InstanceType<typeof Table>> => {
    const colCount = (() => {
      let max = 0;
      tableEl.querySelectorAll('tr').forEach((tr) => {
        let count = 0;
        tr.querySelectorAll(':scope > th, :scope > td').forEach((cell) => {
          count += parseInt(cell.getAttribute('colspan') || '1', 10);
        });
        if (count > max) max = count;
      });
      return max || 1;
    })();

    // Honor a manually-resized table's <colgroup> (see utils/tableEditor.ts)
    // if the column count still matches it; otherwise split evenly.
    const colgroupCols = Array.from(tableEl.querySelectorAll(':scope > colgroup > col'));
    const columnWidths = colgroupCols.length === colCount
      ? colgroupCols.map((c) => {
          const pct = parseFloat((c as HTMLElement).style.width) || (100 / colCount);
          return Math.max(400, Math.round((pct / 100) * TABLE_WIDTH_DXA));
        })
      : new Array(colCount).fill(Math.round(TABLE_WIDTH_DXA / colCount));

    const rows: InstanceType<typeof TableRow>[] = [];
    for (const tr of Array.from(tableEl.querySelectorAll('tr'))) {
      const cells: InstanceType<typeof TableCell>[] = [];
      for (const cellEl of Array.from(tr.children)) {
        const isHeader = cellEl.tagName.toLowerCase() === 'th';
        const runs = collectRuns(cellEl, { bold: isHeader });
        const colSpan = cellEl.getAttribute('colspan');
        const rowSpan = cellEl.getAttribute('rowspan');
        cells.push(new TableCell({
          children: [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })],
          shading: isHeader ? { type: ShadingType.SOLID, color: 'E2E8F0', fill: 'E2E8F0' } : undefined,
          columnSpan: colSpan ? parseInt(colSpan, 10) : undefined,
          rowSpan: rowSpan ? parseInt(rowSpan, 10) : undefined,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
        }));
      }
      if (cells.length) rows.push(new TableRow({ children: cells }));
    }
    if (!rows.length) rows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph('')] })] }));
    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths,
      borders: {
        top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER,
        insideHorizontal: CELL_BORDER, insideVertical: CELL_BORDER,
      },
    });
  };

  const isInlineOnly = (el: Element) => !Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));

  // Bumped once per top-level <ol> — see listToParagraphs for why.
  let olInstanceCounter = 0;

  const convertNode = async (el: Element): Promise<any[]> => {
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'h1': return [paragraphFromInline(el, HeadingLevel.HEADING_1)];
      case 'h2': return [paragraphFromInline(el, HeadingLevel.HEADING_2)];
      case 'h3': return [paragraphFromInline(el, HeadingLevel.HEADING_3)];
      case 'h4': case 'h5': case 'h6': return [paragraphFromInline(el, HeadingLevel.HEADING_4)];
      case 'p': case 'blockquote': return [paragraphFromInline(el)];
      case 'ul': return listToParagraphs(el, false, 0, 0);
      case 'ol': return listToParagraphs(el, true, 0, olInstanceCounter++);
      case 'table': return [await tableToDocxTable(el)];
      case 'hr': return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 } }, spacing: { before: 200, after: 200 } })];
      case 'svg': return [await svgToImageParagraph(el)];
      case 'img': return [await imgToImageParagraph(el as HTMLImageElement)];
      case 'pre': return [new Paragraph({ children: [new TextRun({ text: el.textContent || '', font: 'Courier New' })] })];
      default: {
        if (isInlineOnly(el)) {
          const runs = collectRuns(el, {});
          return runs.length ? [paragraphFromInline(el)] : [];
        }
        const out: any[] = [];
        for (const child of Array.from(el.children)) out.push(...await convertNode(child));
        return out;
      }
    }
  };

  const doc = new DOMParser().parseFromString(`<div id="__root">${content}</div>`, 'text/html');
  const root = doc.getElementById('__root')!;
  const topBlocks = Array.from(root.children);

  const elements: any[] = [];
  for (let i = 0; i < topBlocks.length; i++) {
    onProgress?.(i + 1, topBlocks.length);
    elements.push(...await convertNode(topBlocks[i]));
  }
  if (!elements.length) elements.push(new Paragraph(''));

  const wordDoc = new Document({
    // Registers the actual font DATA in the document's font table so Word
    // renders from the embedded file instead of resolving "Noto Sans" /
    // "Noto Sans Devanagari" against whatever (if anything) the OS has
    // installed under those names.
    fonts: embeddedFonts
      ? ([
          { name: LATIN_FONT_NAME, data: embeddedFonts.latin },
          { name: DEVANAGARI_FONT_NAME, data: embeddedFonts.devanagari },
        ] as any)
      : undefined,
    // Without this, Word's own built-in Heading 1-4 styles are used (a
    // generic, differently-sized blue that has nothing to do with the app's
    // own heading colors) — the biggest reason the exported doc looked
    // nothing like the on-screen preview. Matches .editor-content in index.css.
    styles: {
      default: {
        // Every field spelled out explicitly (bold/font included, not just
        // size) — leaving any of these unset is what let Word fall back to
        // its own inconsistent defaults (bold body text, wrong Devanagari
        // font) instead of the app's actual look.
        document: { run: { size: 24, bold: false, italics: false, font: BODY_FONT } }, // 12pt body text, same as the editor's default
        heading1: { run: { color: '1E293B', bold: true, size: 40, font: BODY_FONT }, paragraph: { spacing: { before: 240, after: 160 } } },
        heading2: {
          run: { color: '1E3A5F', bold: true, size: 32, font: BODY_FONT },
          paragraph: { spacing: { before: 220, after: 140 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0', space: 4 } } },
        },
        heading3: { run: { color: '2563EB', bold: true, size: 28, font: BODY_FONT }, paragraph: { spacing: { before: 200, after: 120 } } },
        heading4: { run: { color: '475569', bold: true, size: 25, font: BODY_FONT }, paragraph: { spacing: { before: 180, after: 100 } } },
      },
    },
    numbering: {
      config: [{
        reference: 'nm-numbered',
        levels: [0, 1, 2].map((level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } },
        })),
      }],
    },
    sections: [{ properties: {}, children: elements }],
  });

  let blob = await Packer.toBlob(wordDoc);
  if (embeddedFonts) blob = await enableEmbeddedFontRendering(blob);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
