import React from 'react';
import { GenerationStatus } from '../types';

const STEPS: Record<string, { label: string; steps: string[] }> = {
  [GenerationStatus.GENERATING_CHAPTER]: {
    label: 'Writing content…',
    steps: ['Analyzing topic', 'Structuring content', 'Writing notes'],
  },
  [GenerationStatus.GENERATING_TABLE]: {
    label: 'Building table…',
    steps: ['Parsing data', 'Structuring rows', 'Formatting table'],
  },
  [GenerationStatus.GENERATING_IMAGE]: {
    label: 'Creating diagram…',
    steps: ['Analyzing context', 'Designing layout', 'Rendering output'],
  },
};

interface LoadingOverlayProps {
  status: GenerationStatus;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  if (status === GenerationStatus.IDLE) return null;

  const config = STEPS[status] ?? { label: 'Generating…', steps: ['Analyzing', 'Processing', 'Writing'] };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-7 sm:p-9 flex flex-col items-center gap-5 max-w-[280px] sm:max-w-xs w-full mx-4">

        {/* Animated orb */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-700" />
          <div
            className="absolute inset-0 rounded-full border-4 border-t-blue-600 dark:border-t-blue-400 border-r-violet-500 dark:border-r-violet-400 border-b-transparent border-l-transparent animate-spin"
            style={{ animationDuration: '0.9s' }}
          />
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none" className="relative z-10">
            <path d="M13 7 C10 6 7 6.5 5 7.5 L5 20 C7 19 10 18.5 13 19.5 Z" fill="#3b82f6" opacity="0.6"/>
            <path d="M13 7 C16 6 19 6.5 21 7.5 L21 20 C19 19 16 18.5 13 19.5 Z" fill="#3b82f6" opacity="0.9"/>
            <path d="M13 3.5 L4.5 7 L13 10.5 L21.5 7 Z" fill="#8b5cf6" opacity="0.9"/>
          </svg>
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{config.label}</p>
        </div>

        {/* Step dots */}
        <div className="flex flex-col gap-2 w-full">
          {config.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.25}s infinite` }}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400"
                style={{ opacity: 0.4 + i * 0.3 }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Shimmer bar */}
        <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
};
