import { useState, type MutableRefObject } from 'react';
import {
  generateTopicContent,
  generateSmartTable,
  generateFormattedNotes,
  generateFileNotes,
  generateUPSCAnswer,
  generateResearchPaper,
  translatePdfPageToHindi,
} from '../services/ai';
import { GenerationStatus } from '../types';
import { STORAGE_KEY } from '../utils/editorUtils';
import { loadPdf, renderSinglePage, canvasPageToJpegBase64, cropImageFromCanvas, releaseCanvas } from '../utils/pdfRenderer';

interface UseGenerationProps {
  pushToHistory: (content: string) => void;
  isResettingRef: MutableRefObject<boolean>;
  setGeneratedHtml: (html: string | null) => void;
  resetHistory: () => void;
  setIsEditing: (editing: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}

export function useGeneration({
  pushToHistory,
  isResettingRef,
  setGeneratedHtml,
  resetHistory,
  setIsEditing,
  setSidebarOpen,
}: UseGenerationProps) {
  const [mode, setMode] = useState<'topic' | 'text' | 'file'>('topic');
  const [outputStyle, setOutputStyle] = useState<'notes' | 'upsc' | 'research' | 'table'>('notes');
  const [tableInstruction, setTableInstruction] = useState('');
  const [wordLimit, setWordLimit] = useState(250);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [language, setLanguage] = useState('Hindi');
  const [aiModel, setAiModel] = useState('gemini-3.1-pro-preview');
  const [topicInput, setTopicInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [translatePdfFile, setTranslatePdfFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [translateProgress, setTranslateProgress] = useState<{ current: number; total: number; secondsLeft?: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files as FileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        let mimeType = file.type || 'application/octet-stream';
        if (!file.type) {
          if (file.name.endsWith('.txt')) mimeType = 'text/plain';
          else if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        }
        setFiles(prev => [...prev, { name: file.name, mimeType, data: base64Data }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTranslatePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = (event.target?.result as string).split(',')[1];
      setTranslatePdfFile({ name: file.name, mimeType: 'application/pdf', data: base64Data });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleTranslatePdf = async () => {
    if (!translatePdfFile) return;
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    setTranslateProgress(null);
    const pageHtmlParts: string[] = [];
    let failedAt: number | null = null;

    const pushLive = (isPartial: boolean, failedPage?: number) => {
      if (isResettingRef.current) return;
      const parts = [...pageHtmlParts];
      if (isPartial && failedPage != null) {
        parts.push(
          `<div style="border:1.5px dashed #f97316;border-radius:10px;padding:14px 18px;margin:20px 0;color:#f97316;font-size:13px;background:rgba(249,115,22,0.06)">` +
          `⚠️ पृष्ठ ${failedPage} पर error आई — पिछले ${parts.length} पृष्ठ सुरक्षित हैं। PDF फिर से upload करके बाकी translate करें।` +
          `</div>`
        );
      }
      const html = parts.join('\n');
      setGeneratedHtml(html);
      pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    try {
      const { numPages, pdf } = await loadPdf(translatePdfFile.data);
      const total = numPages;
      setTranslateProgress({ current: 0, total });

      const pageTimes: number[] = [];

      for (let i = 0; i < total; i++) {
        if (isResettingRef.current) return;
        const pageStart = Date.now();

        const avgMs = pageTimes.length > 0
          ? pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length
          : 18000;
        const secondsLeft = Math.round((avgMs * (total - i)) / 1000);
        setTranslateProgress({ current: i + 1, total, secondsLeft });

        const page = await renderSinglePage(pdf, i + 1, 2);
        const pageImgBase64 = canvasPageToJpegBase64(page.canvas, 0.82);
        let pageHtml = await translatePdfPageToHindi(pageImgBase64, i + 1, total, aiModel, 'image/jpeg');
        pageHtml = injectRealImages(pageHtml, page.canvas);
        releaseCanvas(page.canvas);

        if (i < total - 1) {
          pageHtml += '<hr class="page-break" />';
        }
        pageHtmlParts.push(pageHtml);
        pageTimes.push(Date.now() - pageStart);

        pushLive(false);
      }

      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        failedAt = pageHtmlParts.length + 1;
        if (pageHtmlParts.length > 0) {
          pushLive(true, failedAt);
          alert(`पृष्ठ ${failedAt} पर error आई। पिछले ${pageHtmlParts.length} पृष्ठ editor में save हो गए हैं।`);
        } else {
          alert(`PDF translate error: ${error.message || 'Unknown error'}`);
        }
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
        setTranslateProgress(null);
      }
    }
  };

  const injectRealImages = (html: string, canvas: HTMLCanvasElement): string => {
    return html.replace(
      /<pdf-img([^/]*)\/?>/gi,
      (_match, attrs) => {
        const getAttr = (name: string): number | null => {
          const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`, 'i'));
          if (!m) return null;
          const v = parseFloat(m[1]);
          return isNaN(v) ? null : v;
        };
        const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);

        let x = getAttr('x');
        let y = getAttr('y');
        let w = getAttr('w');
        let h = getAttr('h');
        const altMatch = attrs.match(/data-alt="([^"]*)"/i);
        const alt = altMatch ? altMatch[1] : 'चित्र';

        if (x === null || y === null || w === null || h === null) return '';

        x = clamp(x);
        y = clamp(y);
        w = clamp(w, 1);
        h = clamp(h, 1);
        if (x + w > 100) w = 100 - x;
        if (y + h > 100) h = 100 - y;

        try {
          const base64 = cropImageFromCanvas(canvas, x, y, w, h);
          const marginLeftPct = x;
          const widthPct = w;
          return `<img src="data:image/png;base64,${base64}" alt="${alt}" style="display:block;max-width:${widthPct}%;margin:12px 0 12px ${marginLeftPct}%;height:auto;" />`;
        } catch {
          return `<div class="image-placeholder"><div class="image-placeholder-icon">🖼️</div><div class="image-placeholder-title">${alt}</div></div>`;
        }
      }
    );
  };

  const finishGeneration = (result: string) => {
    if (isResettingRef.current) return;
    setGeneratedHtml(result);
    pushToHistory(result);
    localStorage.setItem(STORAGE_KEY, result);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'topic' && !topicInput.trim()) return;
    if (mode === 'text' && !textInput.trim()) return;
    if (mode === 'file' && files.length === 0) return;

    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      let result = '';
      if (mode === 'topic') {
        if (outputStyle === 'upsc') result = await generateUPSCAnswer(topicInput, language, aiModel, wordLimit);
        else if (outputStyle === 'research') result = await generateResearchPaper(topicInput, language, aiModel);
        else result = await generateTopicContent(topicInput, language, aiModel);
      } else if (mode === 'text') {
        result = await generateFormattedNotes(textInput, language, aiModel, outputStyle, wordLimit);
      } else {
        result = await generateFileNotes(files, language, aiModel, outputStyle, wordLimit);
      }
      finishGeneration(result);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        alert(`Error generating content: ${error.message || 'Unknown error'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleGenerateTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) { alert('Please enter a topic first.'); return; }
    setStatus(GenerationStatus.GENERATING_TABLE);
    try {
      const result = await generateSmartTable(topicInput, tableInstruction, language, aiModel);
      finishGeneration(result);
    } catch (error) {
      if (!isResettingRef.current) { console.error(error); alert('Error generating table. Please try again.'); }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleClearCanvas = (
    activeEditIdRef: MutableRefObject<string | null>,
    selectionRangeRef: MutableRefObject<Range | null>,
  ) => {
    if (!confirm('Are you sure you want to clear the editor?')) return;
    isResettingRef.current = true;
    setGeneratedHtml(null);
    resetHistory();
    setIsEditing(false);
    activeEditIdRef.current = null;
    selectionRangeRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => { isResettingRef.current = false; }, 100);
  };

  return {
    mode, setMode,
    outputStyle, setOutputStyle,
    tableInstruction, setTableInstruction,
    wordLimit, setWordLimit,
    status,
    language, setLanguage,
    aiModel, setAiModel,
    topicInput, setTopicInput,
    textInput, setTextInput,
    files,
    handleFileUpload,
    removeFile,
    handleGenerate,
    handleGenerateTable,
    handleClearCanvas,
    translatePdfFile,
    setTranslatePdfFile,
    handleTranslatePdfUpload,
    handleTranslatePdf,
    translateProgress,
  };
}
