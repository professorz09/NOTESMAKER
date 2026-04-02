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

export async function renderPdfPages(
  base64Data: string,
  scale: number = 2
): Promise<RenderedPage[]> {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const pages: RenderedPage[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, viewport }).promise;

    pages.push({
      canvas,
      width: viewport.width,
      height: viewport.height,
      pageNumber: pageNum,
    });
  }

  return pages;
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
