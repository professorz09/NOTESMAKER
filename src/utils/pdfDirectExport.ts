import { buildContentStyleRules } from './editorUtils';

// ---------------------------------------------------------------------------
// Direct PDF download — no browser print dialog.
//
// Renders the notes into a detached, off-screen clone (never touches the live
// React DOM), rasterizes it PAGE BY PAGE with html-to-image, and places each
// page's image into a jsPDF document that downloads straight away.
//
// Memory model (this is what keeps large documents from crashing the tab,
// especially on iOS Safari): html-to-image serializes the *entire* subtree of
// whatever node you hand it — CSS `overflow:hidden` clips what's painted, but
// NOT what gets cloned. So capturing one big clipped wrapper once per page
// re-serializes the whole document on every page → O(pages²) memory and work,
// which blows up on long notes. Instead we chunk the DOM: the content's
// flow blocks are packed into pages, and for each page ONLY that page's
// blocks live in the capture wrapper while it's rasterized. Each capture is
// then O(1 page), total work is O(pages), and the per-page canvas is released
// immediately so memory stays flat no matter how long the document is.
//
// Page breaks land on real content-block boundaries (a heading/paragraph/list/
// table/note-box), so text is never sliced through the middle. Wrapper
// containers (a UPSC answer's <section>, grouping <div>s) are transparently
// descended INTO so the whole answer isn't treated as one giant atomic block —
// that was the old cause of a long answer being raster-sliced (cut) mid-line.
// A single leaf taller than a whole page (a huge table or diagram) is the one
// unavoidable exception — it is raster-sliced across pages.
//
// Two page templates are supported:
//   • 'plain'      — content on a clean A4 sheet with even margins.
//   • 'answerCopy' — content inside a printed UPSC answer-copy frame
//                    (PROFESSOR / UPSC header, Q.No. margin column, the
//                    "Candidates must not write on this margin" note, a ruled
//                    border and a centered page number) drawn crisply as
//                    vectors on every page.
// ---------------------------------------------------------------------------

const MM_TO_PX = 96 / 25.4; // CSS px per mm at 96dpi, the unit html-to-image/canvas work in
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export type PdfTemplate = 'plain' | 'answerCopy';

// Where the content image sits on each A4 page, per template. All in mm.
interface PageGeometry {
  contentXmm: number; // left offset of the content image
  contentYmm: number; // top offset of the content image
  contentWmm: number; // content image width
  contentHmm: number; // usable content height per page
}

const PLAIN_MARGIN_MM = 14;
const PLAIN_GEO: PageGeometry = {
  contentXmm: PLAIN_MARGIN_MM,
  contentYmm: PLAIN_MARGIN_MM,
  contentWmm: A4_WIDTH_MM - PLAIN_MARGIN_MM * 2,
  contentHmm: A4_HEIGHT_MM - PLAIN_MARGIN_MM * 2,
};

// --- Answer-copy frame geometry (mm) -------------------------------------
const AC = {
  frameLeft: 15,
  frameRight: 197,
  headerTopLine: 16,   // horizontal rule under "PROFESSOR"
  headerSepLine: 31,   // horizontal rule under the UPSC header row (top of writing area)
  frameBottom: 286,
  marginLineX: 31,     // vertical answer-margin rule
  contentX: 34,        // left edge of writing area (right of the margin rule)
  contentRight: 194,   // right edge of writing area
  contentTop: 34,
  contentBottom: 281,
  pageNumY: 291,
};
const AC_GEO: PageGeometry = {
  contentXmm: AC.contentX,
  contentYmm: AC.contentTop,
  contentWmm: AC.contentRight - AC.contentX,
  contentHmm: AC.contentBottom - AC.contentTop,
};

const geometryFor = (t: PdfTemplate): PageGeometry => (t === 'answerCopy' ? AC_GEO : PLAIN_GEO);

interface PageChunk { html: string; oversized: boolean }

// Elements that must be captured whole — splitting them mid-way would break
// their meaning or their box (a list item's bullet, a table's rows, a boxed
// callout's border). The paginator never descends into these.
const ATOMIC_TAGS = new Set([
  'UL', 'OL', 'LI', 'TABLE', 'FIGURE', 'PRE', 'BLOCKQUOTE', 'IMG', 'SVG', 'HR',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P',
]);
const ATOMIC_CLASSES = [
  'note-box', 'key-point', 'table-of-contents', 'flowchart-container',
  'pdf-figure', 'image-placeholder', 'math', 'generated-image-container',
  'answer-analysis', 'question-list',
];

function isAtomicBlock(el: HTMLElement): boolean {
  if (ATOMIC_TAGS.has(el.tagName)) return true;
  for (const c of ATOMIC_CLASSES) if (el.classList.contains(c)) return true;
  return false;
}

// Descend through pure grouping containers (a UPSC answer's <section>, the
// <div> wrappers a pipeline emits) down to the real flow blocks, so page
// breaks land between actual paragraphs/headings/lists instead of slicing a
// wrapper's rasterized bitmap. A container with no element children (e.g. a
// bare styled <div> of text) is itself treated as a block.
function collectFlowBlocks(container: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const isContainer =
      (child.tagName === 'SECTION' || child.tagName === 'DIV' || child.tagName === 'ARTICLE') &&
      !isAtomicBlock(child) &&
      child.children.length > 0;
    if (isContainer) out.push(...collectFlowBlocks(child));
    else out.push(child);
  }
  return out;
}

// Pack contiguous flow blocks into pages that each fit within one page's
// content box. A block taller than a page becomes its own (oversized) page.
function packBlocksIntoPages(
  blocks: { html: string; top: number; bottom: number }[],
  pageHeightPx: number,
): PageChunk[] {
  const pages: PageChunk[] = [];
  let i = 0;
  let guard = 0;
  while (i < blocks.length && guard++ < 100000) {
    const pageTop = blocks[i].top;
    if (blocks[i].bottom - pageTop > pageHeightPx) {
      // A single block that can't fit a page — raster-sliced later.
      pages.push({ html: blocks[i].html, oversized: true });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < blocks.length && blocks[j + 1].bottom - pageTop <= pageHeightPx) j++;
    pages.push({ html: blocks.slice(i, j + 1).map((b) => b.html).join(''), oversized: false });
    i = j + 1;
  }
  return pages;
}

async function waitForAssets(root: HTMLElement) {
  const fontsReady = (document as any).fonts?.ready?.catch(() => {}) ?? Promise.resolve();
  const imgs = Array.from(root.querySelectorAll('img'));
  const imgsReady = Promise.all(imgs.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  }));
  await Promise.all([fontsReady, imgsReady]);
  // One extra frame so layout settles after images finish decoding.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// Free a canvas' backing store so the GC can reclaim it immediately instead of
// letting dozens of full-page bitmaps pile up across a long export.
function releaseCanvas(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

// Clean B/W overrides that turn the app's coloured UI callouts into a plain,
// print-friendly exam-copy look for the answer-copy template — no purple
// question box, no yellow note box, black headings.
const ANSWER_COPY_OVERRIDES = (prefix: string) => {
  const p = prefix ? `${prefix} ` : '';
  return `
    ${p}h1, ${p}h2, ${p}h3, ${p}h4 { color: #111 !important; border-bottom: none !important; }
    ${p}h2 { border-bottom: 1px solid #444 !important; padding-bottom: 3px; }
    ${p}strong { color: #111 !important; }
    ${p}.upsc-subject-tag { display: none !important; }
    ${p}.upsc-question {
      background: none !important; color: #111 !important; border: none !important;
      border-bottom: 2px solid #111 !important; border-radius: 0 !important;
      padding: 0 0 5px 0 !important; margin: 0 0 12px 0 !important; font-weight: 700;
    }
    ${p}.upsc-qa-divider { border-top: 1px solid #999 !important; }
    ${p}.note-box {
      background: #fff !important; border: 1px solid #333 !important;
      border-left: 3px solid #111 !important; color: #111 !important;
    }
    ${p}.note-box::before { color: #111 !important; content: 'तथ्य' !important; }
    ${p}.key-point {
      background: #fff !important; border-left: 3px solid #111 !important; color: #111 !important;
    }
  `;
};

// Draw the printed answer-copy frame (border, PROFESSOR / UPSC header, the
// Q.No. margin column, the margin note and a centered page number) onto the
// current jsPDF page as crisp vectors.
function drawAnswerCopyFrame(doc: any, pageNum: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.4);

  // "PROFESSOR" centered above the top rule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text('PROFESSOR', A4_WIDTH_MM / 2, 12.5, { align: 'center', charSpace: 0.5 });

  // Header rules + outer verticals
  doc.line(AC.frameLeft, AC.headerTopLine, AC.frameRight, AC.headerTopLine);
  doc.line(AC.frameLeft, AC.headerSepLine, AC.frameRight, AC.headerSepLine);
  doc.line(AC.frameLeft, AC.headerTopLine, AC.frameLeft, AC.frameBottom);
  doc.line(AC.frameRight, AC.headerTopLine, AC.frameRight, AC.frameBottom);
  doc.line(AC.frameLeft, AC.frameBottom, AC.frameRight, AC.frameBottom);

  // Vertical answer-margin rule
  doc.setLineWidth(0.3);
  doc.line(AC.marginLineX, AC.headerSepLine, AC.marginLineX, AC.frameBottom);

  // "UPSC" title, centered in the header row
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15);
  doc.text('UPSC', A4_WIDTH_MM / 2, 26, { align: 'center' });

  // Left "Q. No." label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(60);
  doc.text(['Q. No.', '(Write', 'Q. No.)'], AC.frameLeft + 1.5, 21, { lineHeightFactor: 1.35 });

  // Right "Candidates must not write on this margin" note
  doc.text(
    ['Candidates', 'must not', 'write on', 'this margin'],
    AC.frameRight - 1.5, 21, { align: 'right', lineHeightFactor: 1.35 },
  );

  // Centered page number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(String(pageNum), A4_WIDTH_MM / 2, AC.pageNumY, { align: 'center' });

  // Reset for any following draws
  doc.setTextColor(0);
}

export interface DirectPdfExportOptions {
  fontSize: number;
  lineHeight: number;
  fileName: string;
  template?: PdfTemplate;
  onProgress?: (current: number, total: number) => void;
}

export async function exportContentAsPdfDirect(content: string, opts: DirectPdfExportOptions): Promise<void> {
  const { fontSize, lineHeight, fileName, onProgress } = opts;
  const template: PdfTemplate = opts.template ?? 'plain';
  if (!content.trim()) throw new Error('No content to export.');

  const geo = geometryFor(template);
  const contentWidthPx = Math.round(geo.contentWmm * MM_TO_PX);
  const pageHeightPx = Math.round(geo.contentHmm * MM_TO_PX);

  const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);

  // Scoped stylesheet — only touches elements under .pdf-export-content, so it
  // can never leak into the live app (same class-scoping discipline as the
  // sanitizer's SVG <style> fix).
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-pdf-export', 'true');
  styleTag.textContent = buildContentStyleRules('.pdf-export-content', Math.max(fontSize, 10), lineHeight);
  if (template === 'answerCopy') styleTag.textContent += ANSWER_COPY_OVERRIDES('.pdf-export-content');
  document.head.appendChild(styleTag);

  // Off-screen HOST that hides the whole rig from the user. The off-screen
  // shift lives on this PARENT, never on the node we rasterize: html-to-image
  // copies the captured node's own position/offset into the SVG it renders, so
  // a `left:-99999px` on the captured node itself would paint a blank page.
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1;';

  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-content';
  wrapper.style.cssText = `position:relative;width:${contentWidthPx}px;background:#ffffff;color:#1e293b;font-family:'Noto Sans Devanagari','Noto Sans','Inter',sans-serif;font-size:${Math.max(fontSize, 10)}pt;line-height:${lineHeight};`;
  wrapper.innerHTML = content;

  offscreen.appendChild(wrapper);
  document.body.appendChild(offscreen);

  try {
    // --- Measure pass: lay the whole document out once, record each flow
    // block's position, then pack them into pages. This is the only time the
    // full DOM is in the wrapper. ---
    await waitForAssets(wrapper);
    if (wrapper.scrollHeight < 1) throw new Error('Content has no visible height to export.');

    const wrapperTop = wrapper.getBoundingClientRect().top;
    const flowBlocks = collectFlowBlocks(wrapper);
    const blocks = flowBlocks.map((el) => {
      const r = el.getBoundingClientRect();
      return { html: el.outerHTML, top: r.top - wrapperTop, bottom: r.bottom - wrapperTop };
    });

    const pages: PageChunk[] = blocks.length
      ? packBlocksIntoPages(blocks, pageHeightPx)
      : [{ html: content, oversized: wrapper.scrollHeight > pageHeightPx }];
    if (!pages.length) throw new Error('Could not paginate content.');

    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    // Resolution + JPEG quality scale down as the document grows, so a long
    // export stays sharp enough for print without ballooning memory/file size.
    const pixelRatio = pages.length > 40 ? 1.25 : pages.length > 20 ? 1.5 : 2;
    const quality = pages.length > 25 ? 0.82 : 0.9;

    // Embed the web fonts (incl. Noto Sans Devanagari) ONCE and reuse it for
    // every page. Otherwise html-to-image re-reads/re-fetches the cross-origin
    // Google-Fonts CSS on each capture — slow on long docs and a hang risk.
    // Degrades to the document's already-loaded fonts if it can't be built.
    let fontEmbedCSS = '';
    try {
      fontEmbedCSS = await Promise.race([
        getFontEmbedCSS(wrapper),
        new Promise<string>((res) => setTimeout(() => res(''), 8000)),
      ]);
    } catch { fontEmbedCSS = ''; }

    let pdfPageAdded = false;
    let pageCount = 0;
    // Open a fresh page (frame + page number for the answer-copy template) and
    // place a content image inside its writing area.
    const addImagePage = (imgData: string, heightPx: number) => {
      if (pdfPageAdded) doc.addPage();
      pageCount += 1;
      if (template === 'answerCopy') drawAnswerCopyFrame(doc, pageCount);
      doc.addImage(imgData, 'JPEG', geo.contentXmm, geo.contentYmm, geo.contentWmm, heightPx / MM_TO_PX, undefined, 'FAST');
      pdfPageAdded = true;
    };

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length);

      // Only this page's blocks are in the wrapper while it's captured, so
      // html-to-image serializes just this page — not the whole document.
      wrapper.innerHTML = pages[i].html;
      await waitForAssets(wrapper);
      const capturedHeightPx = Math.max(1, wrapper.scrollHeight);

      const canvas = await toCanvas(wrapper, {
        pixelRatio,
        backgroundColor: '#ffffff',
        width: contentWidthPx,
        height: capturedHeightPx,
        fontEmbedCSS,
      });

      if (!pages[i].oversized || canvas.height <= pageHeightPx * pixelRatio + 1) {
        addImagePage(canvas.toDataURL('image/jpeg', quality), capturedHeightPx);
      } else {
        // Oversized single block — raster-slice its canvas across pages.
        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d')!;
        const sliceHpx = Math.round(pageHeightPx * pixelRatio);
        for (let y = 0; y < canvas.height; y += sliceHpx) {
          const h = Math.min(sliceHpx, canvas.height - y);
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = h;
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, canvas.width, h);
          sliceCtx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
          addImagePage(sliceCanvas.toDataURL('image/jpeg', quality), h / pixelRatio);
        }
        releaseCanvas(sliceCanvas);
      }

      releaseCanvas(canvas);
      // Yield to the event loop so the browser can paint/GC between pages
      // instead of holding every page's bitmap live at once.
      await new Promise((r) => setTimeout(r, 0));
    }

    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } finally {
    document.body.removeChild(offscreen);
    document.head.removeChild(styleTag);
  }
}
