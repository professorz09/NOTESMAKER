import React from 'react';
import { FileText, Upload, X, Languages, GraduationCap, Sparkles, Trophy } from 'lucide-react';

interface SidebarPdfToolsProps {
  isGenerating: boolean;
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
  topperCopyFile: { name: string; mimeType: string; data: string } | null;
  setTopperCopyFile: (f: null) => void;
  handleTopperCopyUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerateFromTopperCopy: () => void;
  topperGenerating: boolean;
}

export const SidebarPdfTools: React.FC<SidebarPdfToolsProps> = ({
  isGenerating,
  translatePdfFile, handleTranslatePdfUpload, handleTranslatePdf, handleResumePdf,
  setTranslatePdfFile, translateProgress, translateResumeState, setTranslateResumeState,
  answerPdfFile, setAnswerPdfFile, handleAnswerPdfUpload, handleAnalyzeAnswer, answerAnalyzing,
  topperCopyFile, setTopperCopyFile, handleTopperCopyUpload, handleGenerateFromTopperCopy, topperGenerating,
}) => (
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
              <p className="text-[9px] text-slate-500 text-center leading-tight">Upload PDF</p>
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
                <><Languages className="w-3 h-3" />{translateResumeState?.pdfName === translatePdfFile?.name ? 'Restart' : 'Translate'}</>
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
          <p className="text-[10px] font-bold text-rose-300 leading-tight">Answer Analysis</p>
        </div>
        {!answerPdfFile ? (
          <label className="flex-1 relative cursor-pointer block">
            <input type="file" accept=".pdf" onChange={handleAnswerPdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isGenerating} />
            <div className="flex flex-col items-center gap-1 py-3 rounded-lg border border-dashed border-rose-500/25 hover:border-rose-500/50 hover:bg-rose-500/8 transition-all h-full justify-center">
              <Upload className="w-3.5 h-3.5 text-rose-400/70" />
              <p className="text-[9px] text-slate-500 text-center leading-tight">Upload answer<br/>PDF</p>
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
                <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />Analysing...</>
              ) : (
                <><Sparkles className="w-3 h-3" />Analyse</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Topper Copy → clean Hindi answer (PDF or photo) */}
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-3 h-3 text-amber-400" />
        </div>
        <p className="text-[10px] font-bold text-amber-300 leading-tight">Topper Copy → Answer</p>
      </div>
      <p className="text-[9px] text-slate-500 leading-tight">Upload a topper's answer copy (photo/PDF) — it's rewritten as a clean, formatted Hindi answer.</p>
      {!topperCopyFile ? (
        <label className="relative cursor-pointer block">
          <input type="file" accept="image/*,.pdf" onChange={handleTopperCopyUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isGenerating} />
          <div className="flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-amber-500/25 hover:border-amber-500/50 hover:bg-amber-500/8 transition-all">
            <Upload className="w-3.5 h-3.5 text-amber-400/70" />
            <p className="text-[9px] text-slate-500">Upload topper copy (photo / PDF)</p>
          </div>
        </label>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 bg-white/4 rounded-lg px-2 py-1.5 border border-white/6 min-w-0">
            <FileText className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-[9px] text-slate-300 truncate flex-1 min-w-0">{topperCopyFile.name}</span>
            <button type="button" onClick={() => setTopperCopyFile(null)} disabled={isGenerating} className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors disabled:opacity-40">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerateFromTopperCopy}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
          >
            {topperGenerating ? (
              <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />Reading…</>
            ) : (
              <><Trophy className="w-3 h-3" />Make Answer</>
            )}
          </button>
        </div>
      )}
    </div>

    {/* Resume state */}
    {translateResumeState && translateResumeState.pdfName === translatePdfFile?.name && !isGenerating && (
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 p-2.5 space-y-1.5">
        <p className="text-[10px] text-orange-300 text-center">
          Paused at page {translateResumeState.startPage}/{translateResumeState.total}
        </p>
        <button type="button" onClick={handleResumePdf}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold text-white active:scale-[0.98] transition-all"
          style={{ background: 'linear-gradient(135deg, #ea580c 0%, #b45309 100%)' }}>
          <Languages className="w-3 h-3" />
          Resume from page {translateResumeState.startPage}
        </button>
        <button type="button" onClick={() => setTranslateResumeState(null)} className="w-full text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
          Start over
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
          <p className="text-[10px] text-slate-500">{Math.round((translateProgress.current / translateProgress.total) * 100)}% done</p>
          {translateProgress.secondsLeft != null && translateProgress.secondsLeft > 0 && (
            <p className="text-[10px] text-orange-500/80">~{translateProgress.secondsLeft >= 60 ? `${Math.ceil(translateProgress.secondsLeft / 60)} min` : `${translateProgress.secondsLeft}s`} left</p>
          )}
        </div>
      </div>
    )}
  </div>
);
