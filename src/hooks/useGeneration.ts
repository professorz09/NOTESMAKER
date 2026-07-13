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
  generateAnswerFromTopperCopy,
  generateOnePagerNotes,
  chunkTranscript,
  restructureTranscriptChunk,
  generateTranscriptTitle,
  generateNotesFromTranscriptChunk,
  outlineTranscriptChunk,
  expandChunkSection,
  restructureOutlineChunks,
  restructureOutlineSections,
  generateTopicOutline,
  expandTopicSection,
  generateAdditionalTopicAspects,
  generateDeepOutline,
  expandDeepSection,
  outlineTextChunk,
  generateTextTitle,
  outlineFiles,
  generateFilesTitle,
  expandFilesSection,
  scanSectionsForGroundingAdditions,
  type UPSCAnswerStyle,
  type UPSCSubject,
  type RefinementOptions,
  type DetailLevel,
  type TranscriptSection,
  type ChunkSourceKind,
} from '../services/ai/index';
import { GenerationStatus, type MindmapState } from '../types';
import { STORAGE_KEY } from '../utils/editorUtils';
import { mapWithConcurrency } from '../utils/concurrency';
import { sanitizeHtml } from '../utils/sanitize';
import { loadPdf, renderSinglePage, canvasPageToJpegBase64, cropImageFromCanvas, releaseCanvas } from '../utils/pdfRenderer';
import { fetchVideoTranscript, looksLikeVideoUrl } from '../services/supadata';
import { toast } from '../components/Toast';

// Every leveled pipeline's own internal calls (outline/structure, Deep-level
// expansion, completeness passes, and any manual "regenerate this node"
// click) always use Gemini 3 Pro — quality and completeness matter more here
// than speed, and Flash-lite measurably drops depth/accuracy on this kind of
// dense, structure-heavy generation. The name must not change: this is the
// current supported Pro model ID. (Medium/Detailed's per-section automatic
// expand still respects the user's own Sidebar model choice, `aiModel`.)
const DEEP_PRO_MODEL = 'gemini-3.1-pro-preview';

type MindmapAction = 'retry' | 'skip' | 'finish';

// A group's regenerate closure receives the user's optional free-text
// instruction ("add a real example", "make a table here", …) and — when the
// group already has content — that existing draft, so a manual regenerate is
// a REVISION pass ("improve this draft per my instruction") rather than a
// blind rewrite. Both args are undefined for a first-time generate.
type RegenerateFn = (instruction?: string, existingHtml?: string) => Promise<string>;
// The "add a point" field's generator also accepts an optional refine block
// so the SAME function can serve both the initial generation and, later,
// clicks that improve what it produced.
type ExtraExpandFn = (heading: string, sectionNumber: number, allHeadings: string[], refine?: RefinementOptions) => Promise<string>;

/**
 * Shared controller behind every leveled pipeline's live mind map. Handles
 * the interactions that work independently of the main generation loop:
 *   - "Add a point" — an ad-hoc extra section the user types in, generated
 *     and appended live, usable at any time the map is open (mid-generation
 *     or after it finishes).
 *   - Click a node, optionally with a custom instruction — re-runs that
 *     group's registered `regenerate` closure (pipelines register these at
 *     the STRONGEST setting — Pro model, max depth — regardless of the level
 *     the automatic pass used), passing the instruction plus the section's
 *     existing draft (if any) so it's an improvement pass, not a rewrite.
 *     Works for 'done' nodes (revise/deepen), 'error' nodes (retry), and
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
  extraExpand: ExtraExpandFn,
  isResettingRef: MutableRefObject<boolean>,
) {
  const groups = new Map<string, { partIndex: number; regenerate: RegenerateFn }>();
  let doneResolve: (() => void) | null = null;
  // Set once the pipeline that owns this controller has torn down (Clear, or
  // the user pressed Done and the overlay closed). An onAddMore/onNodeClick
  // AI call that's still in flight at that moment must NOT touch state when
  // it lands — its `finally` used to call syncMm(), which re-opened the
  // already-closed mind map overlay with no working Done button.
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  const isDead = () => cancelled || isResettingRef.current;

  const registerGroup = (groupId: string, regenerate: RegenerateFn) => {
    groups.set(groupId, { partIndex: -1, regenerate });
  };
  const setGroupPartIndex = (groupId: string, partIndex: number) => {
    const g = groups.get(groupId);
    if (g) g.partIndex = partIndex;
  };

  const onAddMore = async (text: string) => {
    const heading = text.trim();
    if (!heading || isDead() || mm.addBusy) return;
    mm.addBusy = true;
    const nodeId = `extra-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const sectionNumber = mm.nodes.length + 1;
    const allHeadings = mm.nodes.map(n => n.label);
    mm.nodes.push({ id: nodeId, label: heading, status: 'active', children: [], groupId: nodeId });
    registerGroup(nodeId, (instruction, existingHtml) =>
      extraExpand(heading, sectionNumber, allHeadings, { existingHtml, customInstruction: instruction }));
    syncMm();
    try {
      const html = await extraExpand(heading, sectionNumber, allHeadings);
      if (isDead()) return;
      const idx = parts.length;
      parts.push(html);
      setGroupPartIndex(nodeId, idx);
      pushLive(true);
      const node = mm.nodes.find(n => n.id === nodeId);
      if (node) node.status = 'done';
    } catch (err) {
      console.error('Add-more point failed:', err);
      if (isDead()) return;
      const node = mm.nodes.find(n => n.id === nodeId);
      if (node) node.status = 'error';
      toast.error('This point could not be generated — click the node to try again.');
    } finally {
      mm.addBusy = false;
      if (!isDead()) syncMm();
    }
  };

  const onNodeClick = async (nodeId: string, instruction?: string) => {
    if (isDead()) return;
    const node = mm.nodes.find(n => n.id === nodeId);
    if (!node || node.status === 'active') return;
    const group = groups.get(node.groupId);
    if (!group) return; // no generator registered for this node (shouldn't normally happen)
    const prevStatus = node.status;
    const existingHtml = group.partIndex >= 0 ? parts[group.partIndex] : undefined;
    const groupNodeIds = mm.nodes.filter(n => n.groupId === node.groupId).map(n => n.id);
    groupNodeIds.forEach(id => {
      const n = mm.nodes.find(x => x.id === id);
      if (n) n.status = 'active';
    });
    mm.errorNodeId = null;
    syncMm();
    try {
      const html = await group.regenerate(instruction, existingHtml);
      if (isDead()) return;
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
      if (isDead()) return;
      groupNodeIds.forEach(id => {
        const n = mm.nodes.find(x => x.id === id);
        if (n) n.status = prevStatus;
      });
      toast.error('This section could not be updated — please try again.');
    } finally {
      if (!isDead()) syncMm();
    }
  };

  // Attach/clear a per-section instruction during the review (approval) step.
  const setNodeInstruction = (nodeId: string, instruction: string) => {
    const node = mm.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const text = instruction.trim();
    node.instruction = text || undefined;
    syncMm();
  };

  const markDone = () => { mm.complete = true; syncMm(); };
  const waitForDone = () => new Promise<void>((resolve) => { doneResolve = resolve; });
  const resolveDone = () => {
    const r = doneResolve;
    doneResolve = null;
    if (r) r();
  };

  return { onAddMore, onNodeClick, registerGroup, setGroupPartIndex, setNodeInstruction, markDone, waitForDone, resolveDone, cancel };
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
  // Optional final pipeline step (off by default — a leveled generation
  // behaves exactly as before when this is off). When on, after every
  // section is generated, one extra call scans all section headings and
  // adds a live-search-grounded "current update" box only to the sections
  // that genuinely need current/latest information — everything else is
  // left untouched.
  const [groundingEnabled, setGroundingEnabled] = useState(false);
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
  // Approval gate: each leveled pipeline pauses after building its outline
  // until the user reviews/instructs and presses "Approve & Generate".
  const mindmapApproveRef = useRef<(() => void) | null>(null);
  const waitForApproval = () => new Promise<void>((resolve) => { mindmapApproveRef.current = resolve; });
  const handleMindmapApprove = () => {
    const r = mindmapApproveRef.current;
    mindmapApproveRef.current = null;
    if (r) r();
  };
  // "Restructure" action offered next to Approve during the review step —
  // each pipeline registers its own outline-rewrite closure while its gate
  // is open (cleared again when the gate resolves).
  const mindmapRestructureRef = useRef<(() => Promise<void>) | null>(null);
  const handleMindmapRestructure = () => { void mindmapRestructureRef.current?.(); };
  const handleMindmapAddMore = (text: string) => { mindmapControllerRef.current?.onAddMore(text); };
  const handleMindmapNodeClick = (nodeId: string, instruction?: string) => { mindmapControllerRef.current?.onNodeClick(nodeId, instruction); };
  const handleMindmapSetNodeInstruction = (nodeId: string, instruction: string) => { mindmapControllerRef.current?.setNodeInstruction(nodeId, instruction); };
  const handleMindmapDone = () => { mindmapControllerRef.current?.resolveDone(); };

  // Shared review/approval gate. Every leveled pipeline calls this right after
  // its outline (nodes) is built and before any expensive expansion — the mind
  // map shows the plan, the user can attach a per-section instruction to any
  // node, optionally run the pipeline's "Restructure" pass (better headings,
  // nothing dropped) any number of times, then presses "Approve & Generate".
  // Returns true if the user approved, false if the generation was reset
  // (Clear) while waiting.
  const runApprovalGate = async (
    mm: MindmapState,
    syncMm: () => void,
    restructure?: () => Promise<void>,
  ): Promise<boolean> => {
    if (isResettingRef.current) return false;
    mm.awaitingApproval = true;
    mindmapRestructureRef.current = restructure ?? null;
    setNotesProgress({ current: 0, total: 1, label: 'Review the plan — Restructure it, or Approve & Generate' });
    syncMm();
    await waitForApproval();
    mindmapRestructureRef.current = null;
    mm.awaitingApproval = false;
    syncMm();
    return !isResettingRef.current;
  };

  // Shared "Grounding" pass, run once by every leveled pipeline right after
  // all its sections exist, before the mind map hands control back to the
  // user. No-ops instantly if the toggle is off — existing behavior is
  // unchanged. `entries` describes each already-generated unit (one topic
  // section, or one transcript/text chunk covering several headings) with
  // where its content lives in `parts[]` so an addition can be appended in
  // place. A section with `partIndex < 0` (never actually generated, e.g.
  // skipped) is automatically excluded by the caller.
  const runGroundingPass = async (
    contextTitle: string,
    mm: MindmapState,
    syncMm: () => void,
    parts: string[],
    pushLive: (recordHistory?: boolean) => void,
    entries: { heading: string; subheadings: string[]; partIndex: number; nodeIds: string[] }[],
  ) => {
    if (!groundingEnabled || isResettingRef.current || !entries.length) return;
    setNotesProgress({ current: entries.length, total: entries.length, label: '🌐 Scanning for latest info (grounding)…' });
    try {
      const additions = await scanSectionsForGroundingAdditions(
        contextTitle,
        entries.map(e => ({ heading: e.heading, subheadings: e.subheadings })),
        language,
        DEEP_PRO_MODEL,
      );
      if (!additions.length || isResettingRef.current) return;
      for (const add of additions) {
        const entry = entries[add.sectionIndex];
        if (!entry) continue;
        parts[entry.partIndex] = parts[entry.partIndex] + '\n' + sanitizeHtml(add.additionHtml);
      }
      pushLive(true);
      syncMm();
      toast.success(`🌐 Latest info added to ${additions.length} section(s).`);
    } catch (err) {
      console.error('Grounding pass failed (notes are still complete without it):', err);
    }
  };
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

  // Topper answer-copy → clean formatted answer (PDF or photo).
  const [topperCopyFile, setTopperCopyFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [topperGenerating, setTopperGenerating] = useState(false);

  // Class-transcript state
  const [transcriptInput, setTranscriptInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [transcriptProgress, setTranscriptProgress] = useState<{ current: number; total: number; step: 'fetch' | 'restructure' | 'structure' | 'detail'; note?: string } | null>(null);
  // True while the optional "Restructure Draft" pre-step is cleaning up the
  // pasted/fetched transcript before the user presses "Start Notes Making".
  const [isRestructuringDraft, setIsRestructuringDraft] = useState(false);
  // Snapshot of the draft taken right before the last "Restructure Draft"
  // run, so the user can instantly revert if the cleaned version looks off
  // (e.g. a point reads thinner than they expected) instead of having to
  // re-paste/re-fetch the original transcript.
  const [draftBackup, setDraftBackup] = useState<string | null>(null);

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

  const handleTopperCopyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = (event.target?.result as string).split(',')[1];
      let mimeType = file.type || '';
      if (!mimeType) mimeType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      setTopperCopyFile({ name: file.name, mimeType, data: base64Data });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Turn an uploaded topper answer copy (PDF or photo) into one clean,
  // properly-formatted answer — appended below any existing content and
  // rendered in the answer-copy style. Non-blocking: shows a live placeholder
  // while the AI reads the copy.
  const handleGenerateFromTopperCopy = async () => {
    if (!topperCopyFile) return;
    const existing = getCurrentHtml();
    setTopperGenerating(true);
    setStatus(GenerationStatus.GENERATING_CHAPTER);

    const divider = existing ? '\n<hr class="upsc-qa-divider" />\n' : '';
    const loadingBody = `<p class="upsc-gen-loading">✍️ ${language === 'Hindi' ? 'टॉपर कॉपी पढ़कर उत्तर तैयार किया जा रहा है…' : 'Reading the topper copy…'}</p>`;
    if (!isResettingRef.current) {
      setGeneratedHtml(existing + divider + wrapUPSCBlock('टॉपर कॉपी', loadingBody, upscSubject, ' data-gen-pending="1"'));
      scrollToLatestAnswer();
    }

    try {
      // Build the page images the model reads: rasterize each PDF page, or use
      // the uploaded photo directly.
      const pageImages: { base64: string; mimeType: string }[] = [];
      if (topperCopyFile.mimeType === 'application/pdf') {
        const { numPages, pdf } = await loadPdf(topperCopyFile.data);
        const pages = Math.min(numPages, 8);
        for (let i = 1; i <= pages; i++) {
          const page = await renderSinglePage(pdf, i, 2);
          pageImages.push({ base64: canvasPageToJpegBase64(page.canvas, 0.9), mimeType: 'image/jpeg' });
          releaseCanvas(page.canvas);
        }
      } else {
        pageImages.push({ base64: topperCopyFile.data, mimeType: topperCopyFile.mimeType });
      }

      const raw = sanitizeHtml(await generateAnswerFromTopperCopy(pageImages, language, aiModel));
      if (isResettingRef.current) return;

      // Split the identified question from the answer body, then wrap in the
      // standard answer-copy block so it exports with the framed template.
      const holder = document.createElement('div');
      holder.innerHTML = raw;
      const qEl = holder.querySelector('.tc-question');
      const question = (qEl?.textContent || '').trim() || (language === 'Hindi' ? 'टॉपर कॉपी आधारित उत्तर' : "Topper copy answer");
      qEl?.remove();
      const body = holder.innerHTML.trim() || raw;

      const combined = existing + divider + wrapUPSCBlock(question, body, upscSubject);
      finishGeneration(combined);
      scrollToLatestAnswer();
      setTopperCopyFile(null);
      toast.success(language === 'Hindi' ? 'टॉपर कॉपी से उत्तर तैयार!' : 'Answer ready from topper copy!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        setGeneratedHtml(existing || null);
        toast.error(`Failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setTopperGenerating(false);
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
          `⚠️ Page ${failedPage} could not be translated. Press the "Resume from page ${failedPage}" button below.` +
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
              toast.warning(`Page ${pageNum} could not be translated — press the "Resume" button`);
            }
            return;
          }
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }

      if (!succeeded) return;

      if (i < total - 1) pageHtml += `<div class="pdf-page-divider"><span class="pdf-page-num">Page ${pageNum}</span></div>`;
      pageHtmlParts.push(pageHtml);
      pageTimes.push(Date.now() - pageStart);
      pushLive();
    }

    setTranslateResumeState(null);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    toast.success(`PDF translation complete! All ${total} pages translated.`);
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
      // Normally the last successful page already carries its divider (the
      // main loop appends one to every non-final page); this is only a
      // defensive top-up — and it must use the SAME .pdf-page-divider markup
      // the main loop uses, not a bare <hr> that no stylesheet knows about.
      if (prevParts.length > 0) {
        const last = prevParts[prevParts.length - 1];
        if (!last.includes('pdf-page-divider')) {
          prevParts[prevParts.length - 1] = last +
            `<div class="pdf-page-divider"><span class="pdf-page-num">Page ${resumeFrom - 1}</span></div>`;
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
        const rawAlt = altMatch ? altMatch[1] : 'image';
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
      toast.success(`"${file.name}" loaded — press Generate Notes.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Optional pre-step, run only if the user presses "Restructure Draft"
  // before "Start Notes Making". A pasted/fetched transcript is often raw
  // captions or a rough paste — broken sentences, missing punctuation,
  // disjointed lines — and the notes pipeline chunks that same raw text
  // again, so any structural mess in the draft compounds into patchy notes.
  // This cleans the draft chunk by chunk (grammar/punctuation/paragraphing
  // only — no summarising, nothing dropped) and writes the result back into
  // the transcript box so the user can review it before generating notes.
  const handleRestructureDraft = async () => {
    const text = transcriptInput.trim();
    if (!text) {
      toast.warning('Please paste a transcript, upload a .txt, or fetch one from a video link first.');
      return;
    }
    setIsRestructuringDraft(true);
    setDraftBackup(transcriptInput);
    const chunks = chunkTranscript(text, 4500);
    const total = chunks.length;
    const cleaned: string[] = new Array(total).fill('');
    try {
      for (let i = 0; i < total; i++) {
        if (isResettingRef.current) return;
        setTranscriptProgress({ current: i + 1, total, step: 'restructure' });
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            cleaned[i] = await restructureTranscriptChunk(chunks[i], i + 1, total, language, aiModel);
            ok = true;
            break;
          } catch (err) {
            console.error(`Draft restructure chunk ${i + 1} attempt ${attempt} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
        // A chunk that never comes back clean keeps its original text rather
        // than being dropped — a rough chunk beats a missing one.
        if (!ok || !cleaned[i].trim()) cleaned[i] = chunks[i];
      }
      if (isResettingRef.current) return;
      setTranscriptInput(cleaned.join('\n\n'));
      toast.success('Draft restructured — review it, then press "Start Notes Making".');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Draft restructuring failed: ${error.message || 'please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setIsRestructuringDraft(false);
      setTranscriptProgress(null);
    }
  };

  // Instantly revert to the draft exactly as it was before the last
  // "Restructure Draft" run — the safety net in case the cleaned version
  // ever looks thinner or off compared to the original.
  const handleUndoRestructureDraft = () => {
    if (draftBackup === null) return;
    setTranscriptInput(draftBackup);
    setDraftBackup(null);
    toast.success('Reverted to the original draft.');
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
        toast.warning('Please enter a valid YouTube/video link.');
        return;
      }
      setStatus(GenerationStatus.GENERATING_CHAPTER);
      setTranscriptProgress({ current: 0, total: 1, step: 'fetch', note: 'Fetching transcript…' });
      try {
        const fetched = await fetchVideoTranscript(url, {
          lang: language === 'Hindi' ? 'hi' : 'en',
          onStatus: (s) => setTranscriptProgress({ current: 0, total: 1, step: 'fetch', note: s }),
          // Live view of the reset flag so a mid-fetch Clear actually aborts.
          signal: { get aborted() { return isResettingRef.current; } },
        });
        text = (fetched || '').trim();
        if (!text) throw new Error('Transcript came back empty.');
        setTranscriptInput(text);
        const words = (text.match(/\S+/g) || []).length;
        toast.success(`Transcript fetched (~${words.toLocaleString('en-IN')} words) — building notes…`);
      } catch (err: any) {
        if (!isResettingRef.current) {
          console.error(err);
          toast.error(`Could not fetch transcript: ${err?.message || 'please try again.'}`);
        }
        setStatus(GenerationStatus.IDLE);
        setTranscriptProgress(null);
        return;
      }
    }

    if (!text) {
      toast.warning('Please paste a transcript, upload a .txt, or enter a YouTube link.');
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
      if (!isResettingRef.current) toast.success('Transcript notes ready!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        toast.error(`Transcript notes failed: ${error.message || 'please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setStatus(GenerationStatus.IDLE);
      setTranscriptProgress(null);
      setNotesProgress(null);
      setMindmap(null);
      mindmapActionRef.current = null;
      mindmapControllerRef.current?.cancel();
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
        parts.push(`<div class="note-box">⚠️ Notes for this part (${i + 1}/${total}) could not be generated — the rest continue below. Please retry this part.</div>`);
        pushLive();
        continue;
      }

      sectionCount += (chunkHtml.match(/<h2[\s>]/gi) || []).length;
      parts.push(chunkHtml);
      pushLive();
    }

    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  // Phase 1 shared by the transcript & text leveled pipelines: outline every
  // chunk with bounded parallelism (3 calls in flight) instead of strictly
  // one-by-one — structure building was the longest serial stretch of the
  // pipeline on multi-hour lectures. Each chunk gets one retry; a chunk that
  // still comes back empty degrades to a "Part N" placeholder node exactly
  // as before. Nodes are appended to the mind map strictly in chunk order
  // (a chunk's nodes appear once every earlier chunk has landed) so section
  // numbering, groupIds and chunkRange stay identical to the sequential path.
  const outlineChunksParallel = async (
    chunks: string[],
    outlineOne: (chunk: string, part: number, total: number) => Promise<TranscriptSection[]>,
    mm: MindmapState,
    syncMm: () => void,
    progressLabel: string,
  ): Promise<{ chunkSections: TranscriptSection[][]; chunkRange: { start: number; end: number }[]; anyRealOutline: boolean }> => {
    const total = chunks.length;
    const chunkSections: TranscriptSection[][] = [];
    const chunkRange: { start: number; end: number }[] = [];
    const results: (TranscriptSection[] | null)[] = new Array(total).fill(null);
    let anyRealOutline = false;
    let completedCount = 0;
    let appended = 0;
    const appendReady = () => {
      while (appended < total && results[appended]) {
        const i = appended;
        const secs = results[i]!;
        const before = mm.nodes.length;
        // Each SECTION is its own generation unit now (one expand call per
        // section), so every node is its own group — clicking it regenerates
        // just that section, and its status tracks just that section's call.
        secs.forEach((s, j) => mm.nodes.push({
          id: `c${i}s${j}`,
          label: s.heading,
          status: 'pending',
          children: s.subheadings.map((h, k) => ({ id: `c${i}s${j}l${k}`, label: h })),
          groupId: `c${i}s${j}`,
        }));
        chunkRange.push({ start: before, end: mm.nodes.length });
        chunkSections.push(secs);
        appended++;
      }
    };
    await mapWithConcurrency(total, 3, async (i) => {
      if (isResettingRef.current) return;
      let secs: TranscriptSection[] = [];
      for (let attempt = 1; attempt <= 2 && !secs.length; attempt++) {
        try { secs = await outlineOne(chunks[i], i + 1, total); }
        catch (err) {
          console.error(`Outline chunk ${i + 1} attempt ${attempt} failed:`, err);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (secs.length) anyRealOutline = true;
      else secs = [{ heading: `Part ${i + 1}`, subheadings: [] }];
      results[i] = secs;
      completedCount++;
      if (isResettingRef.current) return;
      setNotesProgress({ current: completedCount, total, label: `${progressLabel} (${completedCount}/${total})` });
      appendReady();
      syncMm();
    });
    appendReady();
    return { chunkSections, chunkRange, anyRealOutline };
  };

  // Medium/Detailed/Deep chunked pipeline shared by TRANSCRIPT and pasted-
  // TEXT input: build the full source's skeleton (every topic + sub-point)
  // as a live mind map, pause at the review gate (Restructure the outline
  // and/or attach per-section instructions, then Approve), then expand each
  // SECTION in its own call. One call per section — not per chunk — is what
  // stops a heading with many sub-points from being compressed into a
  // one-line-per-point summary; a section whose sub-point list is very long
  // is split further into batches inside expandChunkSection. Returns false
  // if the skeleton step produced nothing (caller falls back).
  const runLeveledChunkPipeline = async (
    text: string,
    level: 'medium' | 'detailed' | 'deep',
    kind: ChunkSourceKind,
  ): Promise<boolean> => {
    // Smaller chunks = less source text competing for the output-token
    // budget on each call — the main defense against silently dropped content.
    const chunks = chunkTranscript(text, 4500);
    const total = chunks.length;
    // Structuring always uses Pro (quality matters most for getting the
    // skeleton right). Once the user APPROVES a transcript plan, expansion
    // always runs at the strongest setting — Pro model + maximum depth —
    // whatever level got it here: class notes must be the deepest, most
    // detailed version. Text keeps its level→model mapping.
    const outlineModel = DEEP_PRO_MODEL;
    const expandLevel: 'medium' | 'detailed' | 'deep' = kind === 'transcript' ? 'deep' : level;
    const expandModel = (kind === 'transcript' || level === 'deep') ? DEEP_PRO_MODEL : aiModel;

    const parts: string[] = [];
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const mm: MindmapState = {
      title: kind === 'transcript' ? 'Class Notes' : 'Notes',
      subtitle: kind === 'transcript' ? `Transcript • ${level} pipeline` : `Text • ${level} pipeline`,
      nodes: [],
      errorNodeId: null,
      awaitingApproval: false,
      canRestructure: true,
      restructuring: false,
      complete: false,
      addBusy: false,
    };
    const syncMm = () => setMindmap({
      ...mm,
      nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })),
    });

    const extraExpand = (heading: string, num: number, allH: string[], refine?: RefinementOptions) =>
      expandTopicSection(mm.title || 'Notes', { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed', refine);
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    // The title only needs the first chunk, so it runs in parallel with
    // Phase 1 instead of being a serial round-trip of its own.
    const titlePromise = (kind === 'transcript'
      ? generateTranscriptTitle(chunks[0], language, aiModel)
      : generateTextTitle(chunks[0], language, aiModel)
    ).catch(err => { console.error('Title step failed:', err); return ''; });

    // Phase 1 — build the skeleton of the whole source (outline every segment).
    setNotesProgress({
      current: 0, total,
      label: `Building the whole ${kind === 'transcript' ? 'video' : 'content'} structure… (${total} part${total > 1 ? 's' : ''})`,
    });
    syncMm();
    const { chunkSections, chunkRange, anyRealOutline } = await outlineChunksParallel(
      chunks,
      (chunk, part, tot) => kind === 'transcript'
        ? outlineTranscriptChunk(chunk, part, tot, language, outlineModel)
        : outlineTextChunk(chunk, part, tot, language, outlineModel),
      mm, syncMm, 'Building structure',
    );
    if (isResettingRef.current) { setMindmap(null); return true; }

    // Structure step wholesale-failed (e.g. network) → let the caller fall
    // back to the single-shot path the user knows works.
    if (!anyRealOutline) { setMindmap(null); return false; }

    // Title (fetched in parallel with Phase 1 above).
    const titleHtml = sanitizeHtml(await titlePromise);
    if (titleHtml) {
      parts.push(titleHtml);
      const m = titleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (m) { const t = m[1].replace(/<[^>]+>/g, '').trim(); if (t) mm.title = t; }
      syncMm();
      pushLive();
    }

    // Global section numbers, recomputed whenever the outline changes
    // (Restructure) — chunkStartNum[i] is the number of chunk i's first
    // section. Every section's regenerate closure is registered up front (at
    // the strongest setting) so skipped/never-reached nodes stay clickable;
    // the closures read chunkSections[i][j] at call time, so a restructured
    // outline is picked up automatically.
    const chunkStartNum: number[] = [];
    const registerSectionGroups = () => {
      chunkStartNum.length = 0;
      let running = 1;
      for (let i = 0; i < total; i++) { chunkStartNum.push(running); running += chunkSections[i].length; }
      for (let ci = 0; ci < total; ci++) {
        for (let cj = 0; cj < chunkSections[ci].length; cj++) {
          const i = ci, j = cj, num = chunkStartNum[ci] + cj;
          controller.registerGroup(`c${i}s${j}`, (instruction, existingHtml) => expandChunkSection(
            kind, chunks[i], chunkSections[i][j], num, chunkSections[i].map(s => s.heading),
            i + 1, total, language, DEEP_PRO_MODEL, 'deep',
            { existingHtml, customInstruction: instruction },
          ));
        }
      }
    };
    registerSectionGroups();

    // Rebuild the mind-map nodes from the current (restructured) outline —
    // per-section instructions whose heading survived are carried over, and
    // user-added extra nodes are kept at the end.
    const rebuildOutlineNodes = () => {
      const prevInstructions = new Map<string, string>();
      mm.nodes.forEach(n => { if (n.instruction) prevInstructions.set(n.label, n.instruction); });
      const extraNodes = mm.nodes.filter(n => !/^c\d+s\d+$/.test(n.groupId));
      mm.nodes = [];
      chunkRange.length = 0;
      for (let i = 0; i < total; i++) {
        const before = mm.nodes.length;
        chunkSections[i].forEach((s, j) => mm.nodes.push({
          id: `c${i}s${j}`,
          label: s.heading,
          status: 'pending' as const,
          children: s.subheadings.map((h, k) => ({ id: `c${i}s${j}l${k}`, label: h })),
          groupId: `c${i}s${j}`,
          instruction: prevInstructions.get(s.heading),
        }));
        chunkRange.push({ start: before, end: mm.nodes.length });
      }
      mm.nodes.push(...extraNodes);
    };

    // "Restructure" (review step): rewrite the whole outline — better,
    // specific headings and cleaner grouping with EVERY point preserved
    // (segment-level point-count guards inside restructureOutlineChunks keep
    // the original wherever the rewrite comes back thinner) — then return to
    // the same review step for approval.
    const restructureOutline = async () => {
      if (mm.restructuring || isResettingRef.current) return;
      const stale = () => isResettingRef.current || mindmapControllerRef.current !== controller;
      mm.restructuring = true;
      syncMm();
      try {
        const improved = await restructureOutlineChunks(chunkSections, mm.title, language, DEEP_PRO_MODEL);
        if (stale()) return;
        for (let i = 0; i < total; i++) chunkSections[i] = improved[i];
        rebuildOutlineNodes();
        registerSectionGroups();
        toast.success('Outline restructured — every point kept. Review it, then Approve & Generate.');
      } catch (err: any) {
        console.error('Outline restructure failed:', err);
        if (!stale()) toast.error(`Restructure failed — the original outline is unchanged. ${err?.message || ''}`);
      } finally {
        if (!stale()) { mm.restructuring = false; syncMm(); }
      }
    };

    // Pause for review — Restructure and/or per-section instructions, then
    // Approve & Generate.
    if (!(await runApprovalGate(mm, syncMm, restructureOutline))) { setMindmap(null); return true; }

    // Phase 2 — expand every section in its own call, a few in flight at a
    // time within each chunk. One slot per section is pre-allocated in
    // `parts` so out-of-order completions still render in outline order, and
    // registered on the controller so a later regenerate (or a skipped node
    // generated on demand) lands in place instead of at the end.
    const sectionSlot: number[][] = chunkSections.map(secs => secs.map(() => {
      const idx = parts.length;
      parts.push('');
      return idx;
    }));
    for (let i = 0; i < total; i++) {
      for (let j = 0; j < chunkSections[i].length; j++) controller.setGroupPartIndex(`c${i}s${j}`, sectionSlot[i][j]);
    }
    const sectionDone: boolean[][] = chunkSections.map(secs => secs.map(() => false));
    const totalSections = chunkSections.reduce((a, s) => a + s.length, 0);
    let written = 0;
    let stoppedEarly = false;

    for (let i = 0; i < total && !stoppedEarly; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      const range = chunkRange[i];
      let remaining = chunkSections[i].map((_, j) => j);
      while (remaining.length) {
        if (isResettingRef.current) { setMindmap(null); return true; }
        remaining.forEach(j => { mm.nodes[range.start + j].status = 'active'; });
        mm.errorNodeId = null;
        syncMm();
        setNotesProgress({ current: written, total: totalSections, label: `Writing detailed notes (section ${Math.min(written + 1, totalSections)}/${totalSections})` });

        const batch = remaining;
        const failed: number[] = [];
        await mapWithConcurrency(batch.length, 3, async (r) => {
          const j = batch[r];
          if (isResettingRef.current) return;
          const node = mm.nodes[range.start + j];
          let html = '';
          for (let attempt = 1; attempt <= 2 && !html; attempt++) {
            try {
              html = await expandChunkSection(
                kind, chunks[i], chunkSections[i][j], chunkStartNum[i] + j, chunkSections[i].map(s => s.heading),
                i + 1, total, language, expandModel, expandLevel,
                node.instruction ? { customInstruction: node.instruction } : undefined,
              );
            } catch (err) {
              console.error(`${kind} section ${chunkStartNum[i] + j} attempt ${attempt} failed:`, err);
              if (attempt < 2) await new Promise(res => setTimeout(res, 1500));
            }
          }
          if (isResettingRef.current) return;
          if (html) {
            parts[sectionSlot[i][j]] = html;
            sectionDone[i][j] = true;
            node.status = 'done';
            written++;
            setNotesProgress({ current: written, total: totalSections, label: `Writing detailed notes (section ${written}/${totalSections})` });
            pushLive();
          } else {
            failed.push(j);
            node.status = 'error';
          }
          syncMm();
        });
        if (isResettingRef.current) { setMindmap(null); return true; }
        if (!failed.length) break;

        mm.errorNodeId = mm.nodes[range.start + failed[0]].id;
        syncMm();
        setNotesProgress({ current: written, total: totalSections, label: `${failed.length} section(s) ran into a problem — choose Retry, Skip or Finish` });
        const action = await waitForMindmapAction();
        if (isResettingRef.current) { setMindmap(null); return true; }
        mm.errorNodeId = null;
        if (action === 'retry') { remaining = failed; continue; }
        // Skip / Finish: no placeholder text — the 'skipped' status is
        // enough, and the node stays clickable to generate on demand into
        // its own slot.
        failed.forEach(j => { mm.nodes[range.start + j].status = 'skipped'; });
        syncMm();
        if (action === 'finish') stoppedEarly = true;
        break;
      }
    }
    if (stoppedEarly) {
      mm.nodes.forEach(n => { if (n.status === 'pending' || n.status === 'active') n.status = 'skipped'; });
      syncMm();
    }

    const anySectionDone = sectionDone.some(c => c.some(Boolean));
    if (!anySectionDone && !stoppedEarly) { setMindmap(null); return false; }

    await runGroundingPass(mm.title, mm, syncMm, parts, pushLive,
      chunkSections.flatMap((secs, i) => secs.map((s, j) => ({
        heading: s.heading,
        subheadings: s.subheadings,
        partIndex: sectionDone[i][j] ? sectionSlot[i][j] : -1,
        nodeIds: [`c${i}s${j}`],
      }))).filter(e => e.partIndex >= 0));

    controller.markDone();
    await controller.waitForDone();
    if (isResettingRef.current) { setMindmap(null); return true; }

    pushLive(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    return true;
  };

  const runLeveledTranscriptPipeline = (text: string, level: 'medium' | 'detailed' | 'deep') =>
    runLeveledChunkPipeline(text, level, 'transcript');

  const runLeveledTextPipeline = (text: string, level: 'medium' | 'detailed' | 'deep') =>
    runLeveledChunkPipeline(text, level, 'text');

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
    const outlineModel = DEEP_PRO_MODEL;
    const expandModel = level === 'deep' ? DEEP_PRO_MODEL : aiModel;

    const parts: string[] = [];
    const pushLive = (recordHistory = false) => {
      if (isResettingRef.current) return;
      const html = sanitizeHtml(parts.join('\n'));
      setGeneratedHtml(html);
      if (recordHistory) pushToHistory(html);
      localStorage.setItem(STORAGE_KEY, html);
    };

    const mm: MindmapState = {
      title: 'Notes', subtitle: `Files • ${level} pipeline`, nodes: [], errorNodeId: null, awaitingApproval: false, canRestructure: true, restructuring: false, complete: false, addBusy: false,
    };
    const syncMm = () => setMindmap({ ...mm, nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })) });

    const extraExpand = (heading: string, num: number, allH: string[], refine?: RefinementOptions) =>
      expandTopicSection(mm.title || 'Notes', { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed', refine);
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    setNotesProgress({ current: 0, total: 1, label: 'Building the files structure…' });
    syncMm();

    // Title runs in parallel with the outline call — both only read the files.
    const titlePromise = generateFilesTitle(fileParts, language, aiModel)
      .catch(err => { console.error('File title step failed:', err); return ''; });

    // One retry before giving up: a single transient failure here used to
    // silently demote the whole run to the single-shot fallback path.
    let sections: TranscriptSection[] = [];
    for (let attempt = 1; attempt <= 2 && !sections.length; attempt++) {
      try { sections = await outlineFiles(fileParts, language, outlineModel); }
      catch (err) {
        console.error(`File outline attempt ${attempt} failed:`, err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!sections.length) { setMindmap(null); return false; }

    const allHeadings = sections.map(s => s.heading);
    let total = sections.length;

    mm.nodes = sections.map((s, i) => ({
      id: `s${i}`, label: s.heading, status: 'pending' as const,
      children: (s.subheadings || []).map((h, j) => ({ id: `s${i}-${j}`, label: h })), groupId: `s${i}`,
    }));
    syncMm();

    const titleHtml = sanitizeHtml(await titlePromise);
    if (titleHtml) {
      parts.push(titleHtml);
      const m = titleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (m) { const t = m[1].replace(/<[^>]+>/g, '').trim(); if (t) mm.title = t; }
      syncMm();
      pushLive();
    }

    // Register every node's regenerate closure up front so skipped/
    // never-reached nodes stay clickable-to-generate while the map is open.
    const registerSectionGroups = () => {
      sections.forEach((s, i) => controller.registerGroup(`s${i}`, (instruction, existingHtml) =>
        expandFilesSection(fileParts, s, i + 1, allHeadings, language, DEEP_PRO_MODEL, 'deep', { existingHtml, customInstruction: instruction })));
    };
    registerSectionGroups();

    // "Restructure" (review step): rewrite the outline — better headings,
    // cleaner grouping, every point preserved — then return to review.
    const restructureOutline = async () => {
      if (mm.restructuring || isResettingRef.current) return;
      const stale = () => isResettingRef.current || mindmapControllerRef.current !== controller;
      mm.restructuring = true;
      syncMm();
      try {
        const improved = await restructureOutlineSections(sections, mm.title || 'Notes', language, DEEP_PRO_MODEL);
        if (stale()) return;
        const prevInstructions = new Map<string, string>();
        mm.nodes.forEach(n => { if (n.instruction) prevInstructions.set(n.label, n.instruction); });
        const extraNodes = mm.nodes.filter(n => !/^s\d+$/.test(n.groupId));
        sections.splice(0, sections.length, ...improved);
        allHeadings.splice(0, allHeadings.length, ...sections.map(s => s.heading));
        total = sections.length;
        mm.nodes = sections.map((s, i) => ({
          id: `s${i}`, label: s.heading, status: 'pending' as const,
          children: (s.subheadings || []).map((h, j) => ({ id: `s${i}-${j}`, label: h })), groupId: `s${i}`,
          instruction: prevInstructions.get(s.heading),
        }));
        mm.nodes.push(...extraNodes);
        registerSectionGroups();
        toast.success('Outline restructured — every point kept. Review it, then Approve & Generate.');
      } catch (err: any) {
        console.error('Outline restructure failed:', err);
        if (!stale()) toast.error(`Restructure failed — the original outline is unchanged. ${err?.message || ''}`);
      } finally {
        if (!stale()) { mm.restructuring = false; syncMm(); }
      }
    };

    // Pause for review — Restructure and/or per-section instructions, then
    // Approve & Generate.
    if (!(await runApprovalGate(mm, syncMm, restructureOutline))) { setMindmap(null); return true; }

    const refineFor = (i: number): RefinementOptions | undefined =>
      mm.nodes[i]?.instruction ? { customInstruction: mm.nodes[i].instruction } : undefined;

    const sectionPartIndex: number[] = new Array(sections.length).fill(-1);
    let stoppedEarly = false;
    for (let i = 0; i < sections.length; i++) {
      if (isResettingRef.current) { setMindmap(null); return true; }
      mm.nodes[i].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `Part ${i + 1}/${total}: ${sections[i].heading}` });

      let html = '';
      let skipped = false;
      retryLoop: while (true) {
        let ok = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (isResettingRef.current) { setMindmap(null); return true; }
          try {
            html = await expandFilesSection(fileParts, sections[i], i + 1, allHeadings, language, expandModel, level, refineFor(i));
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
        setNotesProgress({ current: i + 1, total, label: `Part ${i + 1} ran into a problem — choose Retry, Skip or Finish` });
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
      sectionPartIndex[i] = partIndex;
      mm.nodes[i].status = 'done';
      syncMm();
      pushLive();
    }

    if (parts.length === 0) { setMindmap(null); return false; }


    await runGroundingPass(mm.title || 'Notes', mm, syncMm, parts, pushLive, sections.map((s, i) => ({
      heading: s.heading,
      subheadings: s.subheadings,
      partIndex: sectionPartIndex[i],
      nodeIds: [mm.nodes[i].id],
    })).filter(e => e.partIndex >= 0));

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

  const wrapUPSCBlock = (question: string, answerHtml: string, subject: UPSCSubject, extraAttr = '') => {
    const tagClass = subject === 'hindi_literature' ? 'upsc-subject-tag upsc-subject-hl' : 'upsc-subject-tag upsc-subject-gs';
    const tagLabel = subject === 'hindi_literature' ? 'Hindi Literature' : 'General Studies';
    return `<section class="upsc-qa-block"${extraAttr}><div class="upsc-question-header"><span class="${tagClass}">${tagLabel}</span><h2 class="upsc-question">Q. ${escapeHtml(question)}</h2></div>${answerHtml}</section>`;
  };

  // Smoothly bring the most recently appended answer into view so a non-
  // blocking "next question" generation visibly grows the document downward
  // instead of the user wondering whether anything is happening.
  const scrollToLatestAnswer = () => {
    setTimeout(() => {
      const blocks = document.querySelectorAll('.editor-content .upsc-qa-block');
      const last = blocks[blocks.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
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
    const mm: MindmapState = { title: topic, subtitle, nodes: [], errorNodeId: null, awaitingApproval: false, restructuring: false, complete: false, addBusy: false };
    const syncMm = () => setMindmap({
      ...mm,
      nodes: mm.nodes.map(n => ({ ...n, children: [...n.children] })),
    });

    // "Add a point" always uses general-knowledge elaboration at max depth on
    // the chosen model — a lightweight companion to the main pipeline.
    const extraExpand = (heading: string, num: number, allH: string[], refine?: RefinementOptions) =>
      expandTopicSection(topic, { heading, subheadings: [] }, num, allH, language, aiModel, 'detailed', refine);
    const controller = createMindmapController(mm, syncMm, parts, pushLive, extraExpand, isResettingRef);
    mindmapControllerRef.current = controller;

    setNotesProgress({ current: 0, total: 1, label: 'Preparing structure…' });
    syncMm();

    let outline = null as Awaited<ReturnType<typeof generateTopicOutline>> | Awaited<ReturnType<typeof generateDeepOutline>>;
    let focusAreas: string[] = [];
    // One retry before giving up: a single transient failure here used to
    // silently demote the whole run to the single-shot fallback.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (level === 'deep') {
          const deep = await generateDeepOutline(topic, language, DEEP_PRO_MODEL);
          if (deep) { outline = deep; focusAreas = deep.focusAreas || []; }
        } else {
          outline = await generateTopicOutline(topic, language, aiModel, level);
        }
      } catch (err) {
        console.error(`Outline attempt ${attempt} failed:`, err);
      }
      if (outline && outline.sections.length) break;
      outline = null;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
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

    parts.push(`<h1>${escapeHtml(outline.title || topic)}</h1>`);
    pushLive();

    // A section's user-attached review instruction feeds its FIRST expansion.
    const refineFor = (i: number): RefinementOptions | undefined =>
      mm.nodes[i]?.instruction ? { customInstruction: mm.nodes[i].instruction } : undefined;
    const expandOne = (i: number) => level === 'deep'
      ? expandDeepSection(topic, sections[i], i + 1, allHeadings, focusAreas, language, DEEP_PRO_MODEL, refineFor(i))
      : expandTopicSection(topic, sections[i], i + 1, allHeadings, language, aiModel, level as 'medium' | 'detailed', refineFor(i));
    // Clicking a node (done/error/never-attempted) always regenerates via Pro
    // at max depth, one strength level above whatever the automatic pass
    // used — carrying the existing draft + any typed instruction as a
    // revision pass rather than a blind rewrite.
    const deepenOne = (i: number, instruction?: string, existingHtml?: string) =>
      expandDeepSection(topic, sections[i], i + 1, allHeadings, [sections[i].heading], language, DEEP_PRO_MODEL, { existingHtml, customInstruction: instruction });
    const runCompleteness = (instruction?: string, existingHtml?: string) => generateAdditionalTopicAspects(
      topic, allHeadings, sections.length + 1, language, level === 'deep' ? DEEP_PRO_MODEL : aiModel,
      { existingHtml, customInstruction: instruction },
    );

    // Register every node's regenerate closure UP FRONT (before generation
    // even starts) so every node — including ones later skipped or never
    // reached because the user chose "Finish now" — stays clickable to
    // generate/deepen on demand while the map is open.
    sections.forEach((_, i) => controller.registerGroup(`s${i}`, (instruction, existingHtml) => deepenOne(i, instruction, existingHtml)));
    if (hasCompletenessPass) controller.registerGroup('extra', runCompleteness);

    // Pause for the user to review the plan / attach per-section
    // instructions. No Restructure here: a topic outline is already designed
    // from scratch by the AI, so a restructure pass has nothing to fix —
    // it's only offered where the outline was extracted from source material
    // (transcript / text / files).
    if (!(await runApprovalGate(mm, syncMm))) { setMindmap(null); return; }

    const sectionPartIndex: number[] = new Array(sections.length).fill(-1);
    let stoppedEarly = false;
    for (let i = 0; i < sections.length; i++) {
      if (isResettingRef.current) { setMindmap(null); return; }
      mm.nodes[i].status = 'active';
      mm.errorNodeId = null;
      syncMm();
      setNotesProgress({ current: i + 1, total, label: `Part ${i + 1}/${total}: ${sections[i].heading}` });

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
        setNotesProgress({ current: i + 1, total, label: `Part ${i + 1} ran into a problem — choose Retry, Skip or Finish` });
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
      sectionPartIndex[i] = partIndex;
      mm.nodes[i].status = 'done';
      syncMm();
      pushLive();
    }

    // Detailed & Deep: a final "what's still missing?" completeness pass —
    // skipped if the user chose to finish early (the node stays clickable).
    if (hasCompletenessPass) {
      const extraId = 'extra';
      mm.nodes.push({ id: extraId, label: 'Remaining key points', status: stoppedEarly ? 'skipped' : 'active', children: [], groupId: extraId });
      syncMm();
      if (!stoppedEarly && !isResettingRef.current) {
        setNotesProgress({ current: total, total, label: 'Adding remaining key points…' });
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

    await runGroundingPass(outline.title || topic, mm, syncMm, parts, pushLive, sections.map((s, i) => ({
      heading: s.heading,
      subheadings: s.subheadings,
      partIndex: sectionPartIndex[i],
      nodeIds: [mm.nodes[i].id],
    })).filter(e => e.partIndex >= 0));

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
    if ((mode === 'text' || mode === 'file') && !textInput.trim() && files.length === 0) {
      toast.warning('Please paste some text or upload at least one file first.');
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
          if (!isResettingRef.current) toast.success('Detailed notes ready!');
          return;
        }
        else result = await generateTopicContent(topicInput, language, aiModel);
      } else if (mode === 'text' || mode === 'file') {
        // Text and File share one sidebar panel — whichever the user actually
        // filled in decides the pipeline. Files win when both are present,
        // since a file pipeline covers file content that a text-only prompt
        // can't see.
        // outputStyle === 'table' is handled by handleGenerateTable, not this
        // path — narrow the type here so the AI service signature stays clean.
        const docStyle = (outputStyle === 'table' ? 'notes' : outputStyle) as 'notes' | 'upsc' | 'research';
        if (files.length > 0) {
          if (docStyle === 'notes' && detailLevel !== 'normal') {
            const built = await runLeveledFilePipeline(files, detailLevel);
            if (!built) result = await generateFileNotes(files, language, aiModel, docStyle, wordLimit, detailLevel);
            else { if (!isResettingRef.current) toast.success('Detailed notes ready!'); return; }
          } else {
            result = await generateFileNotes(files, language, aiModel, docStyle, wordLimit, detailLevel);
          }
        } else {
          if (docStyle === 'notes' && detailLevel !== 'normal') {
            const built = await runLeveledTextPipeline(textInput.trim(), detailLevel);
            if (!built) result = await generateFormattedNotes(textInput, language, aiModel, docStyle, wordLimit, detailLevel);
            else { if (!isResettingRef.current) toast.success('Detailed notes ready!'); return; }
          } else {
            result = await generateFormattedNotes(textInput, language, aiModel, docStyle, wordLimit, detailLevel);
          }
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
      mindmapControllerRef.current?.cancel();
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
      toast.warning('Please enter a question.');
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
          toast.error('Could not generate the next question. Please try again.');
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

      // Optimistic append: drop the question in immediately with a live
      // "writing the answer" placeholder so the document visibly grows
      // downward while generation runs — the screen is never blocked.
      const divider = existing ? '\n<hr class="upsc-qa-divider" />\n' : '';
      const loadingBody = `<p class="upsc-gen-loading">✍️ ${language === 'Hindi' || useSubject === 'hindi_literature' ? 'उत्तर लिखा जा रहा है…' : 'Writing the answer…'}</p>`;
      const placeholder = wrapUPSCBlock(nextQuestion, loadingBody, useSubject, ' data-gen-pending="1"');
      if (!isResettingRef.current) {
        setGeneratedHtml(existing + divider + placeholder);
        scrollToLatestAnswer();
      }

      const answer = await generateUPSCAnswer(nextQuestion, language, aiModel, useWordLimit, useStyle, useSubject);
      if (isResettingRef.current) return;
      const newBlock = wrapUPSCBlock(nextQuestion, answer, useSubject);
      const combined = existing + divider + newBlock;
      finishGeneration(combined);
      scrollToLatestAnswer();
      toast.success('Next UPSC question is ready!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        // Roll back the optimistic placeholder so a failed run doesn't leave
        // a stuck "writing…" block behind.
        setGeneratedHtml(existing || null);
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
    setIsRestructuringDraft(false);
    setDraftBackup(null);
    setNotesProgress(null);
    // Unblock a pipeline paused on the approval gate, a Retry/Skip/Finish
    // prompt, or the Done button, then hide the map.
    mindmapRestructureRef.current = null;
    handleMindmapApprove();
    if (mindmapActionRef.current) resolveMindmapAction('skip');
    mindmapControllerRef.current?.cancel();
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
    groundingEnabled, setGroundingEnabled,
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
    topperCopyFile,
    setTopperCopyFile,
    handleTopperCopyUpload,
    handleGenerateFromTopperCopy,
    topperGenerating,
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
    handleRestructureDraft,
    isRestructuringDraft,
    draftBackup,
    handleUndoRestructureDraft,
    handleGenerateTranscript,
    mindmap,
    resolveMindmapAction,
    handleMindmapApprove,
    handleMindmapRestructure,
    handleMindmapSetNodeInstruction,
    handleMindmapAddMore,
    handleMindmapNodeClick,
    handleMindmapDone,
  };
}
