import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { RewriteModal } from './components/RewriteModal';
import { Button } from './components/Button';
import { GenerationStatus } from './types';
import { useHistory } from './hooks/useHistory';
import { useEditorContent } from './hooks/useEditorContent';
import { useGeneration } from './hooks/useGeneration';
import { useAIEdit } from './hooks/useAIEdit';
import { useProjects } from './hooks/useProjects';
import { STORAGE_KEY, buildPrintHtml } from './utils/editorUtils';
import { BookOpen, RefreshCw, Sparkles, Download, Settings } from 'lucide-react';

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
  // --- API KEY ---
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        if (window.aistudio?.hasSelectedApiKey) {
          // @ts-ignore
          setHasApiKey(await window.aistudio.hasSelectedApiKey());
        } else {
          setHasApiKey(true);
        }
      } catch {
        setHasApiKey(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    })();
  }, []);

  const handleSelectApiKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio?.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch {
      setHasApiKey(false);
    }
  };

  // --- UI STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('ai_book_writer_dark') === 'true'
  );

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
    fontSize,
    editorRef, isResettingRef,
    getCurrentHtml, getCleanHtml, saveToStorage,
    cancelPendingHistoryPush,
    handleEditorInput, handleEditorBlur, handleEditorKeyDown,
    handleZoomIn, handleZoomOut,
  } = useEditorContent({ pushToHistory });

  const {
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
    handleFileUpload, removeFile,
    handleGenerate, handleGenerateTable,
    handleClearCanvas,
  } = useGeneration({ pushToHistory, isResettingRef, setGeneratedHtml, resetHistory, setIsEditing, setSidebarOpen });

  const {
    rewriteModalOpen, closeRewriteModal,
    isExtendTableOpen, extendHeadersPreview,
    rewriteInstruction, setRewriteInstruction,
    isRewriting,
    activeSectionHtml,
    rewriteType,
    editTab, setEditTab,
    rewriteModel, setRewriteModel,
    selectionRangeRef,
    activeEditIdRef,
    openSelectionRewriteModal,
    handleRewriteSubmit,
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
    isSupabaseConfigured,
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

  // Always track latest generatedHtml in a ref — avoids stale closure in async effects
  const generatedHtmlRef = React.useRef<string | null>(generatedHtml);
  useEffect(() => { generatedHtmlRef.current = generatedHtml; }, [generatedHtml]);

  const handleCreateProject = async () => {
    const content = isEditing && editorRef.current ? getCleanHtml() : (generatedHtml || '');
    if (!content) return;
    const name = extractProjectName(content);
    const proj = await createProject(name, content);
    if (proj) { setActiveProjectId(proj.id); setLastSavedAt(new Date()); }
  };

  const saveToProject = useCallback(async (id: string, html: string) => {
    const ok = await saveProject(id, html);
    if (ok) setLastSavedAt(new Date());
  }, [saveProject]);

  // Manual "Save now" — saves current editor content to active project
  const handleSaveNow = useCallback(async () => {
    if (!activeProjectId) return;
    const html = isEditing && editorRef.current ? getCleanHtml() : (generatedHtmlRef.current || '');
    if (html) await saveToProject(activeProjectId, html);
  }, [activeProjectId, isEditing, editorRef, getCleanHtml, saveToProject]);

  // --- UNDO / REDO ---
  const applyHistoryIndex = useCallback((newIndex: number, historySnap: string[]) => {
    const content = historySnap[newIndex];
    cancelPendingHistoryPush();
    isResettingRef.current = true;
    setGeneratedHtml(content);
    setHistoryIndex(newIndex);
    localStorage.setItem(STORAGE_KEY, content);
    // Force sync DOM immediately for editing mode
    if (editorRef.current) editorRef.current.innerHTML = content;
    setTimeout(() => { isResettingRef.current = false; }, 150);
  }, [cancelPendingHistoryPush, setGeneratedHtml, setHistoryIndex, editorRef, isResettingRef]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) applyHistoryIndex(historyIndex - 1, history);
  }, [historyIndex, history, applyHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) applyHistoryIndex(historyIndex + 1, history);
  }, [historyIndex, history, applyHistoryIndex]);

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Every generation → always create a BRAND NEW project entry in history
  const prevStatusRef = React.useRef(status);
  useEffect(() => {
    const wasGenerating = prevStatusRef.current !== GenerationStatus.IDLE;
    const isNowIdle = status === GenerationStatus.IDLE;
    prevStatusRef.current = status;
    if (!wasGenerating || !isNowIdle) return;
    // Use ref so we always read the latest value, never stale
    const html = generatedHtmlRef.current;
    if (!html) return;
    const name = extractProjectName(html);
    createProject(name, html).then(proj => {
      if (proj) { setActiveProjectId(proj.id); setLastSavedAt(new Date()); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Debounced auto-save to active project while editing (every 3s)
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
    handleClearCanvas(activeEditIdRef, selectionRangeRef);
  };

  // --- PDF EXPORT ---
  const handleExportPDF = () => {
    if (!generatedHtml) return;
    let content = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
    const temp = document.createElement('div');
    temp.innerHTML = content;
    temp.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
    content = temp.innerHTML;
    const win = window.open('', '_blank');
    if (!win) { alert('Enable pop-ups.'); return; }
    win.document.open();
    win.document.write(buildPrintHtml(content, fontSize));
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
      return;
    }
    const headings = temp.querySelectorAll('h1, h2, h3, h4');
    if (!headings.length) { alert('No headings found to generate a Table of Contents.'); return; }
    const items: { text: string; id: string; level: number }[] = [];
    headings.forEach((h, i) => {
      if (!h.id) h.id = `heading-${i}`;
      items.push({ text: h.textContent || '', id: h.id, level: parseInt(h.tagName[1]) });
    });
    const tocHtml = `<div class="table-of-contents"><h2>Index</h2><nav><ul>
      ${items.map(item => `<li style="padding-left:${(item.level - 1) * 16}px;">
        <a href="#${item.id}"><span class="toc-title">${item.text}</span><span class="toc-dots"></span><span class="toc-link-icon">→</span></a>
      </li>`).join('')}
    </ul></nav></div>`;
    const html = tocHtml + temp.innerHTML;
    setGeneratedHtml(html);
    pushToHistory(html);
    saveToStorage();
  };

  // --- RENDER ---
  if (isCheckingApiKey) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 ${isDarkMode ? 'dark' : ''}`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 ${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">API Key Required</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            This application uses Gemini AI which requires a Google Cloud API key.
            <br /><br />
            Please select your API key to continue.{' '}
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">Learn about billing</a>.
          </p>
          <Button onClick={handleSelectApiKey} className="w-full py-3 text-lg shadow-md hover:shadow-lg transition-all" variant="primary">
            Select API Key
          </Button>
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
        wordLimit={wordLimit} setWordLimit={setWordLimit}
        topicInput={topicInput} setTopicInput={setTopicInput}
        textInput={textInput} setTextInput={setTextInput}
        files={files}
        handleFileUpload={handleFileUpload}
        removeFile={removeFile}
        language={language} setLanguage={setLanguage}
        aiModel={aiModel} setAiModel={setAiModel}
        tableInstruction={tableInstruction} setTableInstruction={setTableInstruction}
        handleGenerate={handleGenerate}
        handleGenerateTable={handleGenerateTable}
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
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        <Toolbar
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          handleUndo={handleUndo} handleRedo={handleRedo}
          canUndo={canUndo} canRedo={canRedo}
          fontSize={fontSize}
          handleZoomOut={handleZoomOut} handleZoomIn={handleZoomIn}
          isEditing={isEditing} setIsEditing={setIsEditing}
          openSelectionRewriteModal={openSelectionRewriteModal}
          saveToStorage={saveToStorage}
          handleExportPDF={handleExportPDF}
          handleAddTableOfContents={handleAddTableOfContents}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(d => !d)}
        />

        <div className="flex-1 overflow-auto pt-16 sm:pt-20 md:pt-28 pb-12 px-2 sm:px-4 md:px-8 relative scrollbar-thin scrollbar-track-transparent">
          {status !== GenerationStatus.IDLE && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 dark:border-slate-700">
                <div className="w-16 h-16 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Creating Content</h3>
                <p className="text-slate-500 dark:text-slate-400 animate-pulse">Analyzing topic • Structuring • Writing...</p>
              </div>
            </div>
          )}

          <div className="w-full mx-auto">
            <div className={`editor-container page-container size-a4 editor-content bg-white dark:bg-slate-900 transition-all duration-300 rounded-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-1 ring-slate-200/50 dark:ring-slate-700/50 ${isEditing ? 'ring-4 ring-blue-500/20 dark:ring-blue-500/40 shadow-blue-500/10' : ''}`}
              style={{ fontSize: `${fontSize}pt` }}>
              {!generatedHtml && status === GenerationStatus.IDLE ? (
                <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50" style={{ minHeight: '250mm' }}>
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white dark:bg-slate-800 rounded-2xl shadow-xl ring-1 ring-slate-100 dark:ring-slate-700 flex items-center justify-center mb-6 sm:mb-8 hover:scale-105 transition-transform duration-500 rotate-3">
                    <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400 -rotate-3" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 sm:mb-4 tracking-tight">Your Empty Canvas</h2>
                  <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md mb-6 sm:mb-8 leading-relaxed px-4">
                    Use the sidebar to generate a comprehensive study guide, or paste your rough notes to format them instantly.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-md opacity-80 px-4">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center hover:-translate-y-1 transition-transform">
                      <Sparkles className="w-6 h-6 text-amber-400 mb-2" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Powered</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center hover:-translate-y-1 transition-transform">
                      <Download className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mb-2" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">PDF Ready</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`min-h-[267mm] outline-none ${isEditing ? 'cursor-text' : ''}`}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  ref={editorRef}
                  onInput={handleEditorInput}
                  onBlur={handleEditorBlur}
                  onKeyDown={handleEditorKeyDown}
                />
              )}
            </div>
            <div className="h-12 flex items-center justify-center mt-4 opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">End of Document</span>
            </div>
          </div>
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
        selectionText={rewriteType === 'section' ? 'Selected Section Context...' : ((selectionRangeRef.current?.toString().substring(0, 150) ?? '') + '...')}
      />
    </div>
  );
};

export default App;
