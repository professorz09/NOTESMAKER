import React from 'react';
import {
  BookOpen,
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
  ChevronRight,
  Type,
} from 'lucide-react';
import { Button } from './Button';
import { GenerationStatus } from '../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mode: 'topic' | 'text' | 'file';
  setMode: (mode: 'topic' | 'text' | 'file') => void;
  outputStyle: 'notes' | 'upsc' | 'research';
  setOutputStyle: (style: 'notes' | 'upsc' | 'research') => void;
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
  handleGenerateDetailedTable: (e: React.MouseEvent) => void;
  status: GenerationStatus;
  handleClearCanvas: () => void;
  handleUndo: () => void;
  canUndo: boolean;
}

const MODELS = [
  { id: 'gemini-2.5-pro-preview-05-06', label: 'Pro 2.5', badge: 'Smart' },
  { id: 'gemini-2.5-flash-preview-04-17', label: 'Flash 2.5', badge: 'Fast' },
];

const OUTPUT_STYLES = [
  { id: 'notes', label: 'Detailed Notes', icon: AlignLeft, desc: 'Structured study notes' },
  { id: 'upsc', label: 'UPSC Mains', icon: GraduationCap, desc: 'Exam-ready answers' },
  { id: 'research', label: 'Research Paper', icon: FlaskConical, desc: 'Academic format' },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen, setSidebarOpen,
  mode, setMode,
  outputStyle, setOutputStyle,
  wordLimit, setWordLimit,
  topicInput, setTopicInput,
  textInput, setTextInput,
  files, handleFileUpload, removeFile,
  language, setLanguage,
  aiModel, setAiModel,
  handleGenerate, handleGenerateTable, handleGenerateDetailedTable,
  status, handleClearCanvas, handleUndo, canUndo,
}) => {
  const isGenerating = status !== GenerationStatus.IDLE;

  const generateLabel = () => {
    if (status === GenerationStatus.GENERATING_CHAPTER) return 'Generating...';
    if (outputStyle === 'upsc') return 'Generate UPSC Answer';
    if (outputStyle === 'research') return 'Generate Research Paper';
    if (mode === 'text') return 'Format My Notes';
    if (mode === 'file') return 'Analyze Files';
    return 'Generate Notes';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
          fixed md:relative z-50 h-full transition-all duration-300 ease-in-out overflow-hidden
          w-full sm:w-[380px] flex flex-col`}
        style={{ background: 'linear-gradient(180deg, #0a0f1e 0%, #0d1424 60%, #0a0f1e 100%)' }}
      >
        <div className="w-full sm:w-[380px] flex flex-col h-full">

          {/* ── HEADER ── */}
          <div className="relative px-5 py-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
            {/* subtle glow behind logo */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600/20 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3 relative">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0f1e] animate-pulse" />
              </div>
              <div>
                <h1 className="text-[15px] font-extrabold tracking-tight text-white leading-none">Professor UPSC</h1>
                <p className="text-[10px] font-semibold tracking-widest text-blue-400/80 uppercase mt-0.5">AI Book Writer</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="relative z-10 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
            >
              <PanelLeftClose className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

            {/* MODE SELECTOR */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/4 border border-white/6">
              {([
                { id: 'topic', icon: Sparkles, label: 'Topic' },
                { id: 'text', icon: FileText, label: 'Text' },
                { id: 'file', icon: Upload, label: 'File' },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
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

            {/* INPUT AREA */}
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
                      placeholder="Discuss the impact of climate change on Indian agriculture and economy..."
                      rows={4}
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
                    />
                  ) : (
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="e.g. History of Mughal Empire..."
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/6 transition-all"
                    />
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
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.txt,image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
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
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                            >
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

            {/* OUTPUT STYLE */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">Output Style</label>
              <div className="space-y-1.5">
                {OUTPUT_STYLES.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOutputStyle(id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-200 text-left ${
                      outputStyle === id
                        ? 'bg-blue-600/15 border-blue-500/40 text-white'
                        : 'bg-white/3 border-white/6 text-slate-400 hover:bg-white/6 hover:text-slate-200 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${outputStyle === id ? 'bg-blue-600/30' : 'bg-white/6'}`}>
                      <Icon className={`w-4 h-4 ${outputStyle === id ? 'text-blue-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-none mb-1 ${outputStyle === id ? 'text-white' : 'text-slate-300'}`}>{label}</p>
                      <p className="text-[11px] text-slate-600 leading-none">{desc}</p>
                    </div>
                    {outputStyle === id && <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* WORD LIMIT (UPSC only) */}
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

            {/* LANGUAGE + MODEL in 2-col grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Language */}
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

              {/* AI Model */}
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

          </div>

          {/* ── STICKY FOOTER ACTIONS ── */}
          <div className="flex-shrink-0 px-4 pt-4 pb-5 space-y-3 border-t border-white/5 bg-gradient-to-t from-[#0a0f1e] to-transparent">

            {/* Primary generate button */}
            <button
              form="main-form"
              type="submit"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' }}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {status === GenerationStatus.GENERATING_CHAPTER ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4.5 h-4.5 relative z-10" />
                  <span className="relative z-10">{generateLabel()}</span>
                </>
              )}
            </button>

            {/* Table buttons (topic + notes mode only) */}
            {mode === 'topic' && outputStyle === 'notes' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGenerateTable}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-blue-400 hover:border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {status === GenerationStatus.GENERATING_TABLE ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-400/40 border-t-slate-400 rounded-full animate-spin" />
                  ) : (
                    <TableIcon className="w-3.5 h-3.5" />
                  )}
                  Compare Table
                </button>
                <button
                  type="button"
                  onClick={handleGenerateDetailedTable}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-blue-400 hover:border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {status === GenerationStatus.GENERATING_DETAILED_TABLE ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-400/40 border-t-slate-400 rounded-full animate-spin" />
                  ) : (
                    <TableIcon className="w-3.5 h-3.5" />
                  )}
                  Detailed Table
                </button>
              </div>
            )}

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
                disabled={!canUndo}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-500 bg-white/4 border border-white/6 hover:bg-white/8 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Undo className="w-3.5 h-3.5" />
                Undo
              </button>
            </div>

            <p className="text-center text-[9px] font-bold tracking-[0.2em] text-slate-700 uppercase pt-1">AI Powered • v2.1 Pro</p>
          </div>

        </div>
      </aside>
    </>
  );
};
