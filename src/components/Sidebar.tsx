import React from 'react';
import { 
  BookOpen, 
  Sparkles,
  FileText,
  Upload,
  PanelLeftClose,
  Table as TableIcon,
  Download,
  Eraser,
  Undo,
  GraduationCap,
  X
} from 'lucide-react';
import { Button } from './Button';
import { GenerationStatus } from '../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mode: 'topic' | 'text' | 'file';
  setMode: (mode: 'topic' | 'text' | 'file') => void;
  outputStyle: 'notes' | 'upsc';
  setOutputStyle: (style: 'notes' | 'upsc') => void;
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

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  mode,
  setMode,
  outputStyle,
  setOutputStyle,
  wordLimit,
  setWordLimit,
  topicInput,
  setTopicInput,
  textInput,
  setTextInput,
  files,
  handleFileUpload,
  removeFile,
  language,
  setLanguage,
  aiModel,
  setAiModel,
  handleGenerate,
  handleGenerateTable,
  handleGenerateDetailedTable,
  status,
  handleClearCanvas,
  handleUndo,
  canUndo
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside 
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'} 
          fixed md:relative z-50 h-full bg-slate-950 text-white transition-all duration-300 ease-in-out flex flex-col border-r border-slate-800/60 shadow-2xl overflow-hidden w-full sm:w-[400px]`}
      >
        <div className="w-full sm:w-[400px] flex flex-col h-full min-w-[100%] sm:min-w-[400px]"> 
            <div className="p-4 sm:p-6 border-b border-slate-800/60 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/20 ring-1 ring-white/10">
                        <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Professor UPSC</h1>
                        <p className="text-[11px] text-blue-400 font-medium tracking-wide uppercase">AI Book Writer</p>
                    </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/50 rounded-xl transition-colors">
                    <PanelLeftClose className="w-5 h-5"/>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-slate-800">
                {/* TABS */}
                <div className="flex flex-wrap bg-slate-900/80 p-1 rounded-xl mb-6 sm:mb-8 border border-slate-800/50 shadow-inner gap-1">
                    <button 
                    onClick={() => setMode('topic')}
                    className={`flex-1 min-w-[30%] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'topic' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                    >
                        <Sparkles className="w-4 h-4" /> Topic
                    </button>
                    <button 
                    onClick={() => setMode('text')}
                    className={`flex-1 min-w-[30%] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'text' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                    >
                        <FileText className="w-4 h-4" /> Text
                    </button>
                    <button 
                    onClick={() => setMode('file')}
                    className={`flex-1 min-w-[30%] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'file' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                    >
                        <Upload className="w-4 h-4" /> File
                    </button>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                    {mode === 'topic' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {outputStyle === 'upsc' ? 'UPSC Mains Question' : 'Book Topic'}
                        </label>
                        {outputStyle === 'upsc' ? (
                            <textarea 
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                placeholder="e.g. Discuss the impact of climate change on Indian agriculture..."
                                className="w-full h-32 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none shadow-inner leading-relaxed"
                            />
                        ) : (
                            <input 
                                type="text"
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                placeholder="e.g. History of India..."
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                            />
                        )}
                    </div>
                    ) : mode === 'text' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Raw Content</label>
                        <textarea 
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Paste your notes here..."
                            className="w-full h-48 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none shadow-inner leading-relaxed"
                        />
                    </div>
                    ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Upload Files</label>
                        <div className="w-full bg-slate-900/30 border-2 border-dashed border-slate-700/50 rounded-xl p-6 text-center hover:border-blue-500/50 hover:bg-slate-900/50 transition-all cursor-pointer relative group">
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,.txt,image/*"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="p-3 bg-slate-800/50 rounded-full w-fit mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-blue-400" />
                            </div>
                            <p className="text-sm text-slate-300 font-medium">Click or drag files to upload</p>
                            <p className="text-xs text-slate-500 mt-1">PDF, TXT, Images supported</p>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <span className="text-sm text-slate-300 truncate">{file.name}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeFile(index)}
                                            className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Output Style</label>
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800/50 shadow-inner gap-1">
                            <button 
                                type="button"
                                onClick={() => setOutputStyle('notes')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${outputStyle === 'notes' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                Detailed Notes
                            </button>
                            <button 
                                type="button"
                                onClick={() => setOutputStyle('upsc')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${outputStyle === 'upsc' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                UPSC Mains
                            </button>
                        </div>
                    </div>

                    {outputStyle === 'upsc' && (
                    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Word Limit</label>
                        <div className="grid grid-cols-4 bg-slate-900/80 p-1 rounded-xl border border-slate-800/50 shadow-inner gap-1">
                            {[150, 250, 500, 1000].map((limit) => (
                                <button 
                                    key={limit}
                                    type="button"
                                    onClick={() => setWordLimit(limit)}
                                    className={`flex items-center justify-center py-2 rounded-lg text-xs font-medium transition-all duration-200 ${wordLimit === limit ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                >
                                    {limit}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Language</label>
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800/50 shadow-inner gap-1">
                            <button 
                                type="button"
                                onClick={() => setLanguage('English')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${language === 'English' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                English
                            </button>
                            <button 
                                type="button"
                                onClick={() => setLanguage('Hindi')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${language === 'Hindi' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                Hindi
                            </button>
                        </div>
                    </div>

                    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">AI Model</label>
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800/50 shadow-inner gap-1">
                            <button 
                                type="button"
                                onClick={() => setAiModel('gemini-3.1-pro-preview')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${aiModel === 'gemini-3.1-pro-preview' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                Pro
                            </button>
                            <button 
                                type="button"
                                onClick={() => setAiModel('gemini-3-flash-preview')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${aiModel === 'gemini-3-flash-preview' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                Flash
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-6">
                        <Button 
                        type="submit" 
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 group border border-white/10"
                        isLoading={status === GenerationStatus.GENERATING_CHAPTER}
                        >
                            {status === GenerationStatus.GENERATING_CHAPTER ? (
                                 'Generating...'
                            ) : (
                                <>
                                  <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                                  {outputStyle === 'upsc' ? 'Generate UPSC Answer' : mode === 'topic' ? 'Generate Detailed Notes' : mode === 'text' ? 'Format Notes Perfectly' : 'Generate from Files'}
                                </>
                            )}
                        </Button>
                        
                        {mode === 'topic' && outputStyle === 'notes' && (
                            <div className="flex flex-col gap-3">
                                <Button 
                                type="button"
                                onClick={handleGenerateTable}
                                variant="secondary"
                                className="w-full py-3.5 bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 text-slate-300 hover:text-blue-400 font-bold rounded-xl shadow-inner transition-all flex items-center justify-center gap-2"
                                isLoading={status === GenerationStatus.GENERATING_TABLE}
                                >
                                    {status === GenerationStatus.GENERATING_TABLE ? (
                                        'Generating Table...'
                                    ) : (
                                        <>
                                            <TableIcon className="w-5 h-5" />
                                            Generate Compare Table
                                        </>
                                    )}
                                </Button>

                                <Button 
                                type="button"
                                onClick={handleGenerateDetailedTable}
                                variant="secondary"
                                className="w-full py-3.5 bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 text-slate-300 hover:text-blue-400 font-bold rounded-xl shadow-inner transition-all flex items-center justify-center gap-2"
                                isLoading={status === GenerationStatus.GENERATING_DETAILED_TABLE}
                                >
                                    {status === GenerationStatus.GENERATING_DETAILED_TABLE ? (
                                        'Generating Detailed Table...'
                                    ) : (
                                        <>
                                            <TableIcon className="w-4 h-4" />
                                            Generate Detailed Table
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </form>

                <div className="mt-8 pt-8 border-t border-slate-800/60">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleClearCanvas} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all border border-slate-800/80 hover:border-red-500/30 text-sm font-medium group">
                        <Eraser className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Clear
                    </button>
                    <button onClick={handleUndo} disabled={!canUndo} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/50 text-slate-300 hover:bg-slate-800 transition-all border border-slate-800/80 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                        <Undo className="w-4 h-4" /> Undo
                    </button>
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-slate-950 border-t border-slate-800/60 text-[10px] text-slate-500 text-center uppercase tracking-widest font-semibold">
                AI Powered • v2.1 Pro
            </div>
        </div>
      </aside>
    </>
  );
};
