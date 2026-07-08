import React from 'react';
import { GenerationStatus } from '../types';
import { ProjectsPanel } from './ProjectsPanel';
import type { ProjectMeta } from '../hooks/useProjects';
import type { UPSCAnswerStyle, UPSCSubject, DetailLevel } from '../services/ai/index';
import {
  SidebarHeader,
  SidebarModeTabs,
  SidebarInputSection,
  SidebarOutputStyleSelector,
  SidebarUPSCSettings,
  SidebarLanguageModel,
  SidebarDetailLevel,
  SidebarPdfTools,
  SidebarOnePager,
  SidebarFooter,
} from './sidebar/index';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mode: 'topic' | 'text' | 'file' | 'transcript';
  setMode: (mode: 'topic' | 'text' | 'file' | 'transcript') => void;
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  setOutputStyle: (style: 'notes' | 'upsc' | 'research' | 'table') => void;
  upscAnswerStyle: UPSCAnswerStyle;
  setUpscAnswerStyle: (s: UPSCAnswerStyle) => void;
  upscSubject: UPSCSubject;
  setUpscSubject: (s: UPSCSubject) => void;
  tableInstruction: string;
  setTableInstruction: (v: string) => void;
  wordLimit: number;
  setWordLimit: (limit: number) => void;
  detailLevel: DetailLevel;
  setDetailLevel: (level: DetailLevel) => void;
  groundingEnabled: boolean;
  setGroundingEnabled: (v: boolean) => void;
  notesProgress: { current: number; total: number; label: string } | null;
  topicInput: string;
  setTopicInput: (input: string) => void;
  textInput: string;
  setTextInput: (input: string) => void;
  files: { name: string; mimeType: string; data: string }[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  language: string;
  setLanguage: (lang: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  handleGenerate: (e: React.FormEvent) => void;
  handleGenerateTable: (e: React.MouseEvent) => void;
  status: GenerationStatus;
  handleClearCanvas: () => void;
  handleUndo: () => void;
  canUndo: boolean;
  projects: ProjectMeta[];
  projectsLoading: boolean;
  projectsError: string | null;
  activeProjectId: string | null;
  isSupabaseConfigured: boolean;
  lastSavedAt: Date | null;
  onFetchProjects: () => void;
  onSync: () => void;
  onSaveNow: () => void;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  hasContent: boolean;
  translatePdfFile: { name: string; mimeType: string; data: string } | null;
  handleTranslatePdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTranslatePdf: () => void;
  handleResumePdf: () => void;
  setTranslatePdfFile: (f: null) => void;
  translateProgress: { current: number; total: number; secondsLeft?: number } | null;
  translateResumeState: { pdfName: string; startPage: number; total: number } | null;
  setTranslateResumeState: (s: null) => void;
  answerPdfFile: { name: string; mimeType: string; data: string } | null;
  setAnswerPdfFile: (f: null) => void;
  handleAnswerPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAnalyzeAnswer: () => void;
  answerAnalyzing: boolean;
  onePagerTopicInput: string;
  setOnePagerTopicInput: (v: string) => void;
  onePagerTopics: string[];
  onePagerLoading: boolean;
  handleAddOnePager: () => void;
  transcriptInput: string;
  setTranscriptInput: (v: string) => void;
  handleTranscriptFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerateTranscript: () => void;
  handleRestructureDraft: () => void;
  isRestructuringDraft: boolean;
  draftBackup: string | null;
  handleUndoRestructureDraft: () => void;
  transcriptProgress: { current: number; total: number; step: 'fetch' | 'restructure' | 'structure' | 'detail'; note?: string } | null;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen, setSidebarOpen,
  mode, setMode,
  outputStyle, setOutputStyle,
  upscAnswerStyle, setUpscAnswerStyle,
  upscSubject, setUpscSubject,
  tableInstruction, setTableInstruction,
  wordLimit, setWordLimit,
  detailLevel, setDetailLevel,
  groundingEnabled, setGroundingEnabled,
  notesProgress,
  topicInput, setTopicInput,
  textInput, setTextInput,
  files, handleFileUpload, removeFile,
  language, setLanguage,
  aiModel, setAiModel,
  handleGenerate, handleGenerateTable,
  status, handleClearCanvas, handleUndo, canUndo,
  projects, projectsLoading, projectsError, activeProjectId, isSupabaseConfigured,
  lastSavedAt, onFetchProjects, onSync, onSaveNow, onSelectProject, onCreateProject, onDeleteProject,
  onRenameProject, hasContent,
  translatePdfFile, handleTranslatePdfUpload, handleTranslatePdf, handleResumePdf,
  setTranslatePdfFile, translateProgress, translateResumeState, setTranslateResumeState,
  answerPdfFile, setAnswerPdfFile, handleAnswerPdfUpload, handleAnalyzeAnswer, answerAnalyzing,
  onePagerTopicInput, setOnePagerTopicInput, onePagerTopics, onePagerLoading, handleAddOnePager,
  transcriptInput, setTranscriptInput, handleTranscriptFileUpload, handleGenerateTranscript, transcriptProgress,
  handleRestructureDraft, isRestructuringDraft, draftBackup, handleUndoRestructureDraft,
  youtubeUrl, setYoutubeUrl,
}) => {
  const isGenerating = status !== GenerationStatus.IDLE;

  const handleMainClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (mode === 'transcript') { e.preventDefault(); handleGenerateTranscript(); return; }
    if (outputStyle === 'table') { handleGenerateTable(e); return; }
    e.preventDefault();
    handleGenerate(e as unknown as React.FormEvent);
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        // When closed on mobile, -translate-x-[105%] pushes the panel
        // entirely off-screen (plus a tiny gap) so the right-edge border
        // doesn't slip back into the viewport as a 1px vertical strip.
        // The border itself is hidden on mobile (lg:border-r only) for
        // belt-and-suspenders.
        // Width is applied CONDITIONALLY per state — never emit two
        // competing `lg:w-*` utilities at once. Previously the base class
        // always carried `lg:w-[360px]` while the closed state added
        // `lg:w-0`; Tailwind kept the 360px rule, so on desktop the panel
        // refused to collapse. Now the open branch owns the desktop width
        // and the closed branch owns the zero-width collapse.
        className={`
          fixed lg:relative z-50
          w-[88vw] max-w-[340px] sm:max-w-[360px]
          flex flex-col
          transition-all duration-300 ease-in-out overflow-hidden
          lg:border-r lg:border-white/5
          ${sidebarOpen
            ? 'translate-x-0 lg:w-[360px] xl:w-[380px]'
            : '-translate-x-[105%] lg:translate-x-0 lg:w-0 lg:max-w-0 lg:border-r-0'}
        `}
        style={{
          background: '#0b1120',
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        aria-hidden={!sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024}
      >
        <SidebarHeader />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <SidebarModeTabs mode={mode} setMode={setMode} />

          <SidebarInputSection
            mode={mode}
            outputStyle={outputStyle}
            topicInput={topicInput}
            setTopicInput={setTopicInput}
            textInput={textInput}
            setTextInput={setTextInput}
            tableInstruction={tableInstruction}
            setTableInstruction={setTableInstruction}
            files={files}
            handleFileUpload={handleFileUpload}
            removeFile={removeFile}
            handleGenerate={handleGenerate}
            transcriptInput={transcriptInput}
            setTranscriptInput={setTranscriptInput}
            handleTranscriptFileUpload={handleTranscriptFileUpload}
            transcriptProgress={transcriptProgress}
            handleRestructureDraft={handleRestructureDraft}
            isRestructuringDraft={isRestructuringDraft}
            draftBackup={draftBackup}
            handleUndoRestructureDraft={handleUndoRestructureDraft}
            isGenerating={isGenerating}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
          />

          {notesProgress && (
            <div className="space-y-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/6 px-3 py-2.5">
              <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(6, Math.round((notesProgress.current / Math.max(1, notesProgress.total)) * 100))}%`,
                    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                  }}
                />
              </div>
              <p className="text-[10px] text-indigo-300/90 leading-snug truncate">{notesProgress.label}</p>
            </div>
          )}

          {mode !== 'transcript' && (
            <SidebarOutputStyleSelector outputStyle={outputStyle} setOutputStyle={setOutputStyle} />
          )}

          {mode !== 'transcript' && outputStyle === 'upsc' && (
            <SidebarUPSCSettings
              wordLimit={wordLimit}
              setWordLimit={setWordLimit}
              upscAnswerStyle={upscAnswerStyle}
              setUpscAnswerStyle={setUpscAnswerStyle}
              upscSubject={upscSubject}
              setUpscSubject={setUpscSubject}
            />
          )}

          {(mode === 'transcript' || outputStyle === 'notes') && (
            <SidebarDetailLevel
              detailLevel={detailLevel} setDetailLevel={setDetailLevel} mode={mode}
              groundingEnabled={groundingEnabled} setGroundingEnabled={setGroundingEnabled}
            />
          )}

          <SidebarLanguageModel
            language={language}
            setLanguage={setLanguage}
            aiModel={aiModel}
            setAiModel={setAiModel}
          />

          <SidebarPdfTools
            isGenerating={isGenerating}
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
          />

          <SidebarOnePager
            onePagerTopicInput={onePagerTopicInput}
            setOnePagerTopicInput={setOnePagerTopicInput}
            onePagerTopics={onePagerTopics}
            onePagerLoading={onePagerLoading}
            handleAddOnePager={handleAddOnePager}
          />

          <ProjectsPanel
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            activeProjectId={activeProjectId}
            isSupabaseConfigured={isSupabaseConfigured}
            lastSavedAt={lastSavedAt}
            onOpen={onFetchProjects}
            onSync={onSync}
            onSaveNow={onSaveNow}
            onSelectProject={onSelectProject}
            onCreateProject={onCreateProject}
            onDeleteProject={onDeleteProject}
            onRenameProject={onRenameProject}
            hasContent={hasContent}
          />
        </div>

        <SidebarFooter
          outputStyle={outputStyle}
          mode={mode}
          isGenerating={isGenerating || isRestructuringDraft}
          canUndo={canUndo}
          handleMainClick={handleMainClick}
          handleClearCanvas={handleClearCanvas}
          handleUndo={handleUndo}
        />
      </aside>
    </>
  );
};
