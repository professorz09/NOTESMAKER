import React, { useEffect, useState } from 'react';
import { ListChecks, ChevronUp, ChevronDown } from 'lucide-react';

interface GeneratedQuestionsIndexProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  // Only used to trigger a re-scan when the document changes — the actual
  // list is read straight off the live DOM via editorRef so it always
  // matches exactly what's on screen (and jumping to one is a real
  // scrollIntoView on the real element, not a re-parsed guess).
  generatedHtml: string | null;
}

interface QuestionEntry {
  index: number;
  text: string;
}

// "Show All Generated" — a note built up over many Next Question / batch
// queue answers can run to dozens of questions, with no way to see what's
// already been asked without scrolling the whole document. This lists
// every UPSC question generated so far in this note and jumps straight to
// it on click.
export const GeneratedQuestionsIndex: React.FC<GeneratedQuestionsIndexProps> = ({ editorRef, generatedHtml }) => {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);

  useEffect(() => {
    const nodes = editorRef.current ? Array.from(editorRef.current.querySelectorAll('.upsc-question')) : [];
    setQuestions(nodes.map((n, index) => ({ index, text: (n.textContent || '').replace(/^Q\.\s*/, '').trim() })));
  }, [generatedHtml, editorRef]);

  const scrollToQuestion = (index: number) => {
    const nodes = editorRef.current?.querySelectorAll('.upsc-question');
    const el = nodes?.[index] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (questions.length === 0) return null;

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 mt-6 mb-2 px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all duration-200 active:scale-[0.97] hover:shadow-xl hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)' }}
        >
          <ListChecks className="w-4 h-4" />
          Show All Generated ({questions.length})
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            All Generated Questions ({questions.length})
          </h4>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Hide
          </button>
        </div>
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {questions.map((q) => (
            <button
              key={q.index}
              type="button"
              onClick={() => scrollToQuestion(q.index)}
              className="w-full flex items-start gap-2.5 text-left px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition-all"
            >
              <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full w-5 h-5 flex items-center justify-center mt-0.5">
                {q.index + 1}
              </span>
              <span className="text-[13px] leading-snug text-slate-700 dark:text-slate-200 flex-1 min-w-0">{q.text}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-1 -rotate-90" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
