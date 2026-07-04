import React from 'react';
import { Sparkles, SlidersHorizontal, Wand2, ArrowRight, ArrowLeft } from 'lucide-react';

interface EmptyStateProps {
  onGetStarted?: () => void;
}

const steps = [
  {
    icon: Sparkles,
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-100 dark:border-violet-800/40',
    title: 'Choose input',
    desc: 'Topic · Text · File · Transcript',
  },
  {
    icon: SlidersHorizontal,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-100 dark:border-blue-800/40',
    title: 'Style & depth',
    desc: 'Notes · UPSC · Normal→Deep',
  },
  {
    icon: Wand2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-100 dark:border-emerald-800/40',
    title: 'Generate',
    desc: 'AI writes it for you',
  },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onGetStarted }) => (
  <div
    className="flex flex-col items-center justify-center text-center px-4 py-10 sm:py-16 select-none"
    style={{ minHeight: '250mm' }}
  >
    {/* Logo mark */}
    <div className="relative mb-6 sm:mb-9">
      <div
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-[22px] sm:rounded-[28px] flex items-center justify-center shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #6d28d9 100%)',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 12px 40px rgba(29,78,216,0.35)',
        }}
      >
        <svg width="44" height="44" viewBox="0 0 26 26" fill="none">
          <path d="M13 7 C10 6 7 6.5 5 7.5 L5 20 C7 19 10 18.5 13 19.5 Z" fill="white" opacity="0.55"/>
          <path d="M13 7 C16 6 19 6.5 21 7.5 L21 20 C19 19 16 18.5 13 19.5 Z" fill="white" opacity="0.75"/>
          <line x1="13" y1="7" x2="13" y2="19.5" stroke="white" strokeWidth="1.2" opacity="0.9"/>
          <path d="M13 3.5 L4.5 7 L13 10.5 L21.5 7 Z" fill="white" opacity="0.9"/>
          <circle cx="21.5" cy="7" r="1.3" fill="#a78bfa"/>
          <path d="M20 2.5 L20.5 4 L22 4.5 L20.5 5 L20 6.5 L19.5 5 L18 4.5 L19.5 4 Z" fill="#c4b5fd" opacity="0.9"/>
        </svg>
      </div>
      <div className="absolute inset-0 rounded-[22px] sm:rounded-[28px] border-2 border-blue-400/20 animate-ping" style={{ animationDuration: '2.5s' }} />
    </div>

    {/* Heading */}
    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 sm:mb-3"
      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      UPSC Notes Maker
    </h2>
    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-sm sm:max-w-md mb-7 sm:mb-10 leading-relaxed px-2">
      Turn any topic, pasted text, file, class transcript or <strong className="font-semibold text-slate-600 dark:text-slate-300">YouTube link</strong> into detailed, structured study notes — with tables & diagrams.
    </p>

    {/* 3-step guide */}
    <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-xs sm:max-w-lg">
      {steps.map(({ icon: Icon, color, bg, border, title, desc }) => (
        <div
          key={title}
          className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl border ${bg} ${border} transition-transform hover:-translate-y-0.5`}
        >
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${bg} ${border} border flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">{title}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 leading-tight">{desc}</p>
          </div>
        </div>
      ))}
    </div>

    {/* CTA — a real tappable button on mobile (sidebar is hidden there);
        a subtle hint on desktop where the sidebar is always visible. */}
    <button
      type="button"
      onClick={onGetStarted}
      className="lg:hidden mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg shadow-blue-900/30 active:scale-[0.97] transition-transform"
      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' }}
    >
      Get Started
      <ArrowRight className="w-4 h-4" />
    </button>
    <p className="hidden lg:flex items-center gap-2 mt-7 text-xs text-slate-400 dark:text-slate-600 font-medium tracking-wide">
      <ArrowLeft className="w-3.5 h-3.5" /> Use the sidebar to get started
    </p>
  </div>
);
