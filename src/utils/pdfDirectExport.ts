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
// top-level blocks are packed into pages, and for each page ONLY that page's
// blocks live in the capture wrapper while it's rasterized. Each capture is
// then O(1 page), total work is O(pages), and the per-page canvas is released
// immediately so memory stays flat no matter how long the document is.
//
// Page breaks land on top-level block boundaries, so a heading/paragraph/list/
// table is never sliced through the middle. A single block taller than a whole
// page (a huge table or diagram) is the one unavoidable exception — it is
// raster-sliced across pages, which is the best that can be done without
// re-laying-out the element itself.
// ---------------------------------------------------------------------------

const MM_TO_PX = 96 / 25.4; // CSS px per mm at 96dpi, the unit html-to-image/canvas work in
const PAGE_MARGIN_MM = 14;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH_MM * MM_TO_PX);
const PAGE_HEIGHT_PX = Math.round(CONTENT_HEIGHT_MM * MM_TO_PX);

interface PageChunk { html: string; oversized: boolean }

// Pack contiguous top-level blocks into pages that each fit within one A4
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

export interface DirectPdfExportOptions {
  fontSize: number;
  lineHeight: number;
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}

export async function exportContentAsPdfDirect(content: string, opts: DirectPdfExportOptions): Promise<void> {
  const { fontSize, lineHeight, fileName, onProgress } = opts;
  if (!content.trim()) throw new Error('No content to export.');

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
  document.head.appendChild(styleTag);

  // Off-screen HOST that hides the whole rig from the user. The off-screen
  // shift lives on this PARENT, never on the node we rasterize: html-to-image
  // copies the captured node's own position/offset into the SVG it renders, so
  // a `left:-99999px` on the captured node itself would paint a blank page.
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1;';

  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-content';
  wrapper.style.cssText = `position:relative;width:${CONTENT_WIDTH_PX}px;background:#ffffff;color:#1e293b;font-family:'Noto Sans Devanagari','Noto Sans','Inter',sans-serif;font-size:${Math.max(fontSize, 10)}pt;line-height:${lineHeight};`;
  wrapper.innerHTML = content;

  offscreen.appendChild(wrapper);
  document.body.appendChild(offscreen);

  try {
    // --- Measure pass: lay the whole document out once, record each top-level
    // block's position, then pack them into pages. This is the only time the
    // full DOM is in the wrapper. ---
    await waitForAssets(wrapper);
    if (wrapper.scrollHeight < 1) throw new Error('Content has no visible height to export.');

    const wrapperTop = wrapper.getBoundingClientRect().top;
    const children = Array.from(wrapper.children) as HTMLElement[];
    const blocks = children.map((el) => {
      const r = el.getBoundingClientRect();
      return { html: el.outerHTML, top: r.top - wrapperTop, bottom: r.bottom - wrapperTop };
    });

    const pages: PageChunk[] = blocks.length
      ? packBlocksIntoPages(blocks, PAGE_HEIGHT_PX)
      : [{ html: content, oversized: wrapper.scrollHeight > PAGE_HEIGHT_PX }];
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
    const addImagePage = (imgData: string, heightPx: number) => {
      if (pdfPageAdded) doc.addPage();
      doc.addImage(imgData, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, CONTENT_WIDTH_MM, heightPx / MM_TO_PX, undefined, 'FAST');
      pdfPageAdded = true;
    };

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length);

      // Only this page's blocks are in the wrapper while it's captured, so
      // html-to-image serializes just this page — not the whole document.
      wrapper.innerHTML = pages[i].html;
      await waitForAssets(wrapper);
      const pageHeightPx = Math.max(1, wrapper.scrollHeight);

      const canvas = await toCanvas(wrapper, {
        pixelRatio,
        backgroundColor: '#ffffff',
        width: CONTENT_WIDTH_PX,
        height: pageHeightPx,
        fontEmbedCSS,
      });

      if (!pages[i].oversized || canvas.height <= PAGE_HEIGHT_PX * pixelRatio + 1) {
        addImagePage(canvas.toDataURL('image/jpeg', quality), pageHeightPx);
      } else {
        // Oversized single block — raster-slice its canvas across pages.
        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d')!;
        const sliceHpx = Math.round(PAGE_HEIGHT_PX * pixelRatio);
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
