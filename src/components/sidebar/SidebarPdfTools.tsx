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
  <div className="space-y-2">
    <p className="nm-label px-1 pt-1">PDF Tools</p>
    <div className="grid grid-cols-2 gap-2">

      {/* PDF → Hindi */}
      <div className="nms-card plain p-2.5 space-y-2 flex flex-col">
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
          <p className="text-[12px] font-bold nm-head leading-tight">PDF→Hindi</p>
        </div>
        {!translatePdfFile ? (
          <label className="nms-drop-wrap flex-1 relative cursor-pointer block">
            <input type="file" accept=".pdf" onChange={handleTranslatePdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="nms-drop !rounded-[14px] flex-col !gap-1 py-3 h-full min-h-[64px]">
              <Upload className="w-4 h-4" />
              <p className="text-[11px] text-center leading-tight">Upload PDF</p>
            </div>
          </label>
        ) : (
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="nms-file !text-[11px] !py-0.5 !pl-2">
              <FileText className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
              <span className="truncate flex-1 min-w-0">{translatePdfFile.name}</span>
              <button type="button" onClick={() => setTranslatePdfFile(null)} className="nms-x" aria-label="Remove PDF">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleTranslatePdf}
              disabled={isGenerating}
              className="nm-btn-primary w-full min-h-[40px] text-[12px] !gap-1.5"
            >
              {isGenerating && translateProgress ? (
                <><span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(4,38,29,0.3)', borderTopColor: 'currentColor' }} />{translateProgress.current}/{translateProgress.total}</>
              ) : (
                <><Languages className="w-3.5 h-3.5" />{translateResumeState?.pdfName === translatePdfFile?.name ? 'Restart' : 'Translate'}</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Answer Analysis */}
      <div className="nms-card plain p-2.5 space-y-2 flex flex-col">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
          <p className="text-[12px] font-bold nm-head leading-tight">Answer Analysis</p>
        </div>
        {!answerPdfFile ? (
          <label className="nms-drop-wrap flex-1 relative cursor-pointer block">
            <input type="file" accept=".pdf" onChange={handleAnswerPdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isGenerating} />
            <div className="nms-drop !rounded-[14px] flex-col !gap-1 py-3 h-full min-h-[64px]">
              <Upload className="w-4 h-4" />
              <p className="text-[11px] text-center leading-tight">Upload answer<br/>PDF</p>
            </div>
          </label>
        ) : (
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="nms-file !text-[11px] !py-0.5 !pl-2">
              <FileText className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
              <span className="truncate flex-1 min-w-0">{answerPdfFile.name}</span>
              <button type="button" onClick={() => setAnswerPdfFile(null)} disabled={isGenerating} className="nms-x" aria-label="Remove answer PDF">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAnalyzeAnswer}
              disabled={isGenerating}
              className="nm-btn-primary w-full min-h-[40px] text-[12px] !gap-1.5"
            >
              {answerAnalyzing ? (
                <><span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(4,38,29,0.3)', borderTopColor: 'currentColor' }} />Analysing...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" />Analyse</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Topper Copy → clean Hindi answer (PDF or photo) */}
    <div className="nms-card plain p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
        <p className="text-[12px] font-bold nm-head leading-tight">Topper Copy → Answer</p>
      </div>
      <p className="nms-help !px-0">Upload a topper's answer copy (photo/PDF) — it's rewritten as a clean, formatted Hindi answer.</p>
      {!topperCopyFile ? (
        <label className="nms-drop-wrap relative cursor-pointer block">
          <input type="file" accept="image/*,.pdf" onChange={handleTopperCopyUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isGenerating} />
          <div className="nms-drop !rounded-[14px] min-h-[44px] px-3">
            <Upload className="w-4 h-4" />
            <p className="text-[11px]">Upload topper copy (photo / PDF)</p>
          </div>
        </label>
      ) : (
        <div className="space-y-1.5">
          <div className="nms-file !text-[11px] !py-0.5 !pl-2">
            <FileText className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
            <span className="truncate flex-1 min-w-0">{topperCopyFile.name}</span>
            <button type="button" onClick={() => setTopperCopyFile(null)} disabled={isGenerating} className="nms-x" aria-label="Remove topper copy">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerateFromTopperCopy}
            disabled={isGenerating}
            className="nm-btn-primary w-full min-h-[40px] text-[12px] !gap-1.5"
          >
            {topperGenerating ? (
              <><span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(4,38,29,0.3)', borderTopColor: 'currentColor' }} />Reading…</>
            ) : (
              <><Trophy className="w-3.5 h-3.5" />Make Answer</>
            )}
          </button>
        </div>
      )}
    </div>

    {/* Resume state */}
    {translateResumeState && translateResumeState.pdfName === translatePdfFile?.name && !isGenerating && (
      <div className="nms-card p-2.5 space-y-1.5">
        <p className="text-[11px] nms-warn font-semibold text-center">
          Paused at page {translateResumeState.startPage}/{translateResumeState.total}
        </p>
        <button type="button" onClick={handleResumePdf}
          className="nm-btn-primary w-full min-h-[40px] text-[12px] !gap-1.5">
          <Languages className="w-3.5 h-3.5" />
          Resume from page {translateResumeState.startPage}
        </button>
        <button type="button" onClick={() => setTranslateResumeState(null)} className="w-full min-h-[36px] text-[11px] font-semibold nm-muted hover:underline">
          Start over
        </button>
      </div>
    )}

    {/* Progress bar */}
    {isGenerating && translateProgress && (
      <div className="space-y-1.5 px-1">
        <div className="nms-bar">
          <div style={{ width: `${Math.round((translateProgress.current / translateProgress.total) * 100)}%` }} />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-[11px] nm-muted">{Math.round((translateProgress.current / translateProgress.total) * 100)}% done</p>
          {translateProgress.secondsLeft != null && translateProgress.secondsLeft > 0 && (
            <p className="text-[11px] nm-muted">~{translateProgress.secondsLeft >= 60 ? `${Math.ceil(translateProgress.secondsLeft / 60)} min` : `${translateProgress.secondsLeft}s`} left</p>
          )}
        </div>
      </div>
    )}
  </div>
);
