import React from 'react';
import { GenerationStatus } from '../types';
import { EmptyState } from './EmptyState';
import { NextQuestionPanel } from './NextQuestionPanel';
import { PYQQuestionPicker } from './PYQQuestionPicker';
import { BatchQueuePanel } from './BatchQueuePanel';
import { GeneratedQuestionsIndex } from './GeneratedQuestionsIndex';
import type { UPSCAnswerStyle, UPSCSubject, PYQQuestionItem } from '../services/ai/index';
import type { BatchQueueItem } from '../hooks/useBatchQueue';

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
  mode: 'topic' | 'text' | 'file' | 'transcript' | 'currentAffairs';
  onGetStarted?: () => void;
  // UPSC next question flow
  outputStyle: 'notes' | 'upsc' | 'essay' | 'research' | 'table';
  upscAnswerStyle: UPSCAnswerStyle;
  upscSubject: UPSCSubject;
  marks: number;
  handleNextUPSCQuestion: (style?: UPSCAnswerStyle, marks?: number, customQuestion?: string, subject?: UPSCSubject) => void;
  // PYQ question-bank pipeline
  pyqQuestions: PYQQuestionItem[] | null;
  pyqSelectedIds: Set<string>;
  togglePyqQuestion: (id: string) => void;
  setAllPyqSelected: (selected: boolean) => void;
  onDismissPyqQuestions: () => void;
  onGeneratePyqAnswers: () => void;
  // Batch Question Queue
  batchQueueItems: BatchQueueItem[];
  onAddToBatchQueue: (rawText: string, overrides?: {
    outputStyle?: 'notes' | 'upsc' | 'essay' | 'research';
    answerStyle?: UPSCAnswerStyle;
    marks?: number;
    subject?: UPSCSubject;
    multiVariant?: boolean;
  }) => void;
  onRemoveFromBatchQueue: (id: string) => void;
  onRetryBatchQueueItem: (id: string) => void;
  isBatchPaused: boolean;
  onPauseBatchQueue: () => void;
  onResumeBatchQueue: () => void;
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
  mode,
  onGetStarted,
  outputStyle,
  upscAnswerStyle,
  upscSubject,
  marks,
  handleNextUPSCQuestion,
  pyqQuestions,
  pyqSelectedIds,
  togglePyqQuestion,
  setAllPyqSelected,
  onDismissPyqQuestions,
  onGeneratePyqAnswers,
  batchQueueItems,
  onAddToBatchQueue,
  onRemoveFromBatchQueue,
  onRetryBatchQueueItem,
  isBatchPaused,
  onPauseBatchQueue,
  onResumeBatchQueue,
}) => {
  const showContent = !!generatedHtml;
  const isBusy = status !== GenerationStatus.IDLE;

  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div
        className={`editor-container page-container size-a4 editor-content bg-white dark:bg-slate-900 transition-all duration-300 rounded-md shadow-[0_4px_20px_rgb(0,0,0,0.06)] md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-1 ring-slate-200/50 dark:ring-slate-700/50 ${isEditing ? 'ring-4 ring-blue-500/20 dark:ring-blue-500/40 shadow-blue-500/10' : ''}`}
        style={{ fontSize: `${fontSize}pt`, '--editor-lh': lineHeight } as React.CSSProperties}
      >
        {!showContent ? (
          <EmptyState onGetStarted={onGetStarted} />
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

      {/* Show All Generated — every UPSC question written so far in this
          note, click any one to jump straight to it. A note built up over
          many Next Question / batch answers has no other way to see what's
          already been asked without scrolling the whole document. */}
      {mode !== 'transcript' && outputStyle === 'upsc' && generatedHtml && (
        <GeneratedQuestionsIndex editorRef={editorRef} generatedHtml={generatedHtml} />
      )}

      {/* PYQ question-bank picker — shown once "Find PYQ Question Set" (in
          the sidebar) has returned candidates. Stays mounted through
          generation so ticked questions' answers visibly append below one
          by one instead of the panel disappearing mid-run. */}
      {mode !== 'transcript' && outputStyle === 'upsc' && pyqQuestions && pyqQuestions.length > 0 && (
        <PYQQuestionPicker
          questions={pyqQuestions}
          selectedIds={pyqSelectedIds}
          onToggle={togglePyqQuestion}
          onSetAllSelected={setAllPyqSelected}
          onDismiss={onDismissPyqQuestions}
          onGenerate={onGeneratePyqAnswers}
          isGenerating={isBusy}
        />
      )}

      {/* Create Next UPSC Question panel — stays mounted during generation so
          the answer appends below without the panel vanishing / the screen
          blocking; it just shows a clean "generating" state on its button. */}
      {mode !== 'transcript' && outputStyle === 'upsc' && generatedHtml && !pyqQuestions && (
        <NextQuestionPanel
          defaultStyle={upscAnswerStyle}
          defaultMarks={marks}
          defaultSubject={upscSubject}
          isGenerating={isBusy}
          onGenerate={(style, wl, q, subj) => handleNextUPSCQuestion(style, wl, q, subj)}
          onAddToQueue={(style, wl, q, subj) => onAddToBatchQueue(q, {
            outputStyle: 'upsc', answerStyle: style, marks: wl, subject: subj,
          })}
          queuedCount={batchQueueItems.filter(it => it.outputStyle === 'upsc').length}
        />
      )}

      {/* Batch Question Queue — add any number of topics/questions across
          Notes/UPSC/Essay/Research and they generate one at a time in the
          background. Independent of the panels above: works whether or not
          a document exists yet, and stays usable during generation. */}
      {mode === 'topic' && outputStyle !== 'table' && (
        <BatchQueuePanel
          items={batchQueueItems}
          outputStyle={outputStyle}
          onAdd={onAddToBatchQueue}
          onRemove={onRemoveFromBatchQueue}
          onRetry={onRetryBatchQueueItem}
          isPaused={isBatchPaused}
          onPause={onPauseBatchQueue}
          onResume={onResumeBatchQueue}
        />
      )}

      <div className="h-12 flex items-center justify-center mt-4 opacity-0 hover:opacity-100 transition-opacity">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">End of Document</span>
      </div>
    </div>
  );
};
