import React from 'react';
import { History, X } from 'lucide-react';
import type { PipelineResumeSnapshot } from '../utils/pipelineResume';

interface ResumeBannerProps {
  snapshot: PipelineResumeSnapshot | null;
  onResume: () => void;
  onDismiss: () => void;
}

const LEVEL_LABEL: Record<string, string> = {
  medium: 'Medium',
  detailed: 'Detailed',
  deep: 'Deep',
};

export const ResumeBanner: React.FC<ResumeBannerProps> = ({ snapshot, onResume, onDismiss }) => {
  if (!snapshot) return null;

  const done = snapshot.nodes.filter(n => n.status === 'done').length;
  const total = snapshot.nodes.length || 1;
  const title = snapshot.kind === 'topic' ? snapshot.topic : snapshot.title;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onDismiss}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <History className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Unfinished notes found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Generation was interrupted — pick up where it left off?</p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="ml-auto flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3.5 py-3 mb-4">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{title || 'Untitled'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {LEVEL_LABEL[snapshot.level] || snapshot.level} pipeline • {done}/{total} sections already written
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onResume}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
};
