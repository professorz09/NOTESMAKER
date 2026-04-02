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

export function canvasPageToPngBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1];
}

export function cropImageFromCanvas(
  canvas: HTMLCanvasElement,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number
): string {
  const x = Math.round((xPct / 100) * canvas.width);
  const y = Math.round((yPct / 100) * canvas.height);
  const w = Math.max(1, Math.round((wPct / 100) * canvas.width));
  const h = Math.max(1, Math.round((hPct / 100) * canvas.height));

  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d')!;
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return crop.toDataURL('image/png').split(',')[1];
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}
