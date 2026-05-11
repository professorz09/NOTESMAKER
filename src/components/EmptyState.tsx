import React from 'react';
import { BookOpen, Sparkles, Download } from 'lucide-react';

export const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50" style={{ minHeight: '250mm' }}>
    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white dark:bg-slate-800 rounded-2xl shadow-xl ring-1 ring-slate-100 dark:ring-slate-700 flex items-center justify-center mb-6 sm:mb-8 hover:scale-105 transition-transform duration-500 rotate-3">
      <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400 -rotate-3" />
    </div>
    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 sm:mb-4 tracking-tight">Your Empty Canvas</h2>
    <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md mb-6 sm:mb-8 leading-relaxed px-4">
      Use the sidebar to generate comprehensive study notes, or paste your rough notes to format them instantly.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-md opacity-80 px-4">
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center hover:-translate-y-1 transition-transform">
        <Sparkles className="w-6 h-6 text-amber-400 mb-2" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Powered</span>
      </div>
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center hover:-translate-y-1 transition-transform">
        <Download className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mb-2" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">PDF Ready</span>
      </div>
    </div>
  </div>
);
