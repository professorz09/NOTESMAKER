export const STORAGE_KEY = 'ai_book_writer_draft';

export const extractImagesFromHtml = (html: string): { base64: string; mimeType: string }[] => {
  const results: { base64: string; mimeType: string }[] = [];
  const regex = /<img[^>]+src="(data:(image\/[a-zA-Z+]+);base64,([^"]+))"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    results.push({ base64: match[3], mimeType: match[2] });
  }
  return results;
};

export const getSectionNodes = (startNode: Element): Element[] => {
  const nodes: Element[] = [startNode];
  const getLevel = (tag: string) => {
    const t = tag.toUpperCase();
    if (t === 'H1') return 1;
    if (t === 'H2') return 2;
    if (t === 'H3') return 3;
    if (t === 'H4') return 4;
    return 10;
  };
  const currentLevel = getLevel(startNode.tagName);
  if (currentLevel <= 4) {
    let next = startNode.nextElementSibling;
    while (next) {
      if (getLevel(next.tagName) <= currentLevel) break;
      nodes.push(next);
      next = next.nextElementSibling;
    }
  }
  return nodes;
};

export const buildPrintHtml = (content: string, fontSize: number): string => {
  const printFontSize = fontSize < 10 ? 10 : fontSize;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Export Notes</title>
  <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Inter', sans-serif; font-size: ${printFontSize}pt; line-height: 1.4; color: #1e293b; background: white; margin: 0; padding: 0; }
    h1 { font-family: 'Inter', sans-serif; font-size: 2em; font-weight: 800; color: #0f172a; border-bottom: 3px solid #0f172a; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; page-break-after: avoid; }
    h2 { font-family: 'Inter', sans-serif; font-size: 1.5em; font-weight: 700; color: #1e3a8a; margin-top: 16px; margin-bottom: 8px; page-break-after: avoid; border-bottom: 1px solid #e2e8f0; }
    h3 { font-family: 'Inter', sans-serif; font-size: 1.25em; font-weight: 600; color: #334155; margin-top: 12px; margin-bottom: 6px; page-break-after: avoid; }
    h4 { font-family: 'Inter', sans-serif; font-size: 1.1em; font-weight: 600; color: #475569; margin-top: 10px; margin-bottom: 4px; page-break-after: avoid; }
    p { margin-bottom: 8px; text-align: justify; }
    ul, ol { margin-bottom: 8px; padding-left: 20px; }
    li { margin-bottom: 4px; }
    strong { color: #0f172a; font-weight: 700; }
    .key-point { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px; margin: 12px 0; font-family: 'Inter', sans-serif; font-size: 0.95em; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; border: 2px solid #000 !important; page-break-inside: auto; font-size: 0.9em; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    th { background-color: #f1f5f9 !important; color: #0f172a !important; padding: 6px; font-weight: 600; text-align: left; border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td { border: 1px solid #000 !important; padding: 6px; vertical-align: top; }
    tr:nth-child(even) { background-color: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .flowchart-container { display: flex; justify-content: center; margin: 16px 0; padding: 8px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
    svg { max-width: 100%; height: auto; }
    figure { margin: 16px 0; text-align: center; page-break-inside: avoid; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; }
    figcaption { font-size: 0.9em; color: #666; font-style: italic; margin-top: 4px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print, .ai-edit-trigger { display: none !important; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      tr, .flowchart-container, .key-point, figure, img { page-break-inside: avoid; }
      p, li { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  ${content}
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 800); }</script>
</body>
</html>`;
};
