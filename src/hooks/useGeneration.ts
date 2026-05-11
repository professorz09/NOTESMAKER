import { useState, type MutableRefObject } from 'react';
import {
  generateTopicContent,
  generateSmartTable,
  generateFormattedNotes,
  generateFileNotes,
  generateUPSCAnswer,
  generateNextUPSCQuestion,
  generateResearchPaper,
  translatePdfPageToHindi,
  analyzeAnswerPdf,
  generateOnePagerNotes,
  type UPSCAnswerStyle,
} from '../services/ai';
import { GenerationStatus } from '../types';
import { STORAGE_KEY } from '../utils/editorUtils';
import { sanitizeHtml } from '../utils/sanitize';
import { loadPdf, renderSinglePage, canvasPageToJpegBase64, cropImageFromCanvas, releaseCanvas } from '../utils/pdfRenderer';
import { toast } from '../components/Toast';

interface UseGenerationProps {
  pushToHistory: (content: string) => void;
  isResettingRef: MutableRefObject<boolean>;
  setGeneratedHtml: (html: string | null) => void;
  resetHistory: () => void;
  setIsEditing: (editing: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  getCurrentHtml: () => string;
}

export function useGeneration({
  pushToHistory,
  isResettingRef,
  getCurrentHtml,
  setGeneratedHtml,
  resetHistory,
  setIsEditing,
  setSidebarOpen,
}: UseGenerationProps) {
  const [mode, setMode] = useState<'topic' | 'text' | 'file'>('topic');
  const [outputStyle, setOutputStyle] = useState<'notes' | 'upsc' | 'research' | 'table'>('notes');
  const [upscAnswerStyle, setUpscAnswerStyle] = useState<UPSCAnswerStyle>('topper');
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
  const [translateResumeState, setTranslateResumeState] = useState<{
    pdfName: string;
    startPage: number;
    total: number;
    pageHtmlParts: string[];
  } | null>(null);
  const [answerPdfFile, setAnswerPdfFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [answerAnalyzing, setAnswerAnalyzing] = useState(false);

  // One Pager state
  const [onePagerTopicInput, setOnePagerTopicInput] = useState('');
  const [onePagerTopics, setOnePagerTopics] = useState<string[]>([]);
  const [onePagerLoading, setOnePagerLoading] = useState(false);

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

  const handleAnswerPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = (event.target?.result as string).split(',')[1];
      setAnswerPdfFile({ name: file.name, mimeType: 'application/pdf', data: base64Data });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyzeAnswer = async () => {
    if (!answerPdfFile) return;
    setAnswerAnalyzing(true);
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      const { numPages, pdf } = await loadPdf(answerPdfFile.data);
      const pagesToRender = Math.min(numPages, 8);
      const pageImages: { base64: string; mimeType: string }[] = [];
      for (let i = 1; i <= pagesToRender; i++) {
        const page = await renderSinglePage(pdf, i, 1.5);
        const base64 = canvasPageToJpegBase64(page.canvas, 0.85);
        releaseCanvas(page.canvas);
        pageImages.push({ base64, mimeType: 'image/jpeg' });
      }
      const html = sanitizeHtml(await analyzeAnswerPdf(pageImages, aiModel));
      setGeneratedHtml(html);
      pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
      if (window.innerWidth < 1024) setSidebarOpen(false);
      toast.success('Answer analysis complete!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Analysis failed: ${error.message || 'Unknown error. Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
        setAnswerAnalyzing(false);
      }
    }
  };

  const PDF_TRANSLATE_MODEL = 'gemini-3-flash-preview';
  const MAX_RETRIES = 2;

  const runPdfTranslation = async (startPage: number, total: number, pdf: any, initialParts: string[]) => {
    const pageHtmlParts: string[] = [...initialParts];

    const pushLive = (failedPage?: number) => {
      if (isResettingRef.current) return;
      const parts = [...pageHtmlParts];
      if (failedPage != null) {
        parts.push(
          `<div style="border:1.5px dashed #f97316;border-radius:10px;padding:14px 18px;margin:20px 0;color:#f97316;font-size:13px;background:rgba(249,115,22,0.06)">` +
          `⚠️ पृष्ठ ${failedPage} translate नहीं हुआ। नीचे "पृष्ठ ${failedPage} से जारी रखें" बटन दबाएं।` +
          `</div>`
        );
      }
      const html = parts.join('\n');
      setGeneratedHtml(html);
      pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const pageTimes: number[] = [];

    for (let i = startPage - 1; i < total; i++) {
      if (isResettingRef.current) return;
      const pageNum = i + 1;

      const avgMs = pageTimes.length > 0
        ? pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length
        : 15000;
      const secondsLeft = Math.round((avgMs * (total - i)) / 1000);
      setTranslateProgress({ current: pageNum, total, secondsLeft });

      const pageStart = Date.now();
      let pageHtml = '';
      let succeeded = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const page = await renderSinglePage(pdf, pageNum, 2.5);
          const pageImgBase64 = canvasPageToJpegBase64(page.canvas, 0.90);
          pageHtml = sanitizeHtml(await translatePdfPageToHindi(pageImgBase64, pageNum, total, PDF_TRANSLATE_MODEL, 'image/jpeg'));
          pageHtml = injectRealImages(pageHtml, page.canvas);
          pageHtml = cleanupHtml(pageHtml);
          releaseCanvas(page.canvas);
          succeeded = true;
          break;
        } catch (err) {
          console.error(`Page ${pageNum} attempt ${attempt} failed:`, err);
          if (attempt === MAX_RETRIES) {
            if (!isResettingRef.current) {
              setTranslateResumeState({
                pdfName: translatePdfFile!.name,
                startPage: pageNum,
                total,
                pageHtmlParts,
              });
              pushLive(pageNum);
              toast.warning(`पृष्ठ ${pageNum} translate नहीं हुआ — "जारी रखें" बटन दबाएं`);
            }
            return;
          }
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }

      if (!succeeded) return;

      if (i < total - 1) pageHtml += `<div class="pdf-page-divider"><span class="pdf-page-num">पृष्ठ ${pageNum}</span></div>`;
      pageHtmlParts.push(pageHtml);
      pageTimes.push(Date.now() - pageStart);
      pushLive();
    }

    setTranslateResumeState(null);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    toast.success(`PDF अनुवाद पूर्ण! सभी ${total} पृष्ठ translate हुए।`);
  };

  const handleTranslatePdf = async () => {
    if (!translatePdfFile) return;
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    setTranslateProgress(null);
    try {
      const { numPages, pdf } = await loadPdf(translatePdfFile.data);
      setTranslateProgress({ current: 1, total: numPages });
      await runPdfTranslation(1, numPages, pdf, []);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`PDF load error: ${error.message || 'File could not be opened. Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
        setTranslateProgress(null);
      }
    }
  };

  const handleResumePdf = async () => {
    if (!translatePdfFile || !translateResumeState) return;
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    setTranslateProgress(null);
    try {
      const { numPages, pdf } = await loadPdf(translatePdfFile.data);
      const resumeFrom = translateResumeState.startPage;
      const prevParts = [...translateResumeState.pageHtmlParts];
      if (prevParts.length > 0) {
        const last = prevParts[prevParts.length - 1];
        if (!last.endsWith('<hr class="page-break" />')) {
          prevParts[prevParts.length - 1] = last + '<hr class="page-break" />';
        }
      }
      setTranslateProgress({ current: resumeFrom, total: numPages });
      await runPdfTranslation(resumeFrom, numPages, pdf, prevParts);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Resume failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
        setTranslateProgress(null);
      }
    }
  };

  const injectRealImages = (html: string, canvas: HTMLCanvasElement): string => {
    let result = html.replace(
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
        const alt = altMatch ? altMatch[1].replace(/"/g, '&quot;') : 'चित्र';

        if (x === null || y === null || w === null || h === null) return '';

        x = clamp(x);
        y = clamp(y);
        w = clamp(w, 1);
        h = clamp(h, 1);
        if (x + w > 100) w = 100 - x;
        if (y + h > 100) h = 100 - y;

        const align = x > 55 ? 'right' : x < 10 ? 'left' : 'center';
        const marginStyle = align === 'center'
          ? `margin: 16px auto`
          : align === 'right'
            ? `margin: 16px 0 16px auto`
            : `margin: 16px auto 16px 0`;

        try {
          const base64 = cropImageFromCanvas(canvas, x, y, w, h);
          return `<figure class="pdf-figure" style="display:block;width:${w}%;${marginStyle};text-align:center;"><img src="data:image/png;base64,${base64}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0 auto;" /><figcaption class="pdf-figcaption">${alt}</figcaption></figure>`;
        } catch {
          return `<div class="image-placeholder"><div class="image-placeholder-icon">🖼️</div><div class="image-placeholder-title">${alt}</div></div>`;
        }
      }
    );

    return result;
  };

  const cleanupHtml = (html: string): string => {
    try {
      const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
      const root = doc.getElementById('__root')!;

      root.querySelectorAll('p figure.pdf-figure, li figure.pdf-figure').forEach(figure => {
        const parent = figure.parentElement!;
        const grandParent = parent.parentElement;
        if (!grandParent) return;

        const childNodes = Array.from(parent.childNodes);
        const figIdx = childNodes.indexOf(figure as ChildNode);

        const beforeNodes = childNodes.slice(0, figIdx);
        const afterNodes = childNodes.slice(figIdx + 1);

        const tag = parent.tagName.toLowerCase();
        const insertPoint = parent.nextSibling;

        if (beforeNodes.some(n => n.textContent?.trim())) {
          const beforeEl = doc.createElement(tag);
          beforeNodes.forEach(n => beforeEl.appendChild(n.cloneNode(true)));
          grandParent.insertBefore(beforeEl, parent);
        }
        grandParent.insertBefore(figure, parent);
        if (afterNodes.some(n => n.textContent?.trim())) {
          const afterEl = doc.createElement(tag);
          afterNodes.forEach(n => afterEl.appendChild(n.cloneNode(true)));
          grandParent.insertBefore(afterEl, insertPoint);
        }
        parent.remove();
      });

      root.querySelectorAll('p, div').forEach(el => {
        if (!el.querySelector('img, figure, table, svg') && !el.textContent?.trim()) {
          el.remove();
        }
      });

      return root.innerHTML;
    } catch {
      return html;
    }
  };

  const handleAddOnePager = async () => {
    const topic = onePagerTopicInput.trim();
    if (!topic) return;
    setOnePagerLoading(true);
    try {
      const rawHtml = await generateOnePagerNotes(topic, language, aiModel);
      const newHtml = sanitizeHtml(rawHtml);
      const existing = getCurrentHtml();
      const combined = existing
        ? existing + '\n<div class="one-pager-divider"></div>\n' + newHtml
        : newHtml;
      setGeneratedHtml(combined);
      pushToHistory(combined);
      localStorage.setItem(STORAGE_KEY, combined);
      setOnePagerTopics(prev => [...prev, topic]);
      setOnePagerTopicInput('');
      if (window.innerWidth < 1024) setSidebarOpen(false);
      toast.success(`"${topic}" one-pager added!`);
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`One Pager generation failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setOnePagerLoading(false);
    }
  };

  const finishGeneration = (result: string) => {
    if (isResettingRef.current) return;
    const safe = sanitizeHtml(result);
    setGeneratedHtml(safe);
    pushToHistory(safe);
    localStorage.setItem(STORAGE_KEY, safe);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const wrapUPSCBlock = (question: string, answerHtml: string) =>
    `<section class="upsc-qa-block"><h2 class="upsc-question">Q. ${escapeHtml(question)}</h2>${answerHtml}</section>`;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'topic' && !topicInput.trim()) {
      toast.warning('Please enter a topic first.');
      return;
    }
    if (mode === 'text' && !textInput.trim()) {
      toast.warning('Please paste some text first.');
      return;
    }
    if (mode === 'file' && files.length === 0) {
      toast.warning('Please upload at least one file first.');
      return;
    }

    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      let result = '';
      if (mode === 'topic') {
        if (outputStyle === 'upsc') {
          const answer = await generateUPSCAnswer(topicInput, language, aiModel, wordLimit, upscAnswerStyle);
          result = wrapUPSCBlock(topicInput.trim(), answer);
        }
        else if (outputStyle === 'research') result = await generateResearchPaper(topicInput, language, aiModel);
        else result = await generateTopicContent(topicInput, language, aiModel);
      } else if (mode === 'text') {
        result = await generateFormattedNotes(textInput, language, aiModel, outputStyle, wordLimit);
      } else {
        result = await generateFileNotes(files, language, aiModel, outputStyle, wordLimit);
      }
      finishGeneration(result);
      toast.success('Content generated successfully!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Generation failed: ${error.message || 'Please check your API key and try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleNextUPSCQuestion = async (
    styleOverride?: UPSCAnswerStyle,
    wordLimitOverride?: number,
  ) => {
    const currentQuestion = topicInput.trim();
    if (!currentQuestion) {
      toast.warning('पहले कोई UPSC प्रश्न दर्ज करें।');
      return;
    }
    const useStyle = styleOverride ?? upscAnswerStyle;
    const useWordLimit = wordLimitOverride ?? wordLimit;
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      const nextQuestion = await generateNextUPSCQuestion(currentQuestion, language, 'gemini-3-flash-preview');
      if (!nextQuestion) {
        toast.error('अगला प्रश्न generate नहीं हुआ। पुनः प्रयास करें।');
        return;
      }
      setTopicInput(nextQuestion);
      if (styleOverride) setUpscAnswerStyle(styleOverride);
      if (wordLimitOverride) setWordLimit(wordLimitOverride);
      const answer = await generateUPSCAnswer(nextQuestion, language, aiModel, useWordLimit, useStyle);
      const newBlock = wrapUPSCBlock(nextQuestion, answer);
      const existing = getCurrentHtml();
      const combined = existing
        ? existing + '\n<hr class="upsc-qa-divider" />\n' + newBlock
        : newBlock;
      finishGeneration(combined);
      toast.success('अगला UPSC प्रश्न तैयार है!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleGenerateTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) {
      toast.warning('Please enter a topic first.');
      return;
    }
    setStatus(GenerationStatus.GENERATING_TABLE);
    try {
      const result = await generateSmartTable(topicInput, tableInstruction, language, aiModel);
      finishGeneration(result);
      toast.success('Table generated successfully!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Table generation failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
    }
  };

  const handleClearCanvas = (
    activeEditIdRef: MutableRefObject<string | null>,
    selectionRangeRef: MutableRefObject<Range | null>,
  ) => {
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
    upscAnswerStyle, setUpscAnswerStyle,
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
    handleNextUPSCQuestion,
    handleClearCanvas,
    translatePdfFile,
    setTranslatePdfFile,
    handleTranslatePdfUpload,
    handleTranslatePdf,
    handleResumePdf,
    translateProgress,
    translateResumeState,
    setTranslateResumeState,
    answerPdfFile,
    setAnswerPdfFile,
    handleAnswerPdfUpload,
    handleAnalyzeAnswer,
    answerAnalyzing,
    onePagerTopicInput,
    setOnePagerTopicInput,
    onePagerTopics,
    onePagerLoading,
    handleAddOnePager,
  };
}
