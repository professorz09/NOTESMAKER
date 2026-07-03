import { buildContentStyleRules } from './editorUtils';

// ---------------------------------------------------------------------------
// Direct PDF download — no browser print dialog.
//
// Renders the notes into a detached, off-screen clone (never touches the
// live React DOM), rasterizes it page-by-page with html-to-image, and places
// each page's image into a jsPDF document that downloads straight away.
//
// Why not "one tall screenshot sliced into fixed-height strips" (the naive
// approach)? A fixed pixel-height slice has no idea where a table row,
// paragraph or diagram ends — it happily cuts straight through the middle of
// whichever element sits at the boundary. Instead, this measures every
// "atomic" element (heading, paragraph, list item, table row, note box,
// diagram, …) in the untransformed clone and only ever ends a page exactly at
// one of those boundaries, so nothing real gets sliced in half. The rare
// fallback (a single element taller than a full page — a huge diagram) still
// hard-breaks, which is unavoidable without redrawing that element itself.
// ---------------------------------------------------------------------------

const MM_TO_PX = 96 / 25.4; // CSS px per mm at 96dpi, the unit html-to-image/canvas work in
const PAGE_MARGIN_MM = 14;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH_MM * MM_TO_PX);
const PAGE_HEIGHT_PX = Math.round(CONTENT_HEIGHT_MM * MM_TO_PX);

// Elements that must never be sliced across a page boundary. Kept broad on
// purpose — every block type this app's AI output actually generates.
const ATOMIC_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'p', 'li', 'tr', 'hr', 'caption',
  'figure', '.key-point', '.note-box', '.flowchart-container',
  '.image-placeholder', '.answer-analysis .section-card',
  '.upsc-question-header', '.upsc-qa-block', '.table-of-contents',
  '.one-pager-card', '.op-section', '.pdf-figure',
].join(',');

interface Box { top: number; bottom: number; }

function computeBreakpoints(boxes: Box[], totalHeight: number, pageHeightPx: number): number[] {
  const breaks = [0];
  let cursor = 0;
  let guard = 0;
  while (cursor < totalHeight - 1 && guard++ < 5000) {
    const limit = cursor + pageHeightPx;
    if (limit >= totalHeight) { breaks.push(totalHeight); break; }
    let bestBottom = -1;
    for (const b of boxes) {
      if (b.top >= cursor - 0.5 && b.bottom <= limit + 0.5 && b.bottom > bestBottom) {
        bestBottom = b.bottom;
      }
    }
    // Nothing fits fully in the remaining space (a single element taller
    // than one page) — fall back to a hard cut rather than looping forever.
    if (bestBottom <= cursor + 1) bestBottom = limit;
    breaks.push(bestBottom);
    cursor = bestBottom;
  }
  if (breaks[breaks.length - 1] < totalHeight) breaks.push(totalHeight);
  return breaks;
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

export interface DirectPdfExportOptions {
  fontSize: number;
  lineHeight: number;
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}

export async function exportContentAsPdfDirect(content: string, opts: DirectPdfExportOptions): Promise<void> {
  const { fontSize, lineHeight, fileName, onProgress } = opts;
  if (!content.trim()) throw new Error('No content to export.');

  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);

  // Scoped stylesheet — only touches elements under .pdf-export-content, so
  // it can never leak into the live app (same class-scoping discipline as
  // the sanitizer's SVG <style> fix).
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-pdf-export', 'true');
  styleTag.textContent = buildContentStyleRules('.pdf-export-content', Math.max(fontSize, 10), lineHeight);
  document.head.appendChild(styleTag);

  // Fixed-size clipping viewport (what gets captured) containing the full,
  // naturally-tall content wrapper (what gets measured + shifted per page).
  const viewport = document.createElement('div');
  viewport.style.cssText = `position:fixed;left:-99999px;top:0;width:${CONTENT_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;overflow:hidden;background:#ffffff;`;

  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-content';
  wrapper.style.cssText = `width:${CONTENT_WIDTH_PX}px;background:#ffffff;color:#1e293b;font-family:'Noto Sans Devanagari','Noto Sans','Inter',sans-serif;font-size:${Math.max(fontSize, 10)}pt;line-height:${lineHeight};`;
  wrapper.innerHTML = content;

  viewport.appendChild(wrapper);
  document.body.appendChild(viewport);

  try {
    await waitForAssets(wrapper);

    const totalHeight = wrapper.scrollHeight;
    if (totalHeight < 1) throw new Error('Content has no visible height to export.');

    const wrapperRect = wrapper.getBoundingClientRect();
    const boxes: Box[] = Array.from(wrapper.querySelectorAll(ATOMIC_SELECTOR)).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - wrapperRect.top, bottom: r.bottom - wrapperRect.top };
    });

    const breakpoints = computeBreakpoints(boxes, totalHeight, PAGE_HEIGHT_PX);
    const pageCount = breakpoints.length - 1;
    if (pageCount < 1) throw new Error('Could not paginate content.');

    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    // Render at a resolution that stays sharp when printed but doesn't
    // balloon memory/file size on very long documents.
    const pixelRatio = pageCount > 25 ? 1.5 : 2;

    for (let i = 0; i < pageCount; i++) {
      const sliceStart = breakpoints[i];
      const sliceEnd = breakpoints[i + 1];
      const sliceHeightPx = Math.max(1, sliceEnd - sliceStart);

      onProgress?.(i + 1, pageCount);

      viewport.style.height = `${sliceHeightPx}px`;
      wrapper.style.transform = `translateY(-${sliceStart}px)`;
      // Let the transform apply before capture.
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await toCanvas(viewport, {
        pixelRatio,
        backgroundColor: '#ffffff',
        width: CONTENT_WIDTH_PX,
        height: sliceHeightPx,
        cacheBust: true,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.94);
      const sliceHeightMm = sliceHeightPx / MM_TO_PX;

      if (i > 0) doc.addPage();
      doc.addImage(imgData, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, CONTENT_WIDTH_MM, sliceHeightMm, undefined, 'FAST');
    }

    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } finally {
    document.body.removeChild(viewport);
    document.head.removeChild(styleTag);
  }
}
