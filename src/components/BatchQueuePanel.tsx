import React, { useState } from 'react';
import { ListPlus, ChevronUp, X, Clock, Loader2, AlertTriangle, ListRestart, Play, Square, PauseCircle } from 'lucide-react';
import type { BatchQueueItem, BatchOutputStyle } from '../hooks/useBatchQueue';
import '../liquid-panels.css';

interface BatchQueuePanelProps {
  items: BatchQueueItem[];
  outputStyle: BatchOutputStyle;
  onAdd: (rawText: string) => void;
  onRemove: (id: string) => void;
  // Re-runs a FAILED item using the settings it was queued with — not a
  // fresh add, which would silently pick up whatever the sidebar says now.
  onRetry: (id: string) => void;
  // Whether THIS browser tab is currently driving the queue — items can
  // still show "Writing…" with this false, if the background worker is the
  // one generating them.
  isTabRunning: boolean;
  onContinue: () => void;
  onStop: () => void;
  onResume: () => void;
  // Something outside this tab is visibly working this queue (the
  // background worker). Detected from the queue advancing, not from a row
  // being 'active' — that only holds for ~30s of every ~95s cycle.
  workerActive: boolean;
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
export const BatchQueuePanel: React.FC<BatchQueuePanelProps> = ({
  items, outputStyle, onAdd, onRemove, onRetry, isTabRunning, onContinue, onStop, onResume, workerActive,
}) => {
  const [open, setOpen] = useState(items.length > 0);
  const [draft, setDraft] = useState('');

  const pendingCount = items.filter(it => it.status === 'pending').length;
  const activeCount = items.filter(it => it.status === 'active').length;
  const pausedCount = items.filter(it => it.status === 'paused').length;
  const failedCount = items.filter(it => it.status === 'failed').length;
  // Paused wins the display: with items parked, nothing is going to happen
  // (here or in the worker) until Resume, so that's the only button worth
  // offering. Otherwise anything still moving gets Stop, and a queue sitting
  // idle in this tab gets Continue.
  const isPaused = pausedCount > 0;
  const isMoving = !isPaused && (isTabRunning || activeCount > 0 || workerActive);

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
          className="nm-btn px-6 min-h-[48px] text-sm"
        >
          <ListPlus className="w-4 h-4" />
          Batch Queue{items.length > 0 ? ` (${items.length})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="nm-panel nm-pop rounded-[24px] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="nm-head text-sm font-bold flex items-center gap-2.5">
            <span className="nm-ico-badge !w-8 !h-8 !rounded-[10px]"><ListPlus className="w-4 h-4" /></span>
            Batch Queue
          </h4>
          <button
            onClick={() => setOpen(false)}
            className="nm-chip min-h-[36px]"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Hide
          </button>
        </div>

        <div className="space-y-2">
          <label className="nm-label block">
            Add {STYLE_LABEL[outputStyle]} items <span className="normal-case tracking-normal font-medium">(one per line)</span>
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={STYLE_PLACEHOLDER[outputStyle]}
            className="nm-input resize-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="nm-btn-primary w-full px-4 min-h-[46px] text-sm"
          >
            <ListPlus className="w-4 h-4" /> Add to Queue
          </button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="nm-muted text-[11.5px] font-semibold">
                {isPaused && <span className="text-amber-600 dark:text-amber-400 font-semibold">Paused · </span>}
                {!isPaused && (activeCount > 0 || workerActive) && (
                  <span className="nm-accent-text font-semibold">
                    {activeCount > 0 ? 'Writing… ' : 'Writing in the background… '}
                  </span>
                )}
                {isPaused ? `${pausedCount} waiting` : `${pendingCount} pending`}
                {failedCount > 0 ? `, ${failedCount} failed` : ''}
              </span>
            </div>
            <div className="nm-scroll space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border text-[13px] leading-snug ${
                    it.status === 'failed'
                      ? 'bg-red-500/5 border-red-500/30'
                      : it.status === 'active'
                        ? 'nm-row on'
                        : it.status === 'paused'
                          ? 'bg-amber-500/5 border-amber-500/25'
                          : 'nm-well'
                  }`}
                >
                  {it.status === 'active' && <Loader2 className="nm-accent-text w-3.5 h-3.5 flex-shrink-0 mt-0.5 animate-spin" />}
                  {it.status === 'pending' && <Clock className="nm-muted w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  {it.status === 'paused' && <PauseCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />}
                  {it.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <span className="min-w-0 flex-1">
                    <span className="nm-muted block text-[9.5px] font-extrabold tracking-[0.1em] uppercase mb-0.5">
                      {STYLE_LABEL[it.outputStyle]}
                      {it.attempt > 1 && it.status !== 'done' ? ` · attempt ${it.attempt}/3` : ''}
                    </span>
                    <span className="block">{it.question}</span>
                    {it.status === 'failed' && it.error && (
                      <span className="block text-[11px] text-red-500 mt-0.5">{it.error}</span>
                    )}
                  </span>
                  {(it.status === 'pending' || it.status === 'paused') && (
                    <button
                      type="button"
                      onClick={() => onRemove(it.id)}
                      className="nm-icon-btn !w-8 !h-8 !rounded-full -my-1 -mr-1.5 flex-shrink-0"
                      aria-label="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {it.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => onRetry(it.id)}
                      className="nm-icon-btn !w-8 !h-8 !rounded-full -my-1 -mr-1.5 flex-shrink-0"
                      title="Re-queue"
                      aria-label="Re-queue"
                    >
                      <ListRestart className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Stop parks every remaining item server-side, so it stops the
                background worker too — not just this tab. Resume hands them
                back. Continue is for a queue that's simply sitting idle here
                (opening a note no longer silently restarts generation); it's
                safe to press even while the worker runs, since each item is
                claimed atomically. */}
            {isMoving && (
              <button
                type="button"
                onClick={onStop}
                className="nm-btn danger w-full px-4 min-h-[46px] text-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop{pendingCount > 0 ? ` (${pendingCount} left)` : ''}
              </button>
            )}
            {isPaused && (
              <button
                type="button"
                onClick={onResume}
                className="nm-btn-primary w-full px-4 min-h-[46px] text-sm"
              >
                <Play className="w-4 h-4" />
                Resume ({pausedCount} paused)
              </button>
            )}
            {!isPaused && !isMoving && pendingCount > 0 && (
              <button
                type="button"
                onClick={onContinue}
                className="nm-btn-primary w-full px-4 min-h-[46px] text-sm"
              >
                <Play className="w-4 h-4" />
                Continue ({pendingCount} left)
              </button>
            )}
            <p className="nm-muted text-[11px] leading-snug px-0.5">
              {isPaused
                ? 'Paused — nothing will be generated, here or in the background, until you press Resume.'
                : isMoving
                  ? 'Answers are being written one at a time, with about a minute between each. They appear here on their own — you can close the app. Stop halts the background run too.'
                  : 'These keep generating in the background even if you close the app. Stop pauses that too.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
