import type React from 'react';
import { useState, useRef, type MutableRefObject } from 'react';
import {
  generateTopicContent,
  generateSmartTable,
  generateFormattedNotes,
  generateFileNotes,
  generateUPSCAnswer,
  generateNextUPSCQuestion,
  correctQuestionHindi,
  generateResearchPaper,
  translatePdfPageToHindi,
  analyzeAnswerPdf,
  generateOnePagerNotes,
  chunkTranscript,
  generateTranscriptTitle,
  generateNotesFromTranscriptChunk,
  outlineTranscriptChunk,
  expandTranscriptChunkStructured,
  generateTopicOutline,
  expandTopicSection,
  generateAdditionalTopicAspects,
  generateDeepOutline,
  expandDeepSection,
  outlineTextChunk,
  generateTextTitle,
  expandTextChunkStructured,
  outlineFiles,
  generateFilesTitle,
  expandFilesSection,
  type UPSCAnswerStyle,
  type UPSCSubject,
  type DetailLevel,
  type TranscriptSection,
} from '../services/ai/index';
import { GenerationStatus, type MindmapState } from '../types';
import { STORAGE_KEY } from '../utils/editorUtils';
import { sanitizeHtml } from '../utils/sanitize';
import { loadPdf, renderSinglePage, canvasPageToJpegBase64, cropImageFromCanvas, releaseCanvas } from '../utils/pdfRenderer';
import { fetchVideoTranscript, looksLikeVideoUrl } from '../services/supadata';
import { toast } from '../components/Toast';

// The two models the app ships with — Pro for structuring/reasoning, Flash for
// fast fan-out expansion. Used by the Deep pipeline exactly as-is (names must
// not change: these are the current supported IDs). A manual "deepen this
// node" click always forces the Pro model too, regardless of the pipeline's
// chosen level, since a one-off deeper pass is worth the extra quality.
const DEEP_PRO_MODEL = 'gemini-3.1-pro-preview';
const DEEP_FLASH_MODEL = 'gemini-3.1-flash-lite';

type MindmapAction = 'retry' | 'skip' | 'finish';

/**
 * Shared controller behind every leveled pipeline's live mind map. Handles
 * the interactions that work independently of the main generation loop:
 *   - "Add a point" — an ad-hoc extra section the user types in, generated
 *     and appended live, usable at any time the map is open (mid-generation
 *     or after it finishes).
 *   - Click a node — always re-runs that group's registered `regenerate`
 *     closure (which pipelines register at the STRONGEST setting — Pro
 *     model, max depth — regardless of the level the automatic pass used).
 *     Works for 'done' nodes (regenerate deeper), 'error' nodes (retry), and
 *     'skipped' nodes (generate on demand) alike, since every group is
 *     registered via `registerGroup` BEFORE the pipeline even attempts it —
 *     `partIndex` starts at -1 (not yet in `parts[]`) and is filled in via
 *     `setGroupPartIndex` once the automatic attempt (or a click) succeeds.
 * `parts`/`mm` are the pipeline's own mutable arrays/object — the controller
 * mutates them in place so the pipeline's own `pushLive`/`syncMm` calls (and
 * the controller's own) always see one consistent shared state.
 */
function createMindmapController(
  mm: MindmapState,
  syncMm: () => void,
  parts: string[],
  pushLive: (recordHistory?: boolean) => void,
  extraExpand: (heading: string, sectionNumber: number, allHeadings: string[]) => Promise<string>,
  isResettingRef: MutableRefObject<boolean>,
) {
  const groups = new Map<string, { partIndex: number; regenerate: () => Promise<string> }>();
  let doneResolve: (() => void) | null = null;

  const registerGroup = (groupId: string, regenerate: () => Promise<string>) => {
    groups.set(groupId, { partIndex: -1, regenerate });
  };
  const setGroupPartIndex = (groupId: string, partIndex: number) => {
    const g = groups.get(groupId);
    if (g) g.partIndex = partIndex;
  };

  const onAddMore = async (text: string) => {
    const heading = text.trim();
    if (!heading || isResettingRef.current || mm.addBusy) return;
    mm.addBusy = true;
    const nodeId = `extra-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const sectionNumber = mm.nodes.length + 1;
    const allHeadings = mm.nodes.map(n => n.label);
    mm.nodes.push({ id: nodeId, label: heading, status: 'active', children: [], groupId: nodeId });
    registerGroup(nodeId, () => extraExpand(heading, sectionNumber, allHeadings));
    syncMm();
    try {
      const html = await extraExpand(heading, sectionNumber, allHeadings);
      if (isResettingRef.current) return;
      const idx = parts.length;
      parts.push(html);
      setGroupPartIndex(nodeId, idx);
      pushLive(true);
      const node = mm.nodes.find(n => n.id === nodeId);
      if (node) node.status = 'done';
    } catch (err) {
      console.error('Add-more point failed:', err);
      const node = mm.nodes.find(n => n.id === nodeId);
      if (node) node.status = 'error';
      toast.error('यह point generate नहीं हुआ — नोड पर दुबारा click करें।');
    } finally {
      mm.addBusy = false;
      syncMm();
    }
  };

  const onNodeClick = async (nodeId: string) => {
    if (isResettingRef.current) return;
    const node = mm.nodes.find(n => n.id === nodeId);
    if (!node || node.status === 'active') return;
    const group = groups.get(node.groupId);
    if (!group) return; // no generator registered for this node (shouldn't normally happen)
    const prevStatus = node.status;
    const groupNodeIds = mm.nodes.filter(n => n.groupId === node.groupId).map(n => n.id);
    groupNodeIds.forEach(id => {
      const n = mm.nodes.find(x => x.id === id);
      if (n) n.status = 'active';
    });
    mm.errorNodeId = null;
    syncMm();
    try {
      const html = await group.regenerate();
      if (isResettingRef.current) return;
      if (group.partIndex === -1) {
        group.partIndex = parts.length;
        parts.push(html);
      } else {
        parts[group.partIndex] = html;
      }
      pushLive(true);
      groupNodeIds.forEach(id => {
        const n = mm.nodes.find(x => x.id === id);
        if (n) n.status = 'done';
      });
    } catch (err) {
      console.error('Node regenerate failed:', err);
      groupNodeIds.forEach(id => {
        const n = mm.nodes.find(x => x.id === id);
        if (n) n.status = prevStatus;
      });
      toast.error('यह भाग update नहीं हुआ — दुबारा कोशिश करें।');
    } finally {
      syncMm();
    }
  };

  const markDone = () => { mm.complete = true; syncMm(); };
  const waitForDone = () => new Promise<void>((resolve) => { doneResolve = resolve; });
  const resolveDone = () => {
    const r = doneResolve;
    doneResolve = null;
    if (r) r();
  };

  return { onAddMore, onNodeClick, registerGroup, setGroupPartIndex, markDone, waitForDone, resolveDone };
}
type MindmapController = ReturnType<typeof createMindmapController>;

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
  const [mode, setMode] = useState<'topic' | 'text' | 'file' | 'transcript'>('topic');
  const [outputStyle, setOutputStyle] = useState<'notes' | 'upsc' | 'research' | 'table'>('notes');
  const [upscAnswerStyle, setUpscAnswerStyle] = useState<UPSCAnswerStyle>('topper');
  const [upscSubject, setUpscSubject] = useState<UPSCSubject>('gs');
  const [tableInstruction, setTableInstruction] = useState('');
  const [wordLimit, setWordLimit] = useState(250);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('medium');
  // Multi-step notes-pipeline progress (Medium/Detailed/Deep topic generation).
  const [notesProgress, setNotesProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  // Live mind map shown while a leveled pipeline runs.
  const [mindmap, setMindmap] = useState<MindmapState | null>(null);
  // Resolver for the Retry/Skip/Finish prompt when a section fails mid-pipeline.
  const mindmapActionRef = useRef<((a: MindmapAction) => void) | null>(null);
  // Add-a-point / node-click / done-button bridge for the active pipeline.
  const mindmapControllerRef = useRef<MindmapController | null>(null);

  const resolveMindmapAction = (action: MindmapAction) => {
    const r = mindmapActionRef.current;
    mindmapActionRef.current = null;
    if (r) r(action);
  };
  const waitForMindmapAction = () => new Promise<MindmapAction>((resolve) => {
    mindmapActionRef.current = resolve;
  });
  const handleMindmapAddMore = (text: string) => { mindmapControllerRef.current?.onAddMore(text); };
  const handleMindmapNodeClick = (nodeId: string) => { mindmapControllerRef.current?.onNodeClick(nodeId); };
  const handleMindmapDone = () => { mindmapControllerRef.current?.resolveDone(); };
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

  // Class-transcript state
  const [transcriptInput, setTranscriptInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [transcriptProgress, setTranscriptProgress] = useState<{ current: number; total: number; step: 'fetch' | 'structure' | 'detail'; note?: string } | null>(null);

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
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setAnswerAnalyzing(false);
    }
  };

  const PDF_TRANSLATE_MODEL = 'gemini-3.1-flash-lite';
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
            if (!isResettingRef.current && translatePdfFile) {
              setTranslateResumeState({
                pdfName: translatePdfFile.name,
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
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setTranslateProgress(null);
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
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setTranslateProgress(null);
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
        const rawAlt = altMatch ? altMatch[1] : 'चित्र';
        const alt = rawAlt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

  const handleTranscriptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setTranscriptInput(prev => (prev.trim() ? prev + '\n\n' + text : text));
      toast.success(`"${file.name}" loaded — Generate Notes दबाएं।`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Turn a (possibly multi-hour) class transcript into detailed notes.
  // Runs an automatic staged pipeline: title/overview first, then each
  // word-bounded chunk is expanded into full detailed HTML and appended
  // live so the user watches the notes build up. Chunking is what stops
  // long lectures from getting truncated / silently dropped.
  const handleGenerateTranscript = async () => {
    let text = transcriptInput.trim();
    const url = youtubeUrl.trim();

    // No pasted text but a video link is present → fetch its transcript first.
    if (!text && url) {
      if (!looksLikeVideoUrl(url)) {
        toast.warning('कृपया सही YouTube/video link डालें।');
        return;
      }
      setStatus(GenerationStatus.GENERATING_CHAPTER);
      setTranscriptProgress({ current: 0, total: 1, step: 'fetch', note: 'Transcript माँगी जा रही है…' });
      try {
        const fetched = await fetchVideoTranscript(url, {
          lang: language === 'Hindi' ? 'hi' : 'en',
          onStatus: (s) => setTranscriptProgress({ current: 0, total: 1, step: 'fetch', note: s }),
          // Live view of the reset flag so a mid-fetch Clear actually aborts.
          signal: { get aborted() { return isResettingRef.current; } },
        });
        text = (fetched || '').trim();
        if (!text) throw new Error('Transcript खाली मिली।');
        setTranscriptInput(text);
        toast.success('Transcript मिल गई — notes बन रहे हैं…');
      } catch (err: any) {
        if (!isResettingRef.current) {
          console.error(err);
          toast.error(`Transcript नहीं मिली: ${err?.message || 'पुनः प्रयास करें।'}`);
        }
        setStatus(GenerationStatus.IDLE);
        setTranscriptProgress(null);
        return;
      }
    }

    if (!text) {
      toast.warning('कृपया transcript paste करें, .txt upload करें, या YouTube link डालें।');
      setStatus(GenerationStatus.IDLE);
      return;
    }

    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      if (detailLevel === 'normal') {
        await runSimpleTranscriptPipeline(text);
      } else {
        const built = await runLeveledTranscriptPipeline(text, detailLevel);
        if (!built) await runSimpleTranscriptPipeline(text); // structure step failed → fall back
      }
      if (!isResettingRef.current) toast.success('Transcript notes तैयार!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Transcript notes failed: ${error.message || 'पुनः प्रयास करें।'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setTranscriptProgress(null);
      setNotesProgress(null);
      setMindmap(null);
      mindmapActionRef.current = null;
      mindmapControllerRef.current = null;
    }
  };

  // Normal transcript path: title + straight per-chunk detailed notes.
  const runSimpleTranscriptPipeline = async (text: string) => {
    const chunks = chunkTranscript(text, 5500);
    const total = chunks.length;
    setTranscriptProgress({ current: 0, total, step: 'structure' });

    const parts: string[] = [];
    const pushLive = () => {
      if (isResettingRef.current) return;
      const html = parts.join('\n');
      setGeneratedHtml(html);
      pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    try {
      const titleHtml = sanitizeHtml(await generateTranscriptTitle(chunks[0], language, aiModel));
      if (titleHtml) { parts.push(titleHtml); pushLive(); }
    } catch (err) {
      console.error('Transcript title step failed:', err);
    }

    let sectionCount = 0;
    for (let i = 0; i < total; i++) {
      if (isResettingRef.current) return;
      setTranscriptProgress({ current: i + 1, total, step: 'detail' });

      let chunkHtml = '';
      let ok = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          chunkHtml = sanitizeHtml(await generateNotesFromTranscriptChunk(
            chunks[i], i + 1, total, language, aiModel, i === 0, sectionCount + 1,
          ));
          ok = true;
          break;
        } catch (err) {
          console.error(`Transcript chunk ${i + 1} attempt ${attempt} failed:`, err);
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }

      if (!ok || !chunkHtml) {
        parts.push(`<div class="note-box">⚠️ इस भाग (${i + 1}/${total}) के notes generate नहीं हुए — बाकी notes नीचे जारी हैं। इस भाग के लिए दुबारा प्रयास करें।</div>`);
        pushLive();
        continue;
      }

      sectionCount += (chunkHtml.match(/<h2[\s>]/gi) || []).length;
      parts.push(chunkHtml);
      pushLive();
    }

    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  // Medium/Detailed/Deep transcript path: build the full video's skeleton
  // (every topic + sub-point) as a live mind map, then expand each segment
  // into structured detailed notes from the transcript. Returns false if the
  // skeleton step produced nothing (caller falls back to the simple path).
  // Nodes from the same chunk share a groupId (one API call produced them
  // together) — clicking any of them regenerates that whole chunk deeper.
  const runLeveledTranscriptPipeline = async (text: string, level: 'medium' | 'detailed' | 'deep'): Promise<boolean> => {
    const chunks = chunkTranscript(text, level === 'deep' ? 4500 : 5500);
    const total = chunks.length;
    // Deep uses Pro for the structure and Flash for the (many) expansions;
    // Medium/Detailed structure fast on Flash and expand on the chosen model.
    const outlineModel = level === 'deep' ? DEEP_PRO_MODEL : DEEP_FLASH_MODEL;
    const expandModel = level === 'deep' ? DEEP_FLASH_MODEL : aiModel;

    const parts: string[] = [];
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const mm: MindmapState = {
      title: 'Class Notes',
      subtitle: `Transcript • ${level} pipeline`,
      nodes: [],
      errorNodeId: null,
      complete: false,
      addBusy: false,
    };
    const syncMm = () => setMindmap({
      ...mm,
      nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })),
    });

    const extraExpand = (heading: string, num: number, allH: string[]) =>
      expandTopicSection(mm.title || 'Class Notes', { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed');
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    // Phase 1 — build the skeleton of the whole video (outline every segment).
    setNotesProgress({ current: 0, total, label: 'पूरे video का ढांचा बन रहा है…' });
    syncMm();
    const chunkSections: TranscriptSection[][] = [];
    const chunkRange: { start: number; end: number }[] = [];
    let anyRealOutline = false;
    for (let i = 0; i < total; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      setNotesProgress({ current: i + 1, total, label: `ढांचा बन रहा है (भाग ${i + 1}/${total})` });
      let secs: TranscriptSection[] = [];
      try { secs = await outlineTranscriptChunk(chunks[i], i + 1, total, language, outlineModel); }
      catch (err) { console.error(`Transcript outline chunk ${i + 1} failed:`, err); }
      if (secs.length) anyRealOutline = true;
      else secs = [{ heading: `भाग ${i + 1}`, subheadings: [] }];
      const before = mm.nodes.length;
      const groupId = `c${i}`;
      secs.forEach((s, j) => mm.nodes.push({
        id: `c${i}s${j}`,
        label: s.heading,
        status: 'pending',
        children: s.subheadings.map((h, k) => ({ id: `c${i}s${j}l${k}`, label: h })),
        groupId,
      }));
      chunkRange.push({ start: before, end: mm.nodes.length });
      chunkSections.push(secs);
      syncMm();
    }

    // Structure step wholesale-failed (e.g. network) → let the caller fall
    // back to the simple per-chunk pipeline the user knows works.
    if (!anyRealOutline) { setMindmap(null); return false; }

    // Title + overview.
    try {
      const titleHtml = sanitizeHtml(await generateTranscriptTitle(chunks[0], language, aiModel));
      if (titleHtml) {
        parts.push(titleHtml);
        const m = titleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (m) { const t = m[1].replace(/<[^>]+>/g, '').trim(); if (t) mm.title = t; }
        syncMm();
        pushLive();
      }
    } catch (err) {
      console.error('Transcript title step failed:', err);
    }

    // Section numbers are precomputed from the already-built outline (Phase
    // 1 ran fully before Phase 2 starts) rather than accumulated as chunks
    // succeed — this keeps numbering stable regardless of skip/finish/retry
    // outcomes, and lets every chunk's regenerate closure be registered
    // up front so skipped/never-reached nodes stay clickable.
    const chunkStartNum: number[] = [];
    { let running = 1; for (let i = 0; i < total; i++) { chunkStartNum.push(running); running += chunkSections[i].length; } }
    for (let i = 0; i < total; i++) {
      const startNum = chunkStartNum[i];
      controller.registerGroup(`c${i}`, () => expandTranscriptChunkStructured(
        chunks[i], chunkSections[i], startNum, i + 1, total, language, DEEP_PRO_MODEL, 'deep',
      ));
    }

    // Phase 2 — expand each segment following its outline.
    let stoppedEarly = false;
    for (let i = 0; i < total; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      const range = chunkRange[i];
      const groupId = `c${i}`;
      const startSectionNumber = chunkStartNum[i];
      for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `detailed notes बन रहे हैं (भाग ${i + 1}/${total})` });

      let html = '';
      let skipped = false;
      retryLoop: while (true) {
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (isResettingRef.current) { setMindmap(null); return true; }
          try {
            html = await expandTranscriptChunkStructured(
              chunks[i], chunkSections[i], startSectionNumber, i + 1, total, language, expandModel, level,
            );
            ok = true;
            break;
          } catch (err) {
            console.error(`Transcript expand chunk ${i + 1} attempt ${attempt} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
        if (ok) break retryLoop;

        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'error';
        mm.errorNodeId = mm.nodes[range.start].id;
        syncMm();
        setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1} में समस्या — Retry, Skip या Finish चुनें` });
        const action = await waitForMindmapAction();
        if (isResettingRef.current) { setMindmap(null); return true; }
        mm.errorNodeId = null;
        if (action === 'finish') { skipped = true; stoppedEarly = true; break retryLoop; }
        if (action === 'skip') { skipped = true; break retryLoop; }
        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'active';
        syncMm();
      }

      if (skipped) {
        // No placeholder text — the node's 'skipped' status is enough, and
        // it stays clickable to generate on demand (group registered above).
        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'skipped';
        syncMm();
        if (stoppedEarly) break;
        continue;
      }

      const partIndex = parts.length;
      parts.push(html);
      controller.setGroupPartIndex(groupId, partIndex);
      for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'done';
      pushLive();
      syncMm();
    }

    if (parts.length === 0) { setMindmap(null); return false; }

    controller.markDone();
    await controller.waitForDone();
    if (isResettingRef.current) { setMindmap(null); return true; }

    pushLive(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    return true;
  };

  // Medium/Detailed/Deep pasted-TEXT path: same shape as the transcript
  // pipeline (build the whole skeleton, then expand each chunk following it)
  // but grounded in pasted notes/content instead of spoken class audio, so
  // long pastes don't get truncated or silently compressed either. Returns
  // false if the skeleton step produced nothing (caller falls back to the
  // single-shot generateFormattedNotes path).
  const runLeveledTextPipeline = async (text: string, level: 'medium' | 'detailed' | 'deep'): Promise<boolean> => {
    const chunks = chunkTranscript(text, level === 'deep' ? 4500 : 5500);
    const total = chunks.length;
    const outlineModel = level === 'deep' ? DEEP_PRO_MODEL : DEEP_FLASH_MODEL;
    const expandModel = level === 'deep' ? DEEP_FLASH_MODEL : aiModel;

    const parts: string[] = [];
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const mm: MindmapState = {
      title: 'Notes', subtitle: `Text • ${level} pipeline`, nodes: [], errorNodeId: null, complete: false, addBusy: false,
    };
    const syncMm = () => setMindmap({ ...mm, nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })) });

    const extraExpand = (heading: string, num: number, allH: string[]) =>
      expandTopicSection(mm.title || 'Notes', { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed');
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    setNotesProgress({ current: 0, total, label: 'पूरे content का ढांचा बन रहा है…' });
    syncMm();
    const chunkSections: TranscriptSection[][] = [];
    const chunkRange: { start: number; end: number }[] = [];
    let anyRealOutline = false;
    for (let i = 0; i < total; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      setNotesProgress({ current: i + 1, total, label: `ढांचा बन रहा है (भाग ${i + 1}/${total})` });
      let secs: TranscriptSection[] = [];
      try { secs = await outlineTextChunk(chunks[i], i + 1, total, language, outlineModel); }
      catch (err) { console.error(`Text outline chunk ${i + 1} failed:`, err); }
      if (secs.length) anyRealOutline = true;
      else secs = [{ heading: `भाग ${i + 1}`, subheadings: [] }];
      const before = mm.nodes.length;
      const groupId = `c${i}`;
      secs.forEach((s, j) => mm.nodes.push({
        id: `c${i}s${j}`, label: s.heading, status: 'pending',
        children: s.subheadings.map((h, k) => ({ id: `c${i}s${j}l${k}`, label: h })), groupId,
      }));
      chunkRange.push({ start: before, end: mm.nodes.length });
      chunkSections.push(secs);
      syncMm();
    }

    if (!anyRealOutline) { setMindmap(null); return false; }

    try {
      const titleHtml = sanitizeHtml(await generateTextTitle(chunks[0], language, aiModel));
      if (titleHtml) {
        parts.push(titleHtml);
        const m = titleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (m) { const t = m[1].replace(/<[^>]+>/g, '').trim(); if (t) mm.title = t; }
        syncMm();
        pushLive();
      }
    } catch (err) {
      console.error('Text title step failed:', err);
    }

    // Precompute section numbers from the already-built outline so every
    // chunk's regenerate closure can be registered up front, keeping
    // skipped/never-reached nodes clickable-to-generate regardless of order.
    const chunkStartNum: number[] = [];
    { let running = 1; for (let i = 0; i < total; i++) { chunkStartNum.push(running); running += chunkSections[i].length; } }
    for (let i = 0; i < total; i++) {
      const startNum = chunkStartNum[i];
      controller.registerGroup(`c${i}`, () => expandTextChunkStructured(
        chunks[i], chunkSections[i], startNum, i + 1, total, language, DEEP_PRO_MODEL, 'deep',
      ));
    }

    let stoppedEarly = false;
    for (let i = 0; i < total; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      const range = chunkRange[i];
      const groupId = `c${i}`;
      const startSectionNumber = chunkStartNum[i];
      for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `detailed notes बन रहे हैं (भाग ${i + 1}/${total})` });

      let html = '';
      let skipped = false;
      retryLoop: while (true) {
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (isResettingRef.current) { setMindmap(null); return true; }
          try {
            html = await expandTextChunkStructured(chunks[i], chunkSections[i], startSectionNumber, i + 1, total, language, expandModel, level);
            ok = true;
            break;
          } catch (err) {
            console.error(`Text expand chunk ${i + 1} attempt ${attempt} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
        if (ok) break retryLoop;

        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'error';
        mm.errorNodeId = mm.nodes[range.start].id;
        syncMm();
        setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1} में समस्या — Retry, Skip या Finish चुनें` });
        const action = await waitForMindmapAction();
        if (isResettingRef.current) { setMindmap(null); return true; }
        mm.errorNodeId = null;
        if (action === 'finish') { skipped = true; stoppedEarly = true; break retryLoop; }
        if (action === 'skip') { skipped = true; break retryLoop; }
        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'active';
        syncMm();
      }

      if (skipped) {
        for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'skipped';
        syncMm();
        if (stoppedEarly) break;
        continue;
      }

      const partIndex = parts.length;
      parts.push(html);
      controller.setGroupPartIndex(groupId, partIndex);
      for (let k = range.start; k < range.end; k++) mm.nodes[k].status = 'done';
      pushLive();
      syncMm();
    }

    if (parts.length === 0) { setMindmap(null); return false; }

    controller.markDone();
    await controller.waitForDone();
    if (isResettingRef.current) { setMindmap(null); return true; }

    pushLive(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    return true;
  };

  // Medium/Detailed/Deep uploaded-FILE path: analyze the file(s) once into a
  // structured outline, then expand section by section — re-sending the
  // file(s) with every call so each section stays grounded in the real
  // content instead of drifting on inference. Returns false if the outline
  // step produced nothing (caller falls back to the single-shot
  // generateFileNotes path).
  const runLeveledFilePipeline = async (
    uploadedFiles: { name: string; mimeType: string; data: string }[],
    level: 'medium' | 'detailed' | 'deep',
  ): Promise<boolean> => {
    const fileParts = uploadedFiles.map(f => ({ data: f.data, mimeType: f.mimeType }));
    const outlineModel = level === 'deep' ? DEEP_PRO_MODEL : DEEP_FLASH_MODEL;
    const expandModel = level === 'deep' ? DEEP_FLASH_MODEL : aiModel;

    const parts: string[] = [];
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const mm: MindmapState = {
      title: 'Notes', subtitle: `Files • ${level} pipeline`, nodes: [], errorNodeId: null, complete: false, addBusy: false,
    };
    const syncMm = () => setMindmap({ ...mm, nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })) });

    const extraExpand = (heading: string, num: number, allH: string[]) =>
      expandTopicSection(mm.title || 'Notes', { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed');
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    setNotesProgress({ current: 0, total: 1, label: 'Files का ढांचा बन रहा है…' });
    syncMm();

    let sections: TranscriptSection[] = [];
    try { sections = await outlineFiles(fileParts, language, outlineModel); }
    catch (err) { console.error('File outline failed:', err); }

    if (!sections.length) { setMindmap(null); return false; }

    const allHeadings = sections.map(s => s.heading);
    const total = sections.length;

    mm.nodes = sections.map((s, i) => ({
      id: `s${i}`, label: s.heading, status: 'pending' as const,
      children: (s.subheadings || []).map((h, j) => ({ id: `s${i}-${j}`, label: h })), groupId: `s${i}`,
    }));
    syncMm();

    try {
      const titleHtml = sanitizeHtml(await generateFilesTitle(fileParts, language, aiModel));
      if (titleHtml) {
        parts.push(titleHtml);
        const m = titleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (m) { const t = m[1].replace(/<[^>]+>/g, '').trim(); if (t) mm.title = t; }
        syncMm();
        pushLive();
      }
    } catch (err) {
      console.error('File title step failed:', err);
    }

    // Register every node's regenerate closure up front so skipped/
    // never-reached nodes stay clickable-to-generate while the map is open.
    sections.forEach((s, i) => controller.registerGroup(mm.nodes[i].groupId, () =>
      expandFilesSection(fileParts, s, i + 1, allHeadings, language, DEEP_PRO_MODEL, 'deep')));

    let stoppedEarly = false;
    for (let i = 0; i < sections.length; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      mm.nodes[i].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1}/${total}: ${sections[i].heading}` });

      let html = '';
      let skipped = false;
      retryLoop: while (true) {
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (isResettingRef.current) { setMindmap(null); return true; }
          try {
            html = await expandFilesSection(fileParts, sections[i], i + 1, allHeadings, language, expandModel, level);
            ok = true;
            break;
          } catch (err) {
            console.error(`File section ${i + 1} attempt ${attempt} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
        if (ok) break retryLoop;

        mm.nodes[i].status = 'error';
        mm.errorNodeId = mm.nodes[i].id;
        syncMm();
        setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1} में समस्या — Retry, Skip या Finish चुनें` });
        const action = await waitForMindmapAction();
        if (isResettingRef.current) { setMindmap(null); return true; }
        mm.errorNodeId = null;
        if (action === 'finish') { skipped = true; stoppedEarly = true; break retryLoop; }
        if (action === 'skip') { skipped = true; break retryLoop; }
        mm.nodes[i].status = 'active';
        syncMm();
      }

      if (skipped) {
        mm.nodes[i].status = 'skipped';
        syncMm();
        if (stoppedEarly) break;
        continue;
      }

      const partIndex = parts.length;
      parts.push(html);
      controller.setGroupPartIndex(mm.nodes[i].groupId, partIndex);
      mm.nodes[i].status = 'done';
      syncMm();
      pushLive();
    }

    if (parts.length === 0) { setMindmap(null); return false; }

    controller.markDone();
    await controller.waitForDone();
    if (isResettingRef.current) { setMindmap(null); return true; }

    pushLive(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    return true;
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
    if (!safe) { toast.error('Generated content was empty. Please try again.'); return; }
    setGeneratedHtml(safe);
    pushToHistory(safe);
    localStorage.setItem(STORAGE_KEY, safe);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const wrapUPSCBlock = (question: string, answerHtml: string, subject: UPSCSubject) => {
    const tagClass = subject === 'hindi_literature' ? 'upsc-subject-tag upsc-subject-hl' : 'upsc-subject-tag upsc-subject-gs';
    const tagLabel = subject === 'hindi_literature' ? 'हिंदी साहित्य' : 'सामान्य अध्ययन';
    return `<section class="upsc-qa-block"><div class="upsc-question-header"><span class="${tagClass}">${tagLabel}</span><h2 class="upsc-question">Q. ${escapeHtml(question)}</h2></div>${answerHtml}</section>`;
  };

  // Medium/Detailed/Deep topic pipeline: plan an outline, then expand each
  // section in its own call and append live so a broad topic is covered
  // end-to-end without the single-call output cap truncating it. A live mind
  // map tracks every section's status; a failed section pauses for
  // Retry/Skip/Finish-now. Once complete, the map stays open — the user can
  // add extra points or click any node to regenerate it deeper — until they
  // press Done.
  //
  //   Medium   → outline (Pro/selected) + section expand (selected model).
  //   Detailed → same + a completeness "what's missing?" pass.
  //   Deep     → outline via Gemini 3 Pro (analyses focus areas, 3 levels),
  //              each section fanned out via Flash, then a Pro completeness
  //              pass — the biggest, most thorough pipeline.
  //
  // Falls back to a single shot if the outline step yields nothing. Manages its
  // own live state + progress; caller's finally resets status/progress/mindmap.
  const runLeveledTopicPipeline = async (topic: string, level: 'medium' | 'detailed' | 'deep') => {
    const parts: string[] = [];
    // During the build we only update the canvas + storage; we record a single
    // undo-history entry at the very end (recordHistory=true) so Undo doesn't
    // have to step back through every intermediate section.
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const subtitle = level === 'deep'
      ? 'Deep pipeline • Pro + Flash'
      : level === 'detailed' ? 'Detailed pipeline' : 'Medium pipeline';

    // Local mutable mind map; re-clone into state on every change to re-render.
    const mm: MindmapState = { title: topic, subtitle, nodes: [], errorNodeId: null, complete: false, addBusy: false };
    const syncMm = () => setMindmap({
      ...mm,
      nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })),
    });

    // "Add a point" always uses general-knowledge elaboration at max depth on
    // the chosen model — a lightweight companion to the main pipeline.
    const extraExpand = (heading: string, num: number, allH: string[]) =>
      expandTopicSection(topic, { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed');
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    setNotesProgress({ current: 0, total: 1, label: 'Structure तैयार हो रहा है…' });
    syncMm();

    let outline = null as Awaited<ReturnType<typeof generateTopicOutline>> | Awaited<ReturnType<typeof generateDeepOutline>>;
    let focusAreas: string[] = [];
    try {
      if (level === 'deep') {
        const deep = await generateDeepOutline(topic, language, DEEP_PRO_MODEL);
        if (deep) { outline = deep; focusAreas = deep.focusAreas || []; }
      } else {
        outline = await generateTopicOutline(topic, language, aiModel, level);
      }
    } catch (err) {
      console.error('Outline step failed:', err);
    }

    // Outline failed — don't lose the request; fall back to a single-shot.
    if (!outline || !outline.sections.length) {
      setMindmap(null);
      const single = await generateTopicContent(topic, language, aiModel);
      finishGeneration(single);
      return;
    }

    const sections = outline.sections;
    const allHeadings = sections.map(s => s.heading);
    const hasCompletenessPass = level === 'detailed' || level === 'deep';
    const total = sections.length + (hasCompletenessPass ? 1 : 0);

    mm.title = outline.title || topic;
    mm.nodes = sections.map((s, i) => ({
      id: `s${i}`,
      label: s.heading,
      status: 'pending' as const,
      children: (s.subheadings || []).map((h, j) => ({ id: `s${i}-${j}`, label: h })),
      groupId: `s${i}`,
    }));
    syncMm();

    parts.push(
      `<h1>${escapeHtml(outline.title || topic)}</h1>` +
      (outline.overview ? `<div class="key-point"><strong>Overview:</strong> ${escapeHtml(outline.overview)}</div>` : '')
    );
    pushLive();

    const expandOne = (i: number) => level === 'deep'
      ? expandDeepSection(topic, sections[i], i + 1, allHeadings, focusAreas, language, DEEP_FLASH_MODEL)
      : expandTopicSection(topic, sections[i], i + 1, allHeadings, language, aiModel, level as 'medium' | 'detailed');
    // Clicking a node (done/error/never-attempted) always regenerates via Pro
    // at max depth, one strength level above whatever the automatic pass used.
    const deepenOne = (i: number) =>
      expandDeepSection(topic, sections[i], i + 1, allHeadings, [sections[i].heading], language, DEEP_PRO_MODEL);
    const runCompleteness = () => generateAdditionalTopicAspects(
      topic, allHeadings, sections.length + 1, language, level === 'deep' ? DEEP_PRO_MODEL : aiModel,
    );

    // Register every node's regenerate closure UP FRONT (before generation
    // even starts) so every node — including ones later skipped or never
    // reached because the user chose "Finish now" — stays clickable to
    // generate/deepen on demand while the map is open.
    sections.forEach((_, i) => controller.registerGroup(mm.nodes[i].groupId, () => deepenOne(i)));
    if (hasCompletenessPass) controller.registerGroup('extra', runCompleteness);

    let stoppedEarly = false;
    for (let i = 0; i < sections.length; i++) {
      if (isResettingRef.current) { setMindmap(null); return; }
      mm.nodes[i].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1}/${total}: ${sections[i].heading}` });

      let html = '';
      let skipped = false;
      // Two silent auto-retries; if still failing, pause on the node for the
      // user to Retry, Skip, or Finish now with whatever's already built.
      retryLoop: while (true) {
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (isResettingRef.current) { setMindmap(null); return; }
          try { html = await expandOne(i); ok = true; break; }
          catch (err) {
            console.error(`Section ${i + 1} attempt ${attempt} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
        if (ok) break retryLoop;

        mm.nodes[i].status = 'error';
        mm.errorNodeId = mm.nodes[i].id;
        syncMm();
        setNotesProgress({ current: i + 1, total, label: `भाग ${i + 1} में समस्या — Retry, Skip या Finish चुनें` });
        const action = await waitForMindmapAction();
        if (isResettingRef.current) { setMindmap(null); return; }
        mm.errorNodeId = null;
        if (action === 'finish') { skipped = true; stoppedEarly = true; break retryLoop; }
        if (action === 'skip') { skipped = true; break retryLoop; }
        mm.nodes[i].status = 'active';
        syncMm();
      }

      if (skipped) {
        // Leave content untouched (no placeholder text) — the node's
        // 'skipped' status is enough, and it stays clickable to generate
        // on demand later since its group was registered up front.
        mm.nodes[i].status = 'skipped';
        syncMm();
        if (stoppedEarly) break;
        continue;
      }

      const partIndex = parts.length;
      parts.push(html);
      controller.setGroupPartIndex(mm.nodes[i].groupId, partIndex);
      mm.nodes[i].status = 'done';
      syncMm();
      pushLive();
    }

    // Detailed & Deep: a final "what's still missing?" completeness pass —
    // skipped if the user chose to finish early (the node stays clickable).
    if (hasCompletenessPass) {
      const extraId = 'extra';
      mm.nodes.push({ id: extraId, label: 'बचे हुए ज़रूरी बिंदु', status: stoppedEarly ? 'skipped' : 'active', children: [], groupId: extraId });
      syncMm();
      if (!stoppedEarly && !isResettingRef.current) {
        setNotesProgress({ current: total, total, label: 'बचे हुए ज़रूरी बिंदु जोड़े जा रहे हैं…' });
        try {
          const extra = await runCompleteness();
          const node = mm.nodes[mm.nodes.length - 1];
          if (extra && extra.replace(/<[^>]*>/g, '').trim().length > 20) {
            const partIndex = parts.length;
            parts.push(extra);
            controller.setGroupPartIndex(extraId, partIndex);
            pushLive();
            node.status = 'done';
          } else {
            node.status = 'skipped';
          }
        } catch (err) {
          console.error('Completeness pass failed:', err);
          mm.nodes[mm.nodes.length - 1].status = 'skipped';
        }
        syncMm();
      }
    }

    if (parts.length <= 1) {
      // Nothing but the title survived — fall back to single-shot.
      setMindmap(null);
      const single = await generateTopicContent(topic, language, aiModel);
      finishGeneration(single);
      return;
    }

    // Stay open for review / "add a point" / deepen-a-node until the user
    // explicitly presses Done — see createMindmapController.
    controller.markDone();
    await controller.waitForDone();
    if (isResettingRef.current) { setMindmap(null); return; }

    pushLive(true); // record the finished notes as one clean undo entry
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

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
          let question = topicInput.trim();
          // Correct question to proper Hindi if language is Hindi
          if (language === 'Hindi' || upscSubject === 'hindi_literature') {
            try {
              const corrected = await correctQuestionHindi(question);
              if (corrected) {
                question = corrected;
                setTopicInput(corrected);
              }
            } catch { /* keep original if correction fails */ }
          }
          const answer = await generateUPSCAnswer(question, language, aiModel, wordLimit, upscAnswerStyle, upscSubject);
          result = wrapUPSCBlock(question, answer, upscSubject);
        }
        else if (outputStyle === 'research') result = await generateResearchPaper(topicInput, language, aiModel);
        else if (detailLevel !== 'normal') {
          // Medium/Detailed → multi-step outline+expand pipeline (manages its
          // own live state); nothing more to finishGeneration here.
          await runLeveledTopicPipeline(topicInput.trim(), detailLevel);
          if (!isResettingRef.current) toast.success('Detailed notes तैयार!');
          return;
        }
        else result = await generateTopicContent(topicInput, language, aiModel);
      } else if (mode === 'text') {
        // outputStyle === 'table' is handled by handleGenerateTable, not this
        // path — narrow the type here so the AI service signature stays clean.
        const docStyle = (outputStyle === 'table' ? 'notes' : outputStyle) as 'notes' | 'upsc' | 'research';
        if (docStyle === 'notes' && detailLevel !== 'normal') {
          const built = await runLeveledTextPipeline(textInput.trim(), detailLevel);
          if (!built) result = await generateFormattedNotes(textInput, language, aiModel, docStyle, wordLimit, detailLevel);
          else { if (!isResettingRef.current) toast.success('Detailed notes तैयार!'); return; }
        } else {
          result = await generateFormattedNotes(textInput, language, aiModel, docStyle, wordLimit, detailLevel);
        }
      } else {
        const docStyle = (outputStyle === 'table' ? 'notes' : outputStyle) as 'notes' | 'upsc' | 'research';
        if (docStyle === 'notes' && detailLevel !== 'normal') {
          const built = await runLeveledFilePipeline(files, detailLevel);
          if (!built) result = await generateFileNotes(files, language, aiModel, docStyle, wordLimit, detailLevel);
          else { if (!isResettingRef.current) toast.success('Detailed notes तैयार!'); return; }
        } else {
          result = await generateFileNotes(files, language, aiModel, docStyle, wordLimit, detailLevel);
        }
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
      setNotesProgress(null);
      setMindmap(null);
      mindmapActionRef.current = null;
      mindmapControllerRef.current = null;
    }
  };

  const handleNextUPSCQuestion = async (
    styleOverride?: UPSCAnswerStyle,
    wordLimitOverride?: number,
    customQuestion?: string,
    subjectOverride?: UPSCSubject,
  ) => {
    const currentQuestion = topicInput.trim();
    const typed = customQuestion?.trim() || '';
    if (!typed && !currentQuestion) {
      toast.warning('कृपया प्रश्न दर्ज करें।');
      return;
    }
    const useStyle = styleOverride ?? upscAnswerStyle;
    const useWordLimit = wordLimitOverride ?? wordLimit;
    const useSubject = subjectOverride ?? upscSubject;
    // Capture existing HTML BEFORE we flip status
    const existing = getCurrentHtml();
    setStatus(GenerationStatus.GENERATING_CHAPTER);
    try {
      let nextQuestion = typed;
      if (!nextQuestion) {
        nextQuestion = await generateNextUPSCQuestion(currentQuestion, language, 'gemini-3.1-flash-lite', useSubject);
        if (!nextQuestion) {
          toast.error('अगला प्रश्न generate नहीं हुआ। पुनः प्रयास करें।');
          return;
        }
      } else if (language === 'Hindi' || useSubject === 'hindi_literature') {
        // Correct custom typed question to proper Hindi
        try {
          const corrected = await correctQuestionHindi(nextQuestion);
          if (corrected) nextQuestion = corrected;
        } catch { /* keep original */ }
      }
      setTopicInput(nextQuestion);
      if (styleOverride) setUpscAnswerStyle(styleOverride);
      if (wordLimitOverride) setWordLimit(wordLimitOverride);
      const answer = await generateUPSCAnswer(nextQuestion, language, aiModel, useWordLimit, useStyle, useSubject);
      const newBlock = wrapUPSCBlock(nextQuestion, answer, useSubject);
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
    setTranslateProgress(null);
    setTranslateResumeState(null);
    setTranscriptProgress(null);
    setNotesProgress(null);
    // Unblock a pipeline paused on a Retry/Skip/Finish prompt or waiting on
    // the Done button, then hide the map.
    if (mindmapActionRef.current) resolveMindmapAction('skip');
    mindmapControllerRef.current?.resolveDone();
    mindmapControllerRef.current = null;
    setMindmap(null);
    setOnePagerTopics([]);
    setTimeout(() => { isResettingRef.current = false; }, 100);
  };

  return {
    mode, setMode,
    outputStyle, setOutputStyle,
    upscAnswerStyle, setUpscAnswerStyle,
    upscSubject, setUpscSubject,
    tableInstruction, setTableInstruction,
    wordLimit, setWordLimit,
    detailLevel, setDetailLevel,
    notesProgress,
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
    transcriptInput,
    setTranscriptInput,
    youtubeUrl,
    setYoutubeUrl,
    transcriptProgress,
    handleTranscriptFileUpload,
    handleGenerateTranscript,
    mindmap,
    resolveMindmapAction,
    handleMindmapAddMore,
    handleMindmapNodeClick,
    handleMindmapDone,
  };
}
