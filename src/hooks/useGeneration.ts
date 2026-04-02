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
import { renderPdfPages, canvasPageToPngBase64, cropImageFromCanvas } from '../utils/pdfRenderer';

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
  const [translateProgress, setTranslateProgress] = useState<{ current: number; total: number } | null>(null);

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
    try {
      const pages = await renderPdfPages(translatePdfFile.data, 2);
      const total = pages.length;
      setTranslateProgress({ current: 0, total });

      const pageHtmlParts: string[] = [];

      for (let i = 0; i < pages.length; i++) {
        if (isResettingRef.current) return;
        const page = pages[i];
        setTranslateProgress({ current: i + 1, total });

        const pageImgBase64 = canvasPageToPngBase64(page.canvas);
        let pageHtml = await translatePdfPageToHindi(pageImgBase64, i + 1, total, aiModel);

        pageHtml = injectRealImages(pageHtml, page.canvas);

        if (i < pages.length - 1) {
          pageHtml += '<hr class="page-break" />';
        }
        pageHtmlParts.push(pageHtml);
      }

      finishGeneration(pageHtmlParts.join('\n'));
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        alert(`PDF translate error: ${error.message || 'Unknown error'}`);
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
        const getAttr = (name: string) => {
          const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`, 'i'));
          return m ? parseFloat(m[1]) : null;
        };
        const x = getAttr('x');
        const y = getAttr('y');
        const w = getAttr('w');
        const h = getAttr('h');
        const altMatch = attrs.match(/data-alt="([^"]*)"/i);
        const alt = altMatch ? altMatch[1] : 'चित्र';

        if (x === null || y === null || w === null || h === null) return '';

        try {
          const base64 = cropImageFromCanvas(canvas, x, y, w, h);
          const naturalW = Math.round((w / 100) * canvas.width);
          const naturalH = Math.round((h / 100) * canvas.height);
          return `<img src="data:image/png;base64,${base64}" alt="${alt}" style="display:block;max-width:100%;width:${naturalW}px;height:auto;margin:12px auto;" />`;
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
