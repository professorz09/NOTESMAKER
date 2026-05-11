import React from 'react';
import { GenerationStatus } from '../types';

const GENERATION_LABELS: Record<string, string> = {
  [GenerationStatus.GENERATING_CHAPTER]: 'Writing content…',
  [GenerationStatus.GENERATING_TABLE]:   'Building table…',
  [GenerationStatus.GENERATING_IMAGE]:   'Creating image…',
};

interface LoadingOverlayProps {
  status: GenerationStatus;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  if (status === GenerationStatus.IDLE) return null;

  const label = GENERATION_LABELS[status] ?? 'Generating…';

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 px-8 py-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 dark:border-slate-700 max-w-xs w-full mx-4">
        <div className="w-14 h-14 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mb-5" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{label}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse">Analyzing • Structuring • Writing…</p>
      </div>
    </div>
  );
};
