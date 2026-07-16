import React, { useState } from 'react';
import { History, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { PipelineResumeSnapshot } from '../utils/pipelineResume';

interface ResumeBannerProps {
  snapshots: PipelineResumeSnapshot[];
  onResume: (snapshot: PipelineResumeSnapshot) => void;
  onDismiss: (id: string) => void;
}

const LEVEL_LABEL: Record<string, string> = {
  medium: 'Medium',
  detailed: 'Detailed',
  deep: 'Deep',
};

const ResumeItem: React.FC<{
  snapshot: PipelineResumeSnapshot;
  onResume: () => void;
  onDismiss: () => void;
}> = ({ snapshot, onResume, onDismiss }) => {
  const done = snapshot.nodes.filter(n => n.status === 'done').length;
  const total = snapshot.nodes.length || 1;
  const title = snapshot.kind === 'topic' ? snapshot.topic : snapshot.title;

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{title || 'Untitled'}</p>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            {LEVEL_LABEL[snapshot.level] || snapshot.level} pipeline • {done}/{total} sections done
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Discard"
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={onResume}
        className="mt-2 w-full py-1.5 rounded-lg text-[12.5px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
      >
        Resume
      </button>
    </div>
  );
};

// Non-blocking floating panel — several notes pipelines can be interrupted
// and left pending at once (starting a fresh generation doesn't discard an
// earlier one), so this lists all of them rather than a single blocking modal.
export const ResumeBanner: React.FC<ResumeBannerProps> = ({ snapshots, onResume, onDismiss }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!snapshots.length) return null;

  return (
    <div
      className="fixed z-[65] w-[min(92vw,340px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      style={{ left: '1.25rem', bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
      >
        <History className="w-4 h-4 flex-shrink-0" />
        <span className="text-[12.5px] font-bold flex-1 text-left">
          {snapshots.length} unfinished note{snapshots.length > 1 ? 's' : ''}
        </span>
        {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="p-2.5 space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
          {snapshots.map(snap => (
            <ResumeItem
              key={snap.id}
              snapshot={snap}
              onResume={() => onResume(snap)}
              onDismiss={() => onDismiss(snap.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
