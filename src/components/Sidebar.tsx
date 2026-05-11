import React from 'react';
import { GenerationStatus } from '../types';
import { ProjectsPanel } from './ProjectsPanel';
import type { ProjectMeta } from '../hooks/useProjects';
import type { UPSCAnswerStyle } from '../services/ai/index';
import {
  SidebarHeader,
  SidebarModeTabs,
  SidebarInputSection,
  SidebarOutputStyleSelector,
  SidebarUPSCSettings,
  SidebarLanguageModel,
  SidebarPdfTools,
  SidebarOnePager,
  SidebarFooter,
} from './sidebar/index';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mode: 'topic' | 'text' | 'file';
  setMode: (mode: 'topic' | 'text' | 'file') => void;
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  setOutputStyle: (style: 'notes' | 'upsc' | 'research' | 'table') => void;
  upscAnswerStyle: UPSCAnswerStyle;
  setUpscAnswerStyle: (s: UPSCAnswerStyle) => void;
  tableInstruction: string;
  setTableInstruction: (v: string) => void;
  wordLimit: number;
  setWordLimit: (limit: number) => void;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen, setSidebarOpen,
  mode, setMode,
  outputStyle, setOutputStyle,
  upscAnswerStyle, setUpscAnswerStyle,
  tableInstruction, setTableInstruction,
  wordLimit, setWordLimit,
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
}) => {
  const isGenerating = status !== GenerationStatus.IDLE;

  const handleMainClick = (e: React.MouseEvent<HTMLButtonElement>) => {
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
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0'}
          fixed lg:relative z-50
          w-[88vw] max-w-[340px] sm:max-w-[360px] lg:w-[360px] xl:w-[380px]
          flex flex-col
          transition-all duration-300 ease-in-out overflow-hidden
          border-r border-white/5
        `}
        style={{
          background: '#0b1120',
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <SidebarHeader setSidebarOpen={setSidebarOpen} />

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
          />

          <SidebarOutputStyleSelector outputStyle={outputStyle} setOutputStyle={setOutputStyle} />

          {outputStyle === 'upsc' && (
            <SidebarUPSCSettings
              wordLimit={wordLimit}
              setWordLimit={setWordLimit}
              upscAnswerStyle={upscAnswerStyle}
              setUpscAnswerStyle={setUpscAnswerStyle}
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
          isGenerating={isGenerating}
          canUndo={canUndo}
          handleMainClick={handleMainClick}
          handleClearCanvas={handleClearCanvas}
          handleUndo={handleUndo}
        />
      </aside>
    </>
  );
};
