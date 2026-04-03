import React from 'react';
import {
  Sparkles,
  FileText,
  Upload,
  PanelLeftClose,
  Table as TableIcon,
  Eraser,
  Undo,
  GraduationCap,
  X,
  Globe,
  Cpu,
  AlignLeft,
  Zap,
  FlaskConical,
  Type,
  BarChart2,
  Languages,
  NotebookPen,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { GenerationStatus } from '../types';
import { ProjectsPanel } from './ProjectsPanel';
import type { ProjectMeta } from '../hooks/useProjects';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mode: 'topic' | 'text' | 'file';
  setMode: (mode: 'topic' | 'text' | 'file') => void;
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  setOutputStyle: (style: 'notes' | 'upsc' | 'research' | 'table') => void;
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
  // One Pager
  onePagerTopicInput: string;
  setOnePagerTopicInput: (v: string) => void;
  onePagerTopics: string[];
  onePagerLoading: boolean;
  handleAddOnePager: () => void;
}

const MODELS = [
  { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1', badge: 'Smart' },
  { id: 'gemini-3-flash-preview', label: 'Flash 3', badge: 'Fast' },
];

const OUTPUT_STYLES = [
  { id: 'notes',    label: 'Notes',    icon: AlignLeft,     desc: 'Study notes' },
  { id: 'upsc',     label: 'UPSC',     icon: GraduationCap, desc: 'Exam answers' },
  { id: 'research', label: 'Research', icon: FlaskConical,  desc: 'Academic paper' },
  { id: 'table',    label: 'Table',    icon: BarChart2,     desc: 'AI table' },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen, setSidebarOpen,
  mode, setMode,
  outputStyle, setOutputStyle,
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
  const isTableStyle = outputStyle === 'table';

  const generateLabel = () => {
    if (isGenerating) return 'Generating...';
    if (outputStyle === 'table') return 'Generate Table';
    if (outputStyle === 'upsc') return 'Generate UPSC Answer';
    if (outputStyle === 'research') return 'Generate Research Paper';
    if (mode === 'text') return 'Format My Notes';
    if (mode === 'file') return 'Analyze Files';
    return 'Generate Notes';
  };

  const handleMainClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (outputStyle === 'table') { handleGenerateTable(e); return; }
    handleGenerate(e as any);
  };

  return (
    <>
      {/* Backdrop — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
        }}
      >
        {/* ── HEADER / LOGO ── */}
        <div className="flex-shrink-0 px-4 py-3.5 flex items-center justify-between border-b border-white/6">
          <div className="flex items-center gap-3">

            {/* Logo mark */}
            <div className="relative flex-shrink-0">
              <div
                className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #6d28d9 100%)',
                  boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 4px 16px rgba(29,78,216,0.5)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  {/* Open book — left page */}
                  <path d="M13 7 C10 6 7 6.5 5 7.5 L5 20 C7 19 10 18.5 13 19.5 Z" fill="white" opacity="0.55"/>
                  {/* Open book — right page */}
                  <path d="M13 7 C16 6 19 6.5 21 7.5 L21 20 C19 19 16 18.5 13 19.5 Z" fill="white" opacity="0.75"/>
                  {/* Spine center line */}
                  <line x1="13" y1="7" x2="13" y2="19.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
                  {/* Graduation cap flat top */}
                  <path d="M13 3.5 L4.5 7 L13 10.5 L21.5 7 Z" fill="white" opacity="0.9"/>
                  {/* Cap tassel dot */}
                  <circle cx="21.5" cy="7" r="1.3" fill="#a78bfa"/>
                  {/* AI sparkle */}
                  <path d="M20 2.5 L20.5 4 L22 4.5 L20.5 5 L20 6.5 L19.5 5 L18 4.5 L19.5 4 Z" fill="#c4b5fd" opacity="0.9"/>
                </svg>
              </div>
              {/* Live pulse dot */}
              <div className="absolute -bottom-[3px] -right-[3px] w-[10px] h-[10px] bg-emerald-400 rounded-full border-2 border-[#0b1120]">
                <div className="w-full h-full rounded-full bg-emerald-400 animate-ping opacity-60" />
              </div>
            </div>

            {/* Text */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <h1
                  className="text-[15px] font-black tracking-tight leading-none"
                  style={{ background: 'linear-gradient(90deg, #fff 0%, #c7d2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  Professor
                </h1>
                <span
                  className="text-[15px] font-black tracking-tight leading-none"
                  style={{ background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  UPSC
                </span>
              </div>
              <p className="text-[9.5px] font-semibold tracking-[0.18em] text-slate-500 uppercase mt-[3px] flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-blue-500/60 inline-block" />
                AI Book Writer
                <span className="w-1 h-1 rounded-full bg-violet-500/60 inline-block" />
              </p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          {/* MODE TABS */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
            {([
              { id: 'topic', icon: Sparkles, label: 'Topic' },
              { id: 'text',  icon: FileText,  label: 'Text'  },
              { id: 'file',  icon: Upload,    label: 'File'  },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  mode === id
                    ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* INPUT */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
              {mode === 'topic' ? 'Your Topic' : mode === 'text' ? 'Paste Raw Notes' : 'Upload Files'}
            </label>
            <form onSubmit={handleGenerate} id="main-form">
              {mode === 'topic' ? (
                outputStyle === 'upsc' ? (
                  <textarea
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="Discuss the impact of climate change on Indian agriculture..."
                    rows={4}
                    className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="e.g. History of Mughal Empire..."
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all"
                    />
                    {outputStyle === 'table' && (
                      <input
                        type="text"
                        value={tableInstruction}
                        onChange={(e) => setTableInstruction(e.target.value)}
                        placeholder="e.g. Compare Articles 12-35 of Indian Constitution..."
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/6 transition-all"
                      />
                    )}
                  </div>
                )
              ) : mode === 'text' ? (
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your rough notes or content here..."
                  rows={5}
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
                />
              ) : (
                <div className="space-y-3">
                  <label className="block relative cursor-pointer">
                    <input type="file" multiple accept=".pdf,.txt,image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center gap-3 py-8 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/4 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-300">Drop files or click to upload</p>
                        <p className="text-xs text-slate-600 mt-1">PDF, TXT, Images supported</p>
                      </div>
                    </div>
                  </label>
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/4 rounded-xl px-3 py-2.5 border border-white/6">
                          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="text-xs text-slate-300 truncate flex-1">{file.name}</span>
                          <button type="button" onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* OUTPUT STYLE — 2×2 grid */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">Output Style</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_STYLES.map(({ id, label, icon: Icon, desc }) => {
                const isActive = outputStyle === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOutputStyle(id)}
                    className={`flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl border transition-all duration-200 text-center ${
                      isActive
                        ? 'bg-slate-800 border-slate-600 shadow-lg'
                        : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-600/30' : 'bg-white/5'}`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold leading-none mb-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`}>{label}</p>
                      <p className={`text-[10px] leading-tight ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* WORD LIMIT — UPSC only */}
          {outputStyle === 'upsc' && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
                <Type className="w-3 h-3" /> Word Limit
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[150, 250, 500, 1000].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWordLimit(w)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      wordLimit === w
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                        : 'bg-white/4 border border-white/8 text-slate-400 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LANGUAGE + MODEL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
                <Globe className="w-3 h-3" /> Language
              </label>
              <div className="flex flex-col gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
                {['Hindi', 'English'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      language === lang
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
                <Cpu className="w-3 h-3" /> AI Model
              </label>
              <div className="flex flex-col gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAiModel(m.id)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      aiModel === m.id
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-900/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'
                    }`}
                  >
                    {m.id.includes('flash') ? <Zap className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PDF TOOLS */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-3 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">PDF Tools</p>
            <div className="grid grid-cols-2 gap-2">

              {/* PDF → Hindi */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-2.5 space-y-2 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                    <Languages className="w-3 h-3 text-orange-400" />
                  </div>
                  <p className="text-[10px] font-bold text-orange-300 leading-tight">PDF→Hindi</p>
                </div>
                {!translatePdfFile ? (
                  <label className="flex-1 relative cursor-pointer block">
                    <input type="file" accept=".pdf" onChange={handleTranslatePdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center gap-1 py-3 rounded-lg border border-dashed border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/8 transition-all h-full justify-center">
                      <Upload className="w-3.5 h-3.5 text-orange-400/70" />
                      <p className="text-[9px] text-slate-500 text-center leading-tight">PDF upload करें</p>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center gap-1 bg-white/4 rounded-lg px-2 py-1.5 border border-white/6 min-w-0">
                      <FileText className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-[9px] text-slate-300 truncate flex-1 min-w-0">{translatePdfFile.name}</span>
                      <button type="button" onClick={() => setTranslatePdfFile(null)} className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleTranslatePdf}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] flex-1"
                      style={{ background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)' }}
                    >
                      {isGenerating && translateProgress ? (
                        <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />{translateProgress.current}/{translateProgress.total}</>
                      ) : (
                        <><Languages className="w-3 h-3" />{translateResumeState?.pdfName === translatePdfFile?.name ? 'शुरू से' : 'अनुवाद'}</>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Answer Analysis */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 space-y-2 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-3 h-3 text-rose-400" />
                  </div>
                  <p className="text-[10px] font-bold text-rose-300 leading-tight">उत्तर विश्लेषण</p>
                </div>
                {!answerPdfFile ? (
                  <label className="flex-1 relative cursor-pointer block">
                    <input type="file" accept=".pdf" onChange={handleAnswerPdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isGenerating} />
                    <div className="flex flex-col items-center gap-1 py-3 rounded-lg border border-dashed border-rose-500/25 hover:border-rose-500/50 hover:bg-rose-500/8 transition-all h-full justify-center">
                      <Upload className="w-3.5 h-3.5 text-rose-400/70" />
                      <p className="text-[9px] text-slate-500 text-center leading-tight">उत्तर PDF<br/>upload करें</p>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center gap-1 bg-white/4 rounded-lg px-2 py-1.5 border border-white/6 min-w-0">
                      <FileText className="w-3 h-3 text-rose-400 flex-shrink-0" />
                      <span className="text-[9px] text-slate-300 truncate flex-1 min-w-0">{answerPdfFile.name}</span>
                      <button type="button" onClick={() => setAnswerPdfFile(null)} disabled={isGenerating} className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors disabled:opacity-40">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAnalyzeAnswer}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] flex-1"
                      style={{ background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)' }}
                    >
                      {answerAnalyzing ? (
                        <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />विश्लेषण...</>
                      ) : (
                        <><Sparkles className="w-3 h-3" />Analyse</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Resume state */}
            {translateResumeState && translateResumeState.pdfName === translatePdfFile?.name && !isGenerating && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 p-2.5 space-y-1.5">
                <p className="text-[10px] text-orange-300 text-center">
                  पृष्ठ {translateResumeState.startPage}/{translateResumeState.total} पर रुका है
                </p>
                <button type="button" onClick={handleResumePdf}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold text-white active:scale-[0.98] transition-all"
                  style={{ background: 'linear-gradient(135deg, #ea580c 0%, #b45309 100%)' }}>
                  <Languages className="w-3 h-3" />
                  पृष्ठ {translateResumeState.startPage} से जारी रखें
                </button>
                <button type="button" onClick={() => setTranslateResumeState(null)} className="w-full text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
                  नई शुरुआत करें
                </button>
              </div>
            )}

            {/* Progress bar */}
            {isGenerating && translateProgress && (
              <div className="space-y-1.5">
                <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((translateProgress.current / translateProgress.total) * 100)}%`, background: 'linear-gradient(90deg, #ea580c, #dc2626)' }} />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-slate-500">{Math.round((translateProgress.current / translateProgress.total) * 100)}% पूर्ण</p>
                  {translateProgress.secondsLeft != null && translateProgress.secondsLeft > 0 && (
                    <p className="text-[10px] text-orange-500/80">~{translateProgress.secondsLeft >= 60 ? `${Math.ceil(translateProgress.secondsLeft / 60)} मिनट` : `${translateProgress.secondsLeft}s`} बाकी</p>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* ── ONE PAGER NOTES ── */}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/4 p-3 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <NotebookPen className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex-1">One Pager Notes</p>
              {onePagerTopics.length > 0 && (
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  {onePagerTopics.length} topics
                </span>
              )}
            </div>

            <p className="text-[9.5px] text-slate-500 px-1 leading-relaxed">
              Topic ka naam likhein — compact 1-page notes generate hogi aur neeche append hogi
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={onePagerTopicInput}
                onChange={(e) => setOnePagerTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOnePager(); } }}
                placeholder="Topic name e.g. Mughal Empire"
                disabled={onePagerLoading}
                className="flex-1 min-w-0 bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/6 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddOnePager}
                disabled={onePagerLoading || !onePagerTopicInput.trim()}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                title="Add Topic"
              >
                {onePagerLoading
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Plus className="w-4 h-4 text-white" />
                }
              </button>
            </div>

            {onePagerTopics.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider px-1">Added Topics:</p>
                <div className="flex flex-wrap gap-1.5">
                  {onePagerTopics.map((t, i) => (
                    <div key={i} className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
                      <span className="text-[9.5px] text-indigo-200 font-medium leading-none truncate max-w-[120px]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PROJECTS PANEL */}
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

        {/* ── STICKY FOOTER ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-white/6 space-y-2 bg-[#0b1120]">

          {/* Generate button */}
          <button
            type="button"
            onClick={handleMainClick}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' }}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                {isTableStyle ? <TableIcon className="w-4 h-4 relative z-10" /> : <Sparkles className="w-4 h-4 relative z-10" />}
                <span className="relative z-10">{generateLabel()}</span>
              </>
            )}
          </button>

          {/* Clear + Undo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleClearCanvas}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-400/70 bg-red-500/6 border border-red-500/10 hover:bg-red-500/12 hover:text-red-300 hover:border-red-500/20 transition-all"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo || isGenerating}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400/70 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-slate-200 hover:border-white/14 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo className="w-3.5 h-3.5" />
              Undo
            </button>
          </div>

          <p className="text-center text-[9px] text-slate-700 font-medium tracking-wider uppercase">AI Powered • V2.1 Pro</p>
        </div>
      </aside>
    </>
  );
};
