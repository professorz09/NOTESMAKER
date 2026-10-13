import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { RewriteModal } from './components/RewriteModal';
import './liquid-top.css';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { EditorCanvas } from './components/EditorCanvas';
import { MindmapOverlay } from './components/MindmapOverlay';
import { ResumeBanner } from './components/ResumeBanner';
import { GenerationStatus } from './types';
import { useHistory } from './hooks/useHistory';
import { useEditorContent } from './hooks/useEditorContent';
import { useGeneration } from './hooks/useGeneration';
import { useAIEdit } from './hooks/useAIEdit';
import { useProjects } from './hooks/useProjects';
import { buildPrintHtml, safeSaveDraft } from './utils/editorUtils';
import { sanitizeHtml } from './utils/sanitize';
import { isOutdatedBuild } from './utils/buildVersion';
import { toast } from './components/Toast';
import { getCachedSession, signInWithCredentials, isSupabaseConfigured } from './services/supabase';
import { CURRENT_AFFAIRS_TAG } from './hooks/useProjects';

function extractProjectName(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const h1 = div.querySelector('h1');
  if (h1?.textContent?.trim()) return h1.textContent.trim().slice(0, 70);
  const h2 = div.querySelector('h2');
  if (h2?.textContent?.trim()) return h2.textContent.trim().slice(0, 70);
  return `Topic — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}`;
}

const App: React.FC = () => {
  // --- AUTH ---
  // Single-user app gated by a Supabase JWT (the gemini-proxy edge
  // function rejects requests without one). Boot path: check for a
  // cached session; if present render the editor immediately. If not,
  // show the login form so the user signs in manually. Both reads/
  // writes (projects table) and AI calls (gemini-proxy) hang off the
  // resulting JWT, so the editor must NOT render until authReady=true.
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [bootChecking, setBootChecking] = useState(isSupabaseConfigured);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInFlight, setLoginInFlight] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await getCachedSession();
        if (cancelled) return;
        if (session) setAuthReady(true);
      } catch {
        // Ignore cached-session errors — user can still sign in via form.
      } finally {
        if (!cancelled) setBootChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlight) return;
    setLoginInFlight(true);
    setLoginError(null);
    try {
      await signInWithCredentials(loginEmail.trim(), loginPassword);
      setAuthReady(true);
    } catch (err: any) {
      setLoginError(err?.message || 'Sign-in failed.');
    } finally {
      setLoginInFlight(false);
    }
  }, [loginEmail, loginPassword, loginInFlight]);

  // --- UI STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isDarkMode, setIsDarkMode] = useState(() =>
    // Dark glass by default; light only when the user picked it
    typeof window === 'undefined' || localStorage.getItem('ai_book_writer_dark') !== 'false'
  );
  // Confirm-clear modal state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // Id of the project currently being fetched from the sidebar history —
  // lets that one row show a spinner instead of looking unresponsive while
  // a large document downloads.
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);

  // A tab running an outdated bundle still has the OLD save path — the one
  // that overwrites a note by id with no revision check. Left open across a
  // deploy, its autosave wipes whatever the worker wrote in the meantime;
  // that is how two generated answers were lost. Such a tab must stop
  // writing until it is reloaded, and must say so rather than looking fine.
  const [staleBuild, setStaleBuild] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('ai_book_writer_dark', isDarkMode.toString());
  }, [isDarkMode]);

  // --- HOOKS ---
  const {
    history, historyIndex, setHistoryIndex, pushToHistory, resetHistory, canUndo, canRedo,
  } = useHistory();

  const {
    generatedHtml, setGeneratedHtml,
    isEditing, setIsEditing,
    fontSize, lineHeight,
    editorRef, isResettingRef,
    getCurrentHtml, getCleanHtml, saveToStorage,
    cancelPendingHistoryPush,
    handleEditorInput, handleEditorBlur, handleEditorKeyDown, handleEditorPaste,
    handleZoomIn, handleZoomOut,
    handleLineHeightIncrease, handleLineHeightDecrease,
    execFormat,
  } = useEditorContent({ pushToHistory });

  // --- PROJECTS --- (moved above useGeneration: the batch queue needs
  // activeProjectId/loadProjectContent/saveProject to scope itself to
  // whichever note is currently open.)
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    activeProjectId,
    setActiveProjectId,
    fetchProjects,
    syncProjects,
    loadProjectContent,
    peekProjectContent,
    adoptRevision,
    reloadRequest,
    createProject,
    saveProject,
    renameProject,
    deleteProject,
    fetchProjectsByDateRange,
  } = useProjects();

  const {
    mode, setMode,
    outputStyle, setOutputStyle,
    upscAnswerStyle, setUpscAnswerStyle,
    upscSubject, setUpscSubject,
    tableInstruction, setTableInstruction,
    upscMarks, setUpscMarks,
    detailLevel, setDetailLevel,
    groundingEnabled, setGroundingEnabled,
    upscGroundingEnabled, setUpscGroundingEnabled,
    upscMultiVariant, setUpscMultiVariant,
    pyqQuestions, pyqSelectedIds, isFindingPyq,
    handleFindPYQQuestions, togglePyqQuestion, setAllPyqSelected,
    handleDismissPyqQuestions, handleGeneratePYQAnswers,
    batchQueueItems, addToBatchQueue, removeFromBatchQueue, retryBatchItem,
    batchTabRunning, continueBatchQueue, stopBatchQueue, resumeBatchQueue, batchWorkerActive,
    notesProgress,
    status,
    language, setLanguage,
    aiModel, setAiModel,
    topicInput, setTopicInput,
    textInput, setTextInput,
    files,
    handleFileUpload, removeFile,
    handleGenerate, handleGenerateTable,
    handleNextUPSCQuestion,
    resumeSnapshots, handleResumePipeline, handleDismissResume,
    handleClearCanvas,
    translatePdfFile, setTranslatePdfFile,
    handleTranslatePdfUpload, handleTranslatePdf, handleResumePdf,
    translateProgress, translateResumeState, setTranslateResumeState,
    answerPdfFile, setAnswerPdfFile, handleAnswerPdfUpload, handleAnalyzeAnswer, answerAnalyzing,
    topperCopyFile, setTopperCopyFile, handleTopperCopyUpload, handleGenerateFromTopperCopy, topperGenerating,
    onePagerTopicInput, setOnePagerTopicInput, onePagerTopics, onePagerLoading, handleAddOnePager,
    transcriptInput, setTranscriptInput, transcriptProgress,
    handleTranscriptFileUpload, handleGenerateTranscript,
    handleRestructureDraft, isRestructuringDraft, draftBackup, handleUndoRestructureDraft,
    youtubeUrl, setYoutubeUrl,
    caUrls, setCaUrls, caDate, setCaDate, caStyle, setCaStyle, caDepth, setCaDepth, caProgress,
    handleGenerateCurrentAffairs, pendingProjectMetaRef,
    mindmap, resolveMindmapAction, handleMindmapAddMore, handleMindmapNodeClick, handleMindmapDone,
    handleMindmapApprove, handleMindmapRestructure, handleMindmapCompareApply, handleMindmapCompareDiscard,
    handleMindmapSetNodeInstruction,
  } = useGeneration({
    pushToHistory, isResettingRef, setGeneratedHtml, resetHistory, setIsEditing, setSidebarOpen, getCurrentHtml,
    activeProjectId, loadProjectContent, saveProject,
  });

  const {
    rewriteModalOpen, closeRewriteModal,
    isExtendTableOpen, extendHeadersPreview,
    rewriteInstruction, setRewriteInstruction,
    isRewriting,
    activeSectionHtml,
    rewriteType,
    editTab, setEditTab,
    rewriteModel, setRewriteModel,
    rewriteGrounded, setRewriteGrounded,
    modalImages, setModalImages,
    selectionRangeRef,
    activeEditIdRef,
    openSelectionRewriteModal,
    handleRewriteSubmit,
    handleSectionRemove,
  } = useAIEdit({ isEditing, generatedHtml, getCurrentHtml, pushToHistory, saveToStorage, editorRef, isResettingRef, setGeneratedHtml });

  // Read inside callbacks (sync, shortcuts) that must not be rebuilt every
  // time the generation status ticks.
  const statusRef = React.useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Guards against a fast double-click / clicking a second project before
  // the first one's fetch has returned — whichever request finishes LAST
  // used to win regardless of which one the user actually clicked last.
  const projectLoadSeqRef = React.useRef(0);

  // Saves the open note's latest content right now, cancelling the pending
  // debounced autosave. Leaving a note (opening another, reading a date
  // range) used to just drop that timer, losing up to the last 3s of edits.
  const flushActiveNoteRef = React.useRef<() => Promise<boolean>>(async () => true);

  const handleSelectProject = async (id: string) => {
    // A running pipeline keeps writing to the canvas as sections land — and
    // the debounced auto-save would then write that generated content into
    // the project being opened, silently corrupting it. Opening a project
    // waits until the run is finished (or the user presses Clear).
    if (status !== GenerationStatus.IDLE) {
      toast.warning('Notes are still being generated — let it finish or press Clear before opening a project.');
      return;
    }
    const mySeq = ++projectLoadSeqRef.current;
    setOpeningProjectId(id);
    try {
      if (activeProjectId && activeProjectId !== id && !(await flushActiveNoteRef.current())) {
        // Switching anyway would throw away the unsaved edits for good.
        if (projectLoadSeqRef.current === mySeq) setOpeningProjectId(null);
        toast.error('Could not save the open note, so it was kept open — check your connection and try again.');
        return;
      }
      if (projectLoadSeqRef.current !== mySeq) return;
      const raw = await loadProjectContent(id);
      if (projectLoadSeqRef.current !== mySeq) return; // superseded by a later click
      // Re-sanitize on load: projects saved before the style-leak fix can
      // carry global <style> blocks that break the whole app UI.
      const content = sanitizeHtml(raw ?? '');
      isResettingRef.current = true;
      cancelPendingHistoryPush();
      setGeneratedHtml(content);
      // Fresh undo stack per note. Keeping the previous note's entries let
      // Ctrl+Z put note A's content on screen while note B was active —
      // and the autosave then wrote A's content into B.
      resetHistory();
      pushToHistory(content);
      safeSaveDraft(content);
      setTimeout(() => { isResettingRef.current = false; }, 100);
      // Hold the skeleton until the note is actually ON SCREEN, not merely
      // fetched. Setting a large note's HTML is the slow part — the browser
      // still has to parse and lay out hundreds of KB after React commits —
      // so clearing this in the `finally` below hid the skeleton and left a
      // blank page for the seconds that took. Two frames: the first is the
      // commit that writes the HTML into the editor, the second is after the
      // browser has painted it.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (projectLoadSeqRef.current === mySeq) setOpeningProjectId(null);
      }));
      // Only mark this project "active" on a SUCCESSFUL load — otherwise a
      // failed fetch would still let the debounced auto-save below start
      // overwriting this project with whatever unrelated document is
      // already on screen.
      setActiveProjectId(id);
    } catch (err: any) {
      if (projectLoadSeqRef.current !== mySeq) return;
      console.error(err);
      toast.error(`Could not open that project: ${err?.message || 'please try again.'}`);
      // Failed — nothing is going to paint, so drop the skeleton now (the
      // success path hands this off to the frame callback above instead).
      if (projectLoadSeqRef.current === mySeq) setOpeningProjectId(null);
    }
  };

  // "Read by date range" — the special calendar feature: pulls every
  // Current-Affairs-tagged note whose entry_date falls in [start, end] and
  // merges them into one combined read on the canvas. Not saved as a
  // project of its own (activeProjectId stays null) — the user can hit
  // "New" afterwards if they want to keep the merged read.
  const handleReadDateRange = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    if (status !== GenerationStatus.IDLE) {
      toast.warning('Notes are still being generated — let it finish or press Clear before reading a date range.');
      return;
    }
    try {
      if (!(await flushActiveNoteRef.current())) {
        toast.error('Could not save the open note — check your connection before leaving it.');
        return;
      }
      const items = await fetchProjectsByDateRange(CURRENT_AFFAIRS_TAG, start, end);
      if (!items.length) {
        toast.info('No current affairs notes found in that date range.');
        return;
      }
      const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const header = `<h1>Current Affairs — ${fmt(start)} to ${fmt(end)}</h1><p class="ca-range-meta">${items.length} day(s) combined, oldest first</p>`;
      const combined = header + '\n' + items.map(it => sanitizeHtml(it.content)).join('\n<hr class="upsc-qa-divider" />\n');
      isResettingRef.current = true;
      cancelPendingHistoryPush();
      setGeneratedHtml(combined);
      resetHistory();
      pushToHistory(combined);
      safeSaveDraft(combined);
      setActiveProjectId(null);
      setTimeout(() => { isResettingRef.current = false; }, 100);
      toast.success(`Combined ${items.length} day(s) of current affairs notes.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Could not load that date range: ${err?.message || 'please try again.'}`);
    }
  }, [status, fetchProjectsByDateRange, isResettingRef, setGeneratedHtml, pushToHistory, resetHistory, cancelPendingHistoryPush, setActiveProjectId]);

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const generatedHtmlRef = React.useRef<string | null>(generatedHtml);
  useEffect(() => { generatedHtmlRef.current = generatedHtml; }, [generatedHtml]);

  const handleCreateProject = async () => {
    const content = isEditing && editorRef.current ? getCleanHtml() : (generatedHtml || '');
    if (!content) return;
    const name = extractProjectName(content);
    const proj = await createProject(name, content);
    if (proj) {
      setActiveProjectId(proj.id);
      setLastSavedAt(new Date());
      toast.success(`Project "${name.slice(0, 30)}" saved!`);
    }
  };

  // Keep a live read of the projects array inside saveToProject without
  // recreating the callback on every project list mutation — recreating
  // would invalidate the debounced auto-save timer set up below and
  // every keystroke would re-arm a fresh 3s window.
  const projectsRef = React.useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const handleSaveNow = useCallback(async () => {
    if (!activeProjectId) return;
    if (staleBuild) {
      toast.warning('This tab is running an old version of the app — reload the page before saving, or it could overwrite newer answers.');
      return;
    }
    // Only claim "Saved!" when it was — a failed save already shows its
    // own error toast.
    dirtyRef.current = true;
    if (await flushActiveNoteRef.current()) toast.success('Saved!');
  }, [activeProjectId, staleBuild]);

  // --- UNDO / REDO ---
  const applyHistoryIndex = useCallback((newIndex: number, historySnap: string[]) => {
    const content = historySnap[newIndex];
    cancelPendingHistoryPush();
    isResettingRef.current = true;
    setGeneratedHtml(content);
    setHistoryIndex(newIndex);
    safeSaveDraft(content);
    if (editorRef.current) editorRef.current.innerHTML = content;
    setTimeout(() => { isResettingRef.current = false; }, 150);
  }, [cancelPendingHistoryPush, setGeneratedHtml, setHistoryIndex, editorRef, isResettingRef]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) applyHistoryIndex(historyIndex - 1, history);
  }, [historyIndex, history, applyHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) applyHistoryIndex(historyIndex + 1, history);
  }, [historyIndex, history, applyHistoryIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape closes confirm modal (it never needs a modifier — inside the
      // Ctrl/⌘ branch below it could never fire).
      if (e.key === 'Escape') { setShowClearConfirm(false); return; }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      // Text fields keep their own native undo/redo — hijacking Ctrl+Z
      // there rewound the whole note instead of the typed topic.
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        // Rewinding the canvas mid-generation fights the pipeline still
        // writing to it.
        if (statusRef.current !== GenerationStatus.IDLE) return;
        if (key === 'z' && !e.shiftKey) handleUndo(); else handleRedo();
        return;
      }
      if (key === 'e' && !e.shiftKey && generatedHtml) {
        e.preventDefault();
        if (isEditing) { setIsEditing(false); saveToStorage(); } else { setIsEditing(true); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, isEditing, generatedHtml, setIsEditing, saveToStorage]);

  // First generation of a fresh document → create its project entry.
  const prevStatusRef = React.useRef(status);
  useEffect(() => {
    const wasGenerating = prevStatusRef.current !== GenerationStatus.IDLE;
    const isNowIdle = status === GenerationStatus.IDLE;
    prevStatusRef.current = status;
    if (!wasGenerating || !isNowIdle) return;
    const html = generatedHtmlRef.current;
    if (!html) return;
    // A project is already open — this generation cycle APPENDED to it
    // (e.g. "Next Question" / a batch-question queue writing one more
    // Q&A block onto the same document) rather than starting a new one.
    // The debounced auto-save effect below already keeps that project's
    // content current; creating another project here would just leave a
    // duplicate full-content copy behind on every single cycle.
    if (activeProjectId) return;
    const name = extractProjectName(html);
    // A just-finished Current Affairs run leaves its tag/date here — consume
    // it now (and clear it) so the tag can never leak onto some later,
    // unrelated generation's project.
    const meta = pendingProjectMetaRef.current;
    pendingProjectMetaRef.current = null;
    createProject(name, html, meta ? { tags: meta.tags, entryDate: meta.entryDate } : undefined).then(proj => {
      if (proj) { setActiveProjectId(proj.id); setLastSavedAt(new Date()); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Debounced auto-save every 3s
  const projectSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while the open note has changes not yet confirmed saved — a pending
  // timer, or a save that failed (offline). Drives the flush on leave, the
  // retry when the connection returns, and the close-tab warning.
  const dirtyRef = React.useRef(false);
  const activeProjectIdRef = React.useRef(activeProjectId);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);

  // Resolves true when nothing is left unsaved.
  const saveActiveNow = useCallback(async (): Promise<boolean> => {
    const id = activeProjectIdRef.current;
    if (projectSaveTimerRef.current) { clearTimeout(projectSaveTimerRef.current); projectSaveTimerRef.current = null; }
    if (!id || !dirtyRef.current || staleBuild) return true;
    // Read the editor DOM directly while editing: the canvas state lags the
    // last keystrokes by the 800ms input debounce.
    const html = isEditing && editorRef.current ? getCleanHtml() : (generatedHtmlRef.current || '');
    if (!html) return true;
    dirtyRef.current = false;
    const ok = await saveProject(id, html);
    if (!ok) {
      if (activeProjectIdRef.current === id) dirtyRef.current = true;
      return false;
    }
    setLastSavedAt(new Date());
    // Auto-rename: keep the sidebar tile in step with an edited H1/H2,
    // writing only when the name actually changed.
    const proj = projectsRef.current.find(p => p.id === id);
    const nextName = extractProjectName(html);
    if (proj && nextName && nextName !== proj.name) await renameProject(id, nextName);
    return true;
  }, [staleBuild, isEditing, editorRef, getCleanHtml, saveProject, renameProject]);
  flushActiveNoteRef.current = saveActiveNow;

  useEffect(() => {
    if (!activeProjectId || !generatedHtml || isResettingRef.current) return;
    // Outdated tab: its save would be the unguarded kind. Better to save
    // nothing than to overwrite answers written since this tab loaded.
    if (staleBuild) return;
    dirtyRef.current = true;
    if (projectSaveTimerRef.current) clearTimeout(projectSaveTimerRef.current);
    projectSaveTimerRef.current = setTimeout(() => {
      projectSaveTimerRef.current = null;
      flushActiveNoteRef.current();
    }, 3000);
    return () => { if (projectSaveTimerRef.current) clearTimeout(projectSaveTimerRef.current); };
  }, [generatedHtml, activeProjectId, staleBuild]);

  // A note switch must not carry "dirty" over to the next note.
  useEffect(() => { dirtyRef.current = false; }, [activeProjectId]);

  // Retry a failed (offline) save as soon as the connection is back, save
  // immediately when the tab is hidden (mobile may kill it before the 3s
  // timer fires), and warn before closing with changes still unsaved.
  useEffect(() => {
    const onOnline = () => { if (dirtyRef.current) flushActiveNoteRef.current(); };
    const onHide = () => { if (document.visibilityState === 'hidden' && dirtyRef.current) flushActiveNoteRef.current(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || !activeProjectIdRef.current) return;
      flushActiveNoteRef.current();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  // While the BACKGROUND WORKER is writing this note's queued answers, keep
  // the open canvas in step with what it's saving.
  //
  // Without this the tab holds whatever the note looked like when it was
  // opened, blind to the answers the worker has appended since — and the
  // 3s autosave above then writes that stale copy back over them the moment
  // the student edits so much as a character. Answers generated while the
  // note sat open would simply vanish, which is the exact failure this whole
  // area keeps coming back to.
  //
  // Only runs when this tab is NOT the one generating (nothing to sync from
  // itself) and the student isn't mid-edit (their unsaved typing must never
  // be replaced by a server read).
  const syncStateRef = React.useRef({ activeProjectId, batchTabRunning, isEditing, items: batchQueueItems });
  useEffect(() => {
    syncStateRef.current = { activeProjectId, batchTabRunning, isEditing, items: batchQueueItems };
  }, [activeProjectId, batchTabRunning, isEditing, batchQueueItems]);

  const syncOpenNoteFromServer = useCallback(async (requireLiveQueue: boolean) => {
    const { activeProjectId: pid, batchTabRunning: running, isEditing: editing, items } = syncStateRef.current;
    if (!pid || running || editing || isResettingRef.current) return;
    if (statusRef.current !== GenerationStatus.IDLE) return;
    // An empty canvas means the student cleared it on purpose. Pulling the
    // note back down would undo that in front of them.
    if (!generatedHtmlRef.current) return;
    if (requireLiveQueue && !items.some(it => it.status === 'active' || it.status === 'pending')) return;
    try {
      // Peek, don't adopt: if this read is NOT put on the canvas (an edit
      // started meanwhile), adopting it as the save base would let the
      // next autosave of the older canvas pass the revision check and
      // overwrite exactly what this sync came to pull in.
      const { content: saved, updatedAt } = await peekProjectContent(pid);
      if (saved == null) return;
      // Re-check: an edit, a note switch or unsaved typing may have started
      // during the fetch.
      const now = syncStateRef.current;
      if (now.activeProjectId !== pid || now.isEditing || now.batchTabRunning || dirtyRef.current) return;
      const clean = sanitizeHtml(saved);
      if (clean === (generatedHtmlRef.current || '')) { adoptRevision(pid, saved, updatedAt); return; }
      adoptRevision(pid, saved, updatedAt);
      isResettingRef.current = true;
      setGeneratedHtml(clean);
      pushToHistory(clean);
      setTimeout(() => { isResettingRef.current = false; }, 100);
    } catch { /* transient — the next attempt tries again */ }
  }, [peekProjectContent, adoptRevision, setGeneratedHtml, pushToHistory, isResettingRef]);

  // A save hit a conflict: the server copy now holds answers the canvas
  // doesn't, and useProjects refuses further saves of this note until it
  // is re-read. Re-read it now — even mid-edit, since every save from the
  // stale canvas is blocked until this happens.
  useEffect(() => {
    if (!reloadRequest) return;
    const pid = reloadRequest.id;
    if (pid !== activeProjectIdRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadProjectContent(pid);
        if (cancelled || pid !== activeProjectIdRef.current) return;
        const clean = sanitizeHtml(saved ?? '');
        if (projectSaveTimerRef.current) { clearTimeout(projectSaveTimerRef.current); projectSaveTimerRef.current = null; }
        dirtyRef.current = false;
        isResettingRef.current = true;
        cancelPendingHistoryPush();
        setGeneratedHtml(clean);
        if (editorRef.current) editorRef.current.innerHTML = clean;
        pushToHistory(clean);
        setTimeout(() => { isResettingRef.current = false; }, 100);
      } catch {
        toast.error('Could not reload this note after a background update — reopen it from the sidebar before editing.');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadRequest]);

  useEffect(() => {
    const timer = setInterval(() => { syncOpenNoteFromServer(true); }, 15000);
    return () => clearInterval(timer);
  }, [syncOpenNoteFromServer]);

  // The interval above is not enough on its own, and this is the gap that
  // actually cost a note: browsers throttle — and on mobile suspend
  // outright — timers in a backgrounded tab. That is exactly when the
  // worker does its work, so the tab wakes up holding a copy that can be
  // hours old, and the first autosave after any edit writes it back over
  // everything generated in the meantime.
  //
  // So re-read the note the moment the tab is looked at again. Deliberately
  // WITHOUT requiring a live queue: if the worker drained the whole queue
  // while the tab slept there is nothing left pending to key off, and that
  // is the very case where the canvas is most stale and most dangerous.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') syncOpenNoteFromServer(false);
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [syncOpenNoteFromServer]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (cancelled || staleBuild || document.visibilityState !== 'visible') return;
      if (await isOutdatedBuild()) setStaleBuild(true);
    };
    check();
    const timer = setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [staleBuild]);

  // --- CLEAR CANVAS ---
  const onClearCanvas = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    handleClearCanvas(activeEditIdRef, selectionRangeRef);
    setShowClearConfirm(false);
  };

  // Auto-save before generating, then DETACH from the open project. A new
  // generation produces a NEW document (it gets its own project entry when
  // it completes) — if the old project stayed "active", the debounced
  // auto-save below would keep writing every live-generated section INTO
  // that old project (and even auto-rename it), silently replacing the
  // user's saved notes with the new generation's content.
  // Holds from the first press until the pipeline has taken over. The save
  // flush awaits a network round-trip, during which status is still IDLE —
  // a second Enter/click in that gap started a second, parallel generation.
  const generateStartingRef = React.useRef(false);
  const startNewDocument = useCallback(async (start: () => unknown) => {
    if (generateStartingRef.current || statusRef.current !== GenerationStatus.IDLE) return;
    generateStartingRef.current = true;
    try {
      if (!(await flushActiveNoteRef.current())) {
        toast.error('Could not save the open note — fix the connection first, or its latest edits would be lost.');
        return;
      }
      setActiveProjectId(null);
      await Promise.resolve(start());
    } finally {
      generateStartingRef.current = false;
    }
  }, [setActiveProjectId]);

  const handleGenerateWithAutoSave = useCallback((e: React.FormEvent) => {
    // Synchronously — after an await it is too late to stop the form submit.
    e.preventDefault();
    return startNewDocument(() => handleGenerate(e));
  }, [startNewDocument, handleGenerate]);

  const handleGenerateTableWithAutoSave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return startNewDocument(() => handleGenerateTable(e));
  }, [startNewDocument, handleGenerateTable]);

  const handleGenerateTranscriptWithAutoSave = useCallback(
    () => startNewDocument(() => handleGenerateTranscript()),
    [startNewDocument, handleGenerateTranscript],
  );

  // --- PDF EXPORT ---
  // Shared by both export paths: strip in-editor-only UI (edit triggers,
  // table toolbars) that must never appear in an exported document.
  const getExportableContent = (): string | null => {
    if (!generatedHtml) return null;
    const content = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
    const temp = document.createElement('div');
    temp.innerHTML = content;
    temp.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
    temp.querySelectorAll('.table-sparkle-bar').forEach(t => t.remove());
    temp.querySelectorAll('.table-extend-bar').forEach(t => t.remove());
    temp.querySelectorAll('.col-resize-handle').forEach(t => t.remove());
    temp.querySelectorAll('[data-table-id]').forEach(el => el.removeAttribute('data-table-id'));
    return temp.innerHTML;
  };

  // Path 1: browser print window — user can print or "Save as PDF" via the
  // native print dialog. Best for fine control (paper size, margins) but
  // requires pop-ups allowed and an extra manual "Save as PDF" step.
  const handleExportPDF = () => {
    const content = getExportableContent();
    if (content === null) {
      toast.info('Nothing to export yet. Generate some content first.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-ups are blocked. Please allow pop-ups for this site to export PDF.');
      return;
    }
    win.document.open();
    win.document.write(buildPrintHtml(content, fontSize, lineHeight));
    win.document.close();
  };

  // Path 2: direct download — no browser dialog, no pop-up permission needed.
  // Rasterizes the notes into a real multi-page PDF file and saves it
  // straight to Downloads (or the mobile share sheet), paginated so no
  // heading/row/diagram is ever cut across a page boundary.
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const handleDownloadPdfDirect = useCallback(async () => {
    const content = getExportableContent();
    if (content === null) {
      toast.info('Nothing to export yet. Generate some content first.');
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const { exportContentAsPdfDirect } = await import('./utils/pdfDirectExport');
      const html = isEditing && editorRef.current ? getCleanHtml() : (generatedHtml || '');
      const baseName = extractProjectName(html).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Notes';
      // A UPSC answer renders into the printed answer-copy frame (PROFESSOR /
      // UPSC header, ruled margin, page numbers); everything else uses the
      // clean plain sheet.
      const template = /upsc-qa-block|upsc-question/.test(content) ? 'answerCopy' : 'plain';
      await exportContentAsPdfDirect(content, { fontSize, lineHeight, fileName: baseName, template });
      toast.success('PDF downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error(`PDF download failed: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [generatedHtml, isEditing, editorRef, getCleanHtml, fontSize, lineHeight]);

  // Path 3: direct DOCX download — rebuilds the notes as a real, editable
  // Word document (headings/lists/tables/formatting preserved, diagrams and
  // images embedded) instead of the rasterized pages the PDF export makes.
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const handleDownloadDocx = useCallback(async () => {
    const content = getExportableContent();
    if (content === null) {
      toast.info('Nothing to export yet. Generate some content first.');
      return;
    }
    setIsDownloadingDocx(true);
    try {
      const { exportContentAsDocx } = await import('./utils/docxExport');
      const html = isEditing && editorRef.current ? getCleanHtml() : (generatedHtml || '');
      const baseName = extractProjectName(html).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Notes';
      await exportContentAsDocx(content, { fileName: baseName });
      toast.success('DOCX downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error(`DOCX download failed: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsDownloadingDocx(false);
    }
  }, [generatedHtml, isEditing, editorRef, getCleanHtml]);

  // --- TABLE OF CONTENTS ---
  const handleAddTableOfContents = () => {
    if (!generatedHtml) return;
    const temp = document.createElement('div');
    temp.innerHTML = generatedHtml;
    const existing = temp.querySelector('.table-of-contents');
    if (existing) {
      existing.remove();
      const html = temp.innerHTML;
      setGeneratedHtml(html);
      pushToHistory(html);
      saveToStorage();
      toast.info('Table of contents removed.');
      return;
    }
    const headings = temp.querySelectorAll('h1, h2, h3, h4');
    if (!headings.length) {
      toast.warning('No headings found. Generate content with headings first.');
      return;
    }
    const items: { text: string; id: string; level: number }[] = [];
    headings.forEach((h, i) => {
      if (!h.id) h.id = `heading-${i}`;
      items.push({ text: h.textContent || '', id: h.id, level: parseInt(h.tagName[1]) });
    });
    const tocHtml = `<div class="table-of-contents"><h2>Index</h2><nav><ul>
      ${items.map(item => `<li style="padding-left:${(item.level - 1) * 16}px;">
        <a href="#${item.id}"><span class="toc-title">${item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span><span class="toc-dots"></span><span class="toc-link-icon">→</span></a>
      </li>`).join('')}
    </ul></nav></div>`;
    const html = tocHtml + temp.innerHTML;
    setGeneratedHtml(html);
    pushToHistory(html);
    saveToStorage();
    toast.success('Table of contents added!');
  };

  // --- RENDER ---
  // Boot path: check for a cached session before showing the form so
  // returning users skip the login screen entirely (Supabase persists
  // the session in localStorage; getSession() resolves instantly).
  if (bootChecking) {
    return (
      <div className={`nm-app flex h-screen items-center justify-center px-6 ${isDarkMode ? 'dark' : ''}`}>
        <div className="nm-sheet nm-auth nm-pop flex flex-col items-center gap-5 px-10 py-9">
          <div className="nm-appicon w-[68px] h-[68px] rounded-[22px]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
          </div>
          <div className="text-center">
            <h1 className="nm-head text-xl font-extrabold tracking-tight leading-none">UPSC Notes Maker</h1>
            <p className="nm-label mt-2.5">AI Study Notes</p>
          </div>
          <div className="nm-boot-track w-36 h-1 rounded-full overflow-hidden" role="progressbar" aria-label="Loading">
            <div className="nm-boot-bar h-full w-1/2 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className={`nm-app flex min-h-screen items-center justify-center px-4 py-8 ${isDarkMode ? 'dark' : ''}`}>
        <form
          onSubmit={handleLogin}
          autoComplete="off"
          className="nm-sheet nm-auth nm-pop relative p-7 sm:p-8 w-full max-w-sm"
        >
          <div className="flex flex-col items-center text-center mb-7">
            <div className="nm-appicon w-16 h-16 rounded-[20px] mb-4">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
            </div>
            <h2 className="nm-head text-2xl font-extrabold tracking-tight">UPSC Notes Maker</h2>
            <p className="nm-muted text-sm mt-1.5">Sign in to continue</p>
          </div>

          {/* Off-screen (not display:none — browsers skip hidden fields for
              autofill) decoys absorb aggressive browser/password-manager
              autofill so the real email/password below stay empty on load. */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
            <input type="text" name="username" autoComplete="username" tabIndex={-1} />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
          </div>

          <label className="nm-label block mb-2 ml-1" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="nm-login-email"
            type="email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="you@example.com"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            disabled={loginInFlight}
            className="nm-input mb-4 h-12 !text-base sm:!text-[0.92rem]"
          />

          <label className="nm-label block mb-2 ml-1" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="nm-login-password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password"
            required
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            disabled={loginInFlight}
            className="nm-input mb-6 h-12 !text-base sm:!text-[0.92rem]"
          />

          {loginError && (
            <div className="mb-4 px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30" role="alert">
              <p className="text-sm text-red-600 dark:text-red-300">{loginError}</p>
            </div>
          )}

          <button type="submit" disabled={loginInFlight} className="nm-btn-primary nm-focus w-full h-12 text-base">
            {loginInFlight ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`nm-app flex h-screen w-full font-sans overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <style>{`@media print { @page { size: A4 portrait; margin: 5mm; } }`}</style>

      {/* Saving is switched off in this tab until it reloads (see staleBuild),
          so this has to be impossible to miss — a note that silently stops
          saving is worse than one that says why. */}
      {staleBuild && (
        <div className="fixed top-2 inset-x-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-max sm:max-w-[calc(100%-1rem)] z-[60] rounded-2xl bg-amber-400 text-amber-950 border border-amber-200/60 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] font-semibold shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] no-print">
          <span>This tab is running an old version — saving is paused here so it can't overwrite newer answers.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 px-4 rounded-full bg-amber-950 text-amber-50 font-bold hover:brightness-125 transition"
          >
            Reload
          </button>
        </div>
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mode={mode} setMode={setMode}
        outputStyle={outputStyle} setOutputStyle={setOutputStyle}
        upscAnswerStyle={upscAnswerStyle} setUpscAnswerStyle={setUpscAnswerStyle}
        upscSubject={upscSubject} setUpscSubject={setUpscSubject}
        upscMarks={upscMarks} setUpscMarks={setUpscMarks}
        detailLevel={detailLevel} setDetailLevel={setDetailLevel}
        groundingEnabled={groundingEnabled} setGroundingEnabled={setGroundingEnabled}
        upscGroundingEnabled={upscGroundingEnabled} setUpscGroundingEnabled={setUpscGroundingEnabled}
        upscMultiVariant={upscMultiVariant} setUpscMultiVariant={setUpscMultiVariant}
        onFindPYQQuestions={handleFindPYQQuestions} isFindingPyq={isFindingPyq}
        notesProgress={notesProgress}
        topicInput={topicInput} setTopicInput={setTopicInput}
        textInput={textInput} setTextInput={setTextInput}
        files={files}
        handleFileUpload={handleFileUpload}
        removeFile={removeFile}
        language={language} setLanguage={setLanguage}
        aiModel={aiModel} setAiModel={setAiModel}
        tableInstruction={tableInstruction} setTableInstruction={setTableInstruction}
        handleGenerate={handleGenerateWithAutoSave}
        handleGenerateTable={handleGenerateTableWithAutoSave}
        status={status}
        handleClearCanvas={onClearCanvas}
        handleUndo={handleUndo}
        canUndo={canUndo}
        projects={projects}
        projectsLoading={projectsLoading}
        projectsError={projectsError}
        activeProjectId={activeProjectId}
        isSupabaseConfigured={isSupabaseConfigured}
        lastSavedAt={lastSavedAt}
        onFetchProjects={fetchProjects}
        onSync={syncProjects}
        onSaveNow={handleSaveNow}
        onSelectProject={handleSelectProject}
        openingProjectId={openingProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={deleteProject}
        onRenameProject={renameProject}
        hasContent={!!generatedHtml}
        translatePdfFile={translatePdfFile}
        handleTranslatePdfUpload={handleTranslatePdfUpload}
        handleTranslatePdf={handleTranslatePdf}
        handleResumePdf={handleResumePdf}
        setTranslatePdfFile={setTranslatePdfFile}
        translateProgress={translateProgress}
        translateResumeState={translateResumeState}
        setTranslateResumeState={setTranslateResumeState}
        answerPdfFile={answerPdfFile}
        setAnswerPdfFile={setAnswerPdfFile}
        handleAnswerPdfUpload={handleAnswerPdfUpload}
        handleAnalyzeAnswer={handleAnalyzeAnswer}
        answerAnalyzing={answerAnalyzing}
        topperCopyFile={topperCopyFile}
        setTopperCopyFile={setTopperCopyFile}
        handleTopperCopyUpload={handleTopperCopyUpload}
        handleGenerateFromTopperCopy={handleGenerateFromTopperCopy}
        topperGenerating={topperGenerating}
        onePagerTopicInput={onePagerTopicInput}
        setOnePagerTopicInput={setOnePagerTopicInput}
        onePagerTopics={onePagerTopics}
        onePagerLoading={onePagerLoading}
        handleAddOnePager={handleAddOnePager}
        transcriptInput={transcriptInput}
        setTranscriptInput={setTranscriptInput}
        handleTranscriptFileUpload={handleTranscriptFileUpload}
        handleGenerateTranscript={handleGenerateTranscriptWithAutoSave}
        handleRestructureDraft={handleRestructureDraft}
        isRestructuringDraft={isRestructuringDraft}
        draftBackup={draftBackup}
        handleUndoRestructureDraft={handleUndoRestructureDraft}
        transcriptProgress={transcriptProgress}
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={setYoutubeUrl}
        caUrls={caUrls}
        setCaUrls={setCaUrls}
        caDate={caDate}
        setCaDate={setCaDate}
        caStyle={caStyle}
        setCaStyle={setCaStyle}
        caDepth={caDepth}
        setCaDepth={setCaDepth}
        caProgress={caProgress}
        handleGenerateCurrentAffairs={handleGenerateCurrentAffairs}
        onReadDateRange={handleReadDateRange}
      />

      <main className="nm-canvas flex-1 min-w-0 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        {!mindmap && <LoadingOverlay status={status} />}
        {mindmap && (
          <MindmapOverlay
            mindmap={mindmap}
            onRetry={() => resolveMindmapAction('retry')}
            onSkip={() => resolveMindmapAction('skip')}
            onFinish={() => resolveMindmapAction('finish')}
            onNodeClick={handleMindmapNodeClick}
            onSetNodeInstruction={handleMindmapSetNodeInstruction}
            onApprove={handleMindmapApprove}
            onRestructure={handleMindmapRestructure}
            onCompareApply={handleMindmapCompareApply}
            onCompareDiscard={handleMindmapCompareDiscard}
            onAddMore={handleMindmapAddMore}
            onDone={handleMindmapDone}
          />
        )}
        <Toolbar
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          handleUndo={handleUndo} handleRedo={handleRedo}
          canUndo={canUndo} canRedo={canRedo}
          fontSize={fontSize}
          handleZoomOut={handleZoomOut} handleZoomIn={handleZoomIn}
          lineHeight={lineHeight}
          handleLineHeightIncrease={handleLineHeightIncrease}
          handleLineHeightDecrease={handleLineHeightDecrease}
          isEditing={isEditing} setIsEditing={setIsEditing}
          execFormat={execFormat}
          openSelectionRewriteModal={openSelectionRewriteModal}
          saveToStorage={saveToStorage}
          handleExportPDF={handleExportPDF}
          handleDownloadPdfDirect={handleDownloadPdfDirect}
          isDownloadingPdf={isDownloadingPdf}
          handleDownloadDocx={handleDownloadDocx}
          isDownloadingDocx={isDownloadingDocx}
          handleAddTableOfContents={handleAddTableOfContents}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(d => !d)}
        />

        <div className="nm-scroll flex-1 overflow-auto pt-[76px] md:pt-[86px] pb-12 px-2 sm:px-4 md:px-6 lg:px-10 xl:px-16 relative">
          <EditorCanvas
            generatedHtml={generatedHtml}
            status={status}
            isEditing={isEditing}
            fontSize={fontSize}
            lineHeight={lineHeight}
            editorRef={editorRef}
            handleEditorInput={handleEditorInput}
            handleEditorBlur={handleEditorBlur}
            handleEditorKeyDown={handleEditorKeyDown}
            handleEditorPaste={handleEditorPaste}
            mode={mode}
            onGetStarted={() => setSidebarOpen(true)}
            outputStyle={outputStyle}
            upscAnswerStyle={upscAnswerStyle}
            upscSubject={upscSubject}
            marks={upscMarks}
            handleNextUPSCQuestion={handleNextUPSCQuestion}
            pyqQuestions={pyqQuestions}
            pyqSelectedIds={pyqSelectedIds}
            togglePyqQuestion={togglePyqQuestion}
            setAllPyqSelected={setAllPyqSelected}
            onDismissPyqQuestions={handleDismissPyqQuestions}
            onGeneratePyqAnswers={handleGeneratePYQAnswers}
            batchQueueItems={batchQueueItems}
            onAddToBatchQueue={addToBatchQueue}
            onRemoveFromBatchQueue={removeFromBatchQueue}
            onRetryBatchItem={retryBatchItem}
            batchTabRunning={batchTabRunning}
            onContinueBatchQueue={continueBatchQueue}
            onStopBatchQueue={stopBatchQueue}
            onResumeBatchQueue={resumeBatchQueue}
            batchWorkerActive={batchWorkerActive}
            isOpeningProject={!!openingProjectId}
          />
        </div>
      </main>

      <RewriteModal
        isOpen={rewriteModalOpen}
        onClose={closeRewriteModal}
        isExtendTable={isExtendTableOpen}
        extendHeadersPreview={extendHeadersPreview}
        rewriteType={rewriteType}
        editTab={editTab} setEditTab={setEditTab}
        rewriteModel={rewriteModel} setRewriteModel={setRewriteModel}
        rewriteGrounded={rewriteGrounded} setRewriteGrounded={setRewriteGrounded}
        rewriteInstruction={rewriteInstruction} setRewriteInstruction={setRewriteInstruction}
        isRewriting={isRewriting}
        handleRewriteSubmit={handleRewriteSubmit}
        handleSectionRemove={rewriteType === 'section' ? handleSectionRemove : undefined}
        selectionText={rewriteType === 'section' ? 'Selected Section Context…' : ((selectionRangeRef.current?.toString().substring(0, 150) ?? '') + '…')}
        modalImages={modalImages}
        setModalImages={setModalImages}
      />

      <ClearConfirmModal
        isOpen={showClearConfirm}
        onConfirm={confirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />

      {!mindmap && status === GenerationStatus.IDLE && (
        <ResumeBanner
          snapshots={resumeSnapshots}
          onResume={(snap) => {
            // Same detach as the generate buttons: the resumed run is its
            // own document — the debounced auto-save must not write its
            // sections into whatever project happens to be open.
            setActiveProjectId(null);
            handleResumePipeline(snap);
          }}
          onDismiss={handleDismissResume}
        />
      )}
    </div>
  );
};

export default App;
