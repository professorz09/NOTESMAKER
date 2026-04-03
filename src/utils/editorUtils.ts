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
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Export Notes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans:wght@400;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Noto Sans Devanagari', 'Noto Sans', 'Inter', sans-serif;
      font-size: ${printFontSize}pt;
      line-height: 1.5;
      color: #1e293b;
      background: white;
      margin: 0;
      padding: 0;
    }

    /* Headings */
    h1 { font-size: 2em; font-weight: 800; color: #0f172a; border-bottom: 3px solid #0f172a; padding-bottom: 6px; margin: 0 0 14px; page-break-after: avoid; break-after: avoid; }
    h2 { font-size: 1.5em; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 16px 0 8px; page-break-after: avoid; break-after: avoid; }
    h3 { font-size: 1.2em; font-weight: 600; color: #334155; margin: 14px 0 6px; page-break-after: avoid; break-after: avoid; }
    h4 { font-size: 1.05em; font-weight: 600; color: #475569; margin: 10px 0 4px; page-break-after: avoid; break-after: avoid; }

    /* Body text */
    p { margin-bottom: 8px; text-align: justify; line-height: 1.55; }
    ul, ol { margin-bottom: 8px; padding-left: 20px; }
    li { margin-bottom: 4px; }
    strong { color: #0f172a; font-weight: 700; }

    /* Rich elements */
    .key-point {
      background-color: #f8fafc !important;
      border-left: 4px solid #3b82f6 !important;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 0.95em;
      page-break-inside: avoid; break-inside: avoid;
      border-radius: 0 6px 6px 0;
    }
    .note-box {
      background-color: #fefce8 !important;
      border: 1px solid #facc15 !important;
      border-left: 4px solid #eab308 !important;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 0.95em;
      color: #854d0e !important;
      page-break-inside: avoid; break-inside: avoid;
    }
    .note-box::before {
      content: '💡 Note';
      display: block;
      font-weight: 700;
      font-size: 0.82em;
      text-transform: uppercase;
      margin-bottom: 5px;
      color: #a16207 !important;
      letter-spacing: 0.05em;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 12px 0; border: 1.5px solid #000 !important; page-break-inside: auto; font-size: 0.88em; }
    caption { font-weight: 600; font-size: 0.9em; text-align: center; padding: 4px 0 6px; color: #1e293b; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background-color: #f1f5f9 !important; color: #0f172a !important; padding: 7px 8px; font-weight: 700; text-align: left; border: 1px solid #000 !important; }
    td { border: 1px solid #000 !important; padding: 7px 8px; vertical-align: top; }
    tr:nth-child(even) { background-color: #f8fafc !important; }

    /* SVG / Flowchart */
    .flowchart-container { display: flex; justify-content: center; margin: 14px 0; padding: 8px; border: 1px solid #e2e8f0; page-break-inside: avoid; break-inside: avoid; }
    svg { max-width: 100% !important; height: auto !important; display: block; }

    /* Figures & Images */
    figure { margin: 14px 0; text-align: center; page-break-inside: avoid; break-inside: avoid; }
    figure.pdf-figure { display: block; margin: 14px auto; text-align: center; page-break-inside: avoid; break-inside: avoid; }
    figure.pdf-figure img { max-width: 100%; height: auto; display: block; margin: 0 auto; border: 1px solid #e2e8f0 !important; }
    img { max-width: 100%; height: auto; border: none; }
    figcaption, .pdf-figcaption { font-size: 0.82em; color: #555; font-style: italic; margin-top: 4px; display: block; text-align: center; }

    /* Page section */
    .page-section { display: block; margin-bottom: 1em; }

    /* PDF page divider — just a page break, no visual bar in print */
    .pdf-page-divider { display: block; page-break-before: always; break-before: page; height: 0; overflow: hidden; border: none; margin: 0; }
    .pdf-page-num { display: none; }

    /* Question list */
    ol.question-list { list-style: none !important; padding: 0 !important; margin: 10px 0; counter-reset: q-counter; }
    ol.question-list li.question-item {
      counter-increment: q-counter;
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 6px;
      background: #f8fafc !important;
      border-left: 3px solid #3b82f6 !important;
      page-break-inside: avoid; break-inside: avoid;
    }
    ol.question-list li.question-item::before { content: 'Q' counter(q-counter) '.'; font-weight: 700; color: #3b82f6; white-space: nowrap; min-width: 1.8em; }

    /* Math */
    .math { font-family: 'Courier New', monospace !important; font-size: 0.9em; background: #f1f5f9 !important; padding: 1px 4px; border-radius: 2px; }

    /* Image placeholder */
    .image-placeholder { border: 2px dashed #f97316 !important; padding: 14px; margin: 14px 0; text-align: center; border-radius: 8px; page-break-inside: avoid; background: #fff7ed !important; }
    .image-placeholder-icon { font-size: 1.5rem; }
    .image-placeholder-title { font-weight: 700; color: #c2410c !important; font-size: 0.88em; margin-top: 6px; }
    .image-placeholder-desc { font-size: 0.8em; color: #78350f !important; margin-top: 4px; }

    /* Table of contents */
    .table-of-contents { border: 1px solid #e2e8f0; padding: 16px 20px; margin-bottom: 20px; page-break-after: always; }
    .table-of-contents h2 { font-size: 1.1em !important; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0 !important; }
    .table-of-contents ul { list-style: none !important; padding-left: 0 !important; }
    .table-of-contents a { color: #475569 !important; text-decoration: none !important; display: flex; justify-content: space-between; }

    /* Answer analysis */
    .answer-analysis .section-card { page-break-inside: avoid; break-inside: avoid; margin-bottom: 12px; padding: 14px; }

    /* Prevent orphans */
    p, li { orphans: 3; widows: 3; }

    /* Hide edit buttons */
    .no-print, .ai-edit-trigger { display: none !important; }
  </style>
</head>
<body>
  ${content}
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 900); }</script>
</body>
</html>`;
};
