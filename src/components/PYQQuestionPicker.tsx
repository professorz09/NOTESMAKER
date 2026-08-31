import React from 'react';
import { ListChecks, CheckSquare, Square, X, Sparkles, Loader2 } from 'lucide-react';
import type { PYQQuestionItem } from '../services/ai/index';

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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            PYQ Question Set — tick the ones to answer
          </h4>
          <button
            onClick={onDismiss}
            disabled={isGenerating}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{selectedCount} of {questions.length} selected</span>
          <button
            type="button"
            onClick={() => onSetAllSelected(!allSelected)}
            disabled={isGenerating}
            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-40"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {questions.map((q) => {
            const checked = selectedIds.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                disabled={isGenerating}
                onClick={() => onToggle(q.id)}
                className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  checked
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {checked
                  ? <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <Square className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  {q.angle && (
                    <span className="block text-[9px] font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-0.5">{q.angle}</span>
                  )}
                  <span className="block text-[13px] leading-snug text-slate-700 dark:text-slate-200">{q.question}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          disabled={isGenerating || selectedCount === 0}
          onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)' }}
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
