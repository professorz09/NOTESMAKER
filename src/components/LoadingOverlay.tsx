import React from 'react';
import { GenerationStatus } from '../types';

const LABELS: Record<string, string> = {
  [GenerationStatus.GENERATING_CHAPTER]: 'Writing content…',
  [GenerationStatus.GENERATING_TABLE]: 'Building table…',
  [GenerationStatus.GENERATING_IMAGE]: 'Creating diagram…',
};

interface LoadingOverlayProps {
  status: GenerationStatus;
}

// A compact, NON-BLOCKING progress pill pinned to the bottom of the screen.
// It intentionally does NOT cover the editor (no full-screen backdrop, and
// `pointer-events-none`) so the document stays visible and the user can keep
// reading / scrolling while an answer is being written below.
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  if (status === GenerationStatus.IDLE) return null;

  const label = LABELS[status] ?? 'Generating…';

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg pl-3 pr-4 py-2">
        <span className="relative flex w-5 h-5 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-600" />
          <span
            className="absolute inset-0 rounded-full border-2 border-t-blue-600 dark:border-t-blue-400 border-r-violet-500 dark:border-r-violet-400 border-b-transparent border-l-transparent animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      </div>
    </div>
  );
};
