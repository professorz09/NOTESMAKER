import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pageNumber: number;
}

export interface PdfMeta {
  numPages: number;
  pdf: pdfjsLib.PDFDocumentProxy;
}

export async function loadPdf(base64Data: string): Promise<PdfMeta> {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  return { numPages: pdf.numPages, pdf };
}

export async function renderSinglePage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;
  page.cleanup();

  return {
    canvas,
    width: viewport.width,
    height: viewport.height,
    pageNumber,
  };
}

export function canvasPageToJpegBase64(
  canvas: HTMLCanvasElement,
  quality: number = 0.82
): string {
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

export function cropImageFromCanvas(
  canvas: HTMLCanvasElement,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  paddingPct: number = 1.5
): string {
  // Add a small padding so AI's approximate coords don't cut off image edges
  const px = Math.max(0, xPct - paddingPct);
  const py = Math.max(0, yPct - paddingPct);
  const pw = Math.min(100 - px, wPct + paddingPct * 2);
  const ph = Math.min(100 - py, hPct + paddingPct * 2);

  const x = Math.round((px / 100) * canvas.width);
  const y = Math.round((py / 100) * canvas.height);
  const w = Math.max(1, Math.round((pw / 100) * canvas.width));
  const h = Math.max(1, Math.round((ph / 100) * canvas.height));

  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d')!;
  // White background so transparent PNGs render cleanly
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return crop.toDataURL('image/png').split(',')[1];
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}
