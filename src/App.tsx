import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { RewriteModal } from './components/RewriteModal';
import { Button } from './components/Button';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { EditorCanvas } from './components/EditorCanvas';
import { GenerationStatus } from './types';
import { useHistory } from './hooks/useHistory';
import { useEditorContent } from './hooks/useEditorContent';
import { useGeneration } from './hooks/useGeneration';
import { useAIEdit } from './hooks/useAIEdit';
import { useProjects } from './hooks/useProjects';
import { STORAGE_KEY, buildPrintHtml } from './utils/editorUtils';
import { toast } from './components/Toast';
import { RefreshCw } from 'lucide-react';
import { ensureSession, isSupabaseConfigured } from './services/supabase';

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
  // Single-user app, no signup UI. ensureSession() either resumes a
  // cached Supabase session or signs in once with baked credentials.
  // Everything (data reads/writes, gemini-proxy calls) hangs off the
  // resulting JWT, so the editor must NOT render until this resolves.
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (!cancelled) setAuthReady(true);
      } catch (e: any) {
        if (!cancelled) setAuthError(e?.message || 'Sign-in failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- UI STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('ai_book_writer_dark') === 'true'
  );
  // Confirm-clear modal state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
  } = useEditorContent({ pushToHistory });

  const {
    mode, setMode,
    outputStyle, setOutputStyle,
    upscAnswerStyle, setUpscAnswerStyle,
    upscSubject, setUpscSubject,
    tableInstruction, setTableInstruction,
    wordLimit, setWordLimit,
    status,
    language, setLanguage,
    aiModel, setAiModel,
    topicInput, setTopicInput,
    textInput, setTextInput,
    files,
    handleFileUpload, removeFile,
    handleGenerate, handleGenerateTable,
    handleNextUPSCQuestion,
    handleClearCanvas,
    translatePdfFile, setTranslatePdfFile,
    handleTranslatePdfUpload, handleTranslatePdf, handleResumePdf,
    translateProgress, translateResumeState, setTranslateResumeState,
    answerPdfFile, setAnswerPdfFile, handleAnswerPdfUpload, handleAnalyzeAnswer, answerAnalyzing,
    onePagerTopicInput, setOnePagerTopicInput, onePagerTopics, onePagerLoading, handleAddOnePager,
  } = useGeneration({ pushToHistory, isResettingRef, setGeneratedHtml, resetHistory, setIsEditing, setSidebarOpen, getCurrentHtml });

  const {
    rewriteModalOpen, closeRewriteModal,
    isExtendTableOpen, extendHeadersPreview,
    rewriteInstruction, setRewriteInstruction,
    isRewriting,
    activeSectionHtml,
    rewriteType,
    editTab, setEditTab,
    rewriteModel, setRewriteModel,
    modalImages, setModalImages,
    selectionRangeRef,
    activeEditIdRef,
    openSelectionRewriteModal,
    handleRewriteSubmit,
    handleSectionRemove,
  } = useAIEdit({ isEditing, generatedHtml, getCurrentHtml, pushToHistory, saveToStorage, editorRef, isResettingRef, setGeneratedHtml });

  // --- PROJECTS ---
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    activeProjectId,
    setActiveProjectId,
    fetchProjects,
    syncProjects,
    loadProjectContent,
    createProject,
    saveProject,
    renameProject,
    deleteProject,
  } = useProjects();

  const handleSelectProject = async (id: string) => {
    const content = await loadProjectContent(id);
    if (content !== null) {
      isResettingRef.current = true;
      setGeneratedHtml(content);
      pushToHistory(content);
      localStorage.setItem(STORAGE_KEY, content);
      setTimeout(() => { isResettingRef.current = false; }, 100);
    }
    setActiveProjectId(id);
  };

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

  const saveToProject = useCallback(async (id: string, html: string) => {
    const ok = await saveProject(id, html);
    if (ok) setLastSavedAt(new Date());
  }, [saveProject]);

  const handleSaveNow = useCallback(async () => {
    if (!activeProjectId) return;
    const html = isEditing && editorRef.current ? getCleanHtml() : (generatedHtmlRef.current || '');
    if (html) {
      await saveToProject(activeProjectId, html);
      toast.success('Saved!');
    }
  }, [activeProjectId, isEditing, editorRef, getCleanHtml, saveToProject]);

  // --- UNDO / REDO ---
  const applyHistoryIndex = useCallback((newIndex: number, historySnap: string[]) => {
    const content = historySnap[newIndex];
    cancelPendingHistoryPush();
    isResettingRef.current = true;
    setGeneratedHtml(content);
    setHistoryIndex(newIndex);
    localStorage.setItem(STORAGE_KEY, content);
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
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
      if (e.key === 'e' && !e.shiftKey && generatedHtml) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        if (isEditing) { setIsEditing(false); saveToStorage(); } else { setIsEditing(true); }
      }
      // Escape closes confirm modal
      if (e.key === 'Escape') setShowClearConfirm(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, isEditing, generatedHtml, setIsEditing, saveToStorage]);

  // Every generation → create new project entry
  const prevStatusRef = React.useRef(status);
  useEffect(() => {
    const wasGenerating = prevStatusRef.current !== GenerationStatus.IDLE;
    const isNowIdle = status === GenerationStatus.IDLE;
    prevStatusRef.current = status;
    if (!wasGenerating || !isNowIdle) return;
    const html = generatedHtmlRef.current;
    if (!html) return;
    const name = extractProjectName(html);
    createProject(name, html).then(proj => {
      if (proj) { setActiveProjectId(proj.id); setLastSavedAt(new Date()); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Debounced auto-save every 3s
  const projectSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeProjectId || !generatedHtml || isResettingRef.current) return;
    if (projectSaveTimerRef.current) clearTimeout(projectSaveTimerRef.current);
    projectSaveTimerRef.current = setTimeout(() => {
      const html = generatedHtmlRef.current;
      if (activeProjectId && html) saveToProject(activeProjectId, html);
    }, 3000);
    return () => { if (projectSaveTimerRef.current) clearTimeout(projectSaveTimerRef.current); };
  }, [generatedHtml, activeProjectId, saveToProject]);

  // --- CLEAR CANVAS ---
  const onClearCanvas = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    handleClearCanvas(activeEditIdRef, selectionRangeRef);
    setShowClearConfirm(false);
  };

  // Auto-save before generating
  const handleGenerateWithAutoSave = useCallback(async (e: React.FormEvent) => {
    if (activeProjectId && generatedHtml) {
      const html = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
      if (html) await saveToProject(activeProjectId, html);
    }
    handleGenerate(e);
  }, [activeProjectId, generatedHtml, isEditing, editorRef, getCleanHtml, saveToProject, handleGenerate]);

  const handleGenerateTableWithAutoSave = useCallback(async (e: React.MouseEvent) => {
    if (activeProjectId && generatedHtml) {
      const html = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
      if (html) await saveToProject(activeProjectId, html);
    }
    handleGenerateTable(e);
  }, [activeProjectId, generatedHtml, isEditing, editorRef, getCleanHtml, saveToProject, handleGenerateTable]);

  // --- PDF EXPORT ---
  const handleExportPDF = () => {
    if (!generatedHtml) {
      toast.info('Nothing to export yet. Generate some content first.');
      return;
    }
    let content = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
    const temp = document.createElement('div');
    temp.innerHTML = content;
    temp.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
    content = temp.innerHTML;
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-ups are blocked. Please allow pop-ups for this site to export PDF.');
      return;
    }
    win.document.open();
    win.document.write(buildPrintHtml(content, fontSize, lineHeight));
    win.document.close();
  };

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
  if (authError) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 ${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Sign-in Failed</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{authError}</p>
          <Button onClick={() => window.location.reload()} className="w-full py-3" variant="primary">Retry</Button>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 ${isDarkMode ? 'dark' : ''}`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Signing in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden dot-pattern ${isDarkMode ? 'dark' : ''}`}>
      <style>{`@media print { @page { size: A4 portrait; margin: 5mm; } }`}</style>

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mode={mode} setMode={setMode}
        outputStyle={outputStyle} setOutputStyle={setOutputStyle}
        upscAnswerStyle={upscAnswerStyle} setUpscAnswerStyle={setUpscAnswerStyle}
        upscSubject={upscSubject} setUpscSubject={setUpscSubject}
        wordLimit={wordLimit} setWordLimit={setWordLimit}
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
        onePagerTopicInput={onePagerTopicInput}
        setOnePagerTopicInput={setOnePagerTopicInput}
        onePagerTopics={onePagerTopics}
        onePagerLoading={onePagerLoading}
        handleAddOnePager={handleAddOnePager}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        <LoadingOverlay status={status} />
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
          openSelectionRewriteModal={openSelectionRewriteModal}
          saveToStorage={saveToStorage}
          handleExportPDF={handleExportPDF}
          handleAddTableOfContents={handleAddTableOfContents}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(d => !d)}
        />

        <div className="flex-1 overflow-auto pt-14 sm:pt-16 md:pt-20 lg:pt-20 pb-12 px-2 sm:px-4 md:px-6 lg:px-10 xl:px-16 relative scrollbar-thin scrollbar-track-transparent">
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
            outputStyle={outputStyle}
            upscAnswerStyle={upscAnswerStyle}
            upscSubject={upscSubject}
            wordLimit={wordLimit}
            handleNextUPSCQuestion={handleNextUPSCQuestion}
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
    </div>
  );
};

export default App;
