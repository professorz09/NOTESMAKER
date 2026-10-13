import React from 'react';
import { ListChecks, CheckSquare, Square, X, Sparkles, Loader2 } from 'lucide-react';
import type { PYQQuestionItem } from '../services/ai/index';
import '../liquid-panels.css';

interface PYQQuestionPickerProps {
  questions: PYQQuestionItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSetAllSelected: (selected: boolean) => void;
  onDismiss: () => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

// Stage-2 review step of the PYQ question-bank pipeline (see
// useGeneration's handleFindPYQQuestions / handleGeneratePYQAnswers): a
// topic turns into several distinct PYQ-style questions here, the student
// ticks the ones worth answering, then "Generate" writes a model answer for
// each ticked one in turn, appending below as it goes.
export const PYQQuestionPicker: React.FC<PYQQuestionPickerProps> = ({
  questions,
  selectedIds,
  onToggle,
  onSetAllSelected,
  onDismiss,
  onGenerate,
  isGenerating = false,
}) => {
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === questions.length && questions.length > 0;

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="nm-panel nm-pop rounded-[24px] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="nm-head text-sm font-bold flex items-center gap-2.5 min-w-0">
            <span className="nm-ico-badge !w-8 !h-8 !rounded-[10px]"><ListChecks className="w-4 h-4" /></span>
            PYQ Question Set — tick the ones to answer
          </h4>
          <button
            onClick={onDismiss}
            disabled={isGenerating}
            className="nm-icon-btn !rounded-full flex-shrink-0 -mr-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className="nm-label">{selectedCount} of {questions.length} selected</span>
          <button
            type="button"
            onClick={() => onSetAllSelected(!allSelected)}
            disabled={isGenerating}
            className="nm-chip disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="nm-scroll space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {questions.map((q) => {
            const checked = selectedIds.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                disabled={isGenerating}
                onClick={() => onToggle(q.id)}
                className={`nm-row w-full text-left flex items-start gap-2.5 px-3 py-3 disabled:opacity-60 disabled:cursor-not-allowed ${checked ? 'on' : ''}`}
              >
                {checked
                  ? <CheckSquare className="nm-accent-text w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <Square className="nm-muted w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  {q.angle && (
                    <span className="nm-accent-text block text-[9.5px] font-extrabold tracking-[0.1em] uppercase mb-0.5">{q.angle}</span>
                  )}
                  <span className="block text-[13px] leading-snug">{q.question}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          disabled={isGenerating || selectedCount === 0}
          onClick={onGenerate}
          className="nm-btn-primary w-full px-6 min-h-[48px] text-sm"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Writing answers below…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate {selectedCount || ''} Model Answer{selectedCount === 1 ? '' : 's'}</>
          )}
        </button>
      </div>
    </div>
  );
};
