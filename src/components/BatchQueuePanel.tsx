import React, { useState } from 'react';
import { ListPlus, ChevronUp, X, Clock, Loader2, AlertTriangle, ListRestart } from 'lucide-react';
import type { BatchQueueItem, BatchOutputStyle } from '../hooks/useBatchQueue';
import type { UPSCAnswerStyle, UPSCSubject } from '../services/ai/index';

interface BatchQueuePanelProps {
  items: BatchQueueItem[];
  outputStyle: BatchOutputStyle;
  onAdd: (rawText: string, overrides?: {
    outputStyle?: BatchOutputStyle;
    answerStyle?: UPSCAnswerStyle;
    marks?: number;
    subject?: UPSCSubject;
    multiVariant?: boolean;
  }) => void;
  onRemove: (id: string) => void;
}

const STYLE_LABEL: Record<BatchOutputStyle, string> = {
  upsc: 'UPSC answer',
  essay: 'Essay',
  research: 'Research paper',
  notes: 'Notes',
};

const STYLE_PLACEHOLDER: Record<BatchOutputStyle, string> = {
  upsc: 'Type or paste one exam question per line — as many as you want…',
  essay: 'One essay topic per line…',
  research: 'One research topic per line…',
  notes: 'One notes topic per line…',
};

// Add-any-number-of-topics queue: works for whichever output style is
// currently selected (UPSC / Essay / Research / Notes). Items are generated
// one at a time in the background (see useGeneration's runBatchQueue) — this
// panel just lets the student add more, watch progress, and pull out
// anything still pending. It's deliberately independent of the notes
// canvas's edit mode: these are queue controls, not document content.
export const BatchQueuePanel: React.FC<BatchQueuePanelProps> = ({ items, outputStyle, onAdd, onRemove }) => {
  const [open, setOpen] = useState(items.length > 0);
  const [draft, setDraft] = useState('');

  const pendingCount = items.filter(it => it.status === 'pending').length;
  const activeCount = items.filter(it => it.status === 'active').length;
  const failedCount = items.filter(it => it.status === 'failed').length;

  const handleAdd = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 mt-6 mb-2 px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all duration-200 active:scale-[0.97] hover:shadow-xl hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)' }}
        >
          <ListPlus className="w-4 h-4" />
          Batch Queue{items.length > 0 ? ` (${items.length})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Batch Queue
          </h4>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Hide
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
            Add {STYLE_LABEL[outputStyle]} items <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(one per line)</span>
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={STYLE_PLACEHOLDER[outputStyle]}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none resize-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)' }}
          >
            <ListPlus className="w-4 h-4" /> Add to Queue
          </button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeCount > 0 && <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Writing… </span>}
                {pendingCount} pending{failedCount > 0 ? `, ${failedCount} failed` : ''}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border text-[13px] leading-snug ${
                    it.status === 'failed'
                      ? 'bg-red-500/5 border-red-500/30'
                      : it.status === 'active'
                        ? 'bg-cyan-500/10 border-cyan-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 border-transparent'
                  }`}
                >
                  {it.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5 animate-spin" />}
                  {it.status === 'pending' && <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />}
                  {it.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 mb-0.5">
                      {STYLE_LABEL[it.outputStyle]}
                      {it.attempt > 1 && it.status !== 'done' ? ` · attempt ${it.attempt}/3` : ''}
                    </span>
                    <span className="block text-slate-700 dark:text-slate-200">{it.question}</span>
                    {it.status === 'failed' && it.error && (
                      <span className="block text-[11px] text-red-500 mt-0.5">{it.error}</span>
                    )}
                  </span>
                  {it.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onRemove(it.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                      aria-label="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {it.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => {
                        // Re-queue with the item's OWN original settings —
                        // not whatever the sidebar currently has selected,
                        // which could be a completely different output
                        // style/marks by now — then drop the stale failed
                        // row so it doesn't linger next to the fresh retry.
                        onAdd(it.question, {
                          outputStyle: it.outputStyle,
                          answerStyle: (it.answerStyle as UPSCAnswerStyle) ?? undefined,
                          marks: it.marks ?? undefined,
                          subject: (it.subject as UPSCSubject) ?? undefined,
                          multiVariant: it.multiVariant,
                        });
                        onRemove(it.id);
                      }}
                      className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex-shrink-0"
                      title="Re-queue with its original settings"
                      aria-label="Re-queue"
                    >
                      <ListRestart className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
