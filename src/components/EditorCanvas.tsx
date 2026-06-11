import React from 'react';
import { GenerationStatus } from '../types';
import { EmptyState } from './EmptyState';
import { NextQuestionPanel } from './NextQuestionPanel';
import type { UPSCAnswerStyle, UPSCSubject } from '../services/ai/index';

interface EditorCanvasProps {
  generatedHtml: string | null;
  status: GenerationStatus;
  isEditing: boolean;
  fontSize: number;
  lineHeight: number;
  editorRef: React.RefObject<HTMLDivElement | null>;
  handleEditorInput: (e: React.FormEvent<HTMLDivElement>) => void;
  handleEditorBlur: () => void;
  handleEditorKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleEditorPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  // UPSC next question flow
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  upscAnswerStyle: UPSCAnswerStyle;
  upscSubject: UPSCSubject;
  wordLimit: number;
  handleNextUPSCQuestion: (style?: UPSCAnswerStyle, wordLimit?: number, customQuestion?: string, subject?: UPSCSubject) => void;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  generatedHtml,
  status,
  isEditing,
  fontSize,
  lineHeight,
  editorRef,
  handleEditorInput,
  handleEditorBlur,
  handleEditorKeyDown,
  handleEditorPaste,
  outputStyle,
  upscAnswerStyle,
  upscSubject,
  wordLimit,
  handleNextUPSCQuestion,
}) => {
  const showContent = !!generatedHtml;

  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div
        className={`editor-container page-container size-a4 editor-content bg-white dark:bg-slate-900 transition-all duration-300 rounded-md shadow-[0_4px_20px_rgb(0,0,0,0.06)] md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-1 ring-slate-200/50 dark:ring-slate-700/50 ${isEditing ? 'ring-4 ring-blue-500/20 dark:ring-blue-500/40 shadow-blue-500/10' : ''}`}
        style={{ fontSize: `${fontSize}pt`, '--editor-lh': lineHeight } as React.CSSProperties}
      >
        {!showContent ? (
          <EmptyState />
        ) : (
          <div
            className={`min-h-[267mm] outline-none ${isEditing ? 'cursor-text' : ''}`}
            contentEditable={isEditing}
            suppressContentEditableWarning
            ref={editorRef}
            onInput={handleEditorInput}
            onBlur={handleEditorBlur}
            onKeyDown={handleEditorKeyDown}
            onPaste={handleEditorPaste}
          />
        )}
      </div>

      {/* Create Next UPSC Question panel — shown after UPSC answer is generated */}
      {outputStyle === 'upsc' && generatedHtml && status === GenerationStatus.IDLE && (
        <NextQuestionPanel
          defaultStyle={upscAnswerStyle}
          defaultWordLimit={wordLimit}
          defaultSubject={upscSubject}
          onGenerate={(style, wl, q, subj) => handleNextUPSCQuestion(style, wl, q, subj)}
        />
      )}

      <div className="h-12 flex items-center justify-center mt-4 opacity-0 hover:opacity-100 transition-opacity">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">End of Document</span>
      </div>
    </div>
  );
};
