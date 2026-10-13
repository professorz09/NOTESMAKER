import React from 'react';
import { Sparkles, SlidersHorizontal, Wand2, ArrowRight, ArrowLeft } from 'lucide-react';
import '../liquid-top.css';

interface EmptyStateProps {
  onGetStarted?: () => void;
}

const steps = [
  { icon: Sparkles, title: 'Input', desc: 'Topic · Text · File' },
  { icon: SlidersHorizontal, title: 'Style', desc: 'Notes · UPSC · Depth' },
  { icon: Wand2, title: 'Generate', desc: 'AI writes it' },
];

// The app mark (open book + cap), drawn in ink on the mint tile.
const AppMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({ onGetStarted }) => (
  <div
    className="nm-empty flex flex-col items-center justify-center text-center px-2 py-10 sm:py-16 select-none min-h-[72vh] md:min-h-[250mm]"
  >
    {/* Glossy mint app tile */}
    <div className="nm-appicon w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] rounded-[24px] sm:rounded-[28px] mb-6 sm:mb-7">
      <AppMark size={36} />
    </div>

    <h2 className="nm-head font-extrabold tracking-tight">
      UPSC Notes Maker
    </h2>
    <p className="nm-muted max-w-[19rem] sm:max-w-sm">
      Any topic, text, file or video — into clean study notes.
    </p>

    {/* 3-step guide */}
    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[20rem] sm:max-w-md">
      {steps.map(({ icon: Icon, title, desc }, i) => (
        <div key={title} className="nm-step">
          <div className="nm-step-ico">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="nm-step-num">0{i + 1}</span>
            <span className="nm-head text-[13px] sm:text-sm font-bold leading-tight">{title}</span>
            <span className="nm-muted text-[10.5px] sm:text-xs leading-snug">{desc}</span>
          </div>
        </div>
      ))}
    </div>

    {/* CTA — a real tappable button on mobile (sidebar is hidden there);
        a subtle hint on desktop where the sidebar is always visible. */}
    <button
      type="button"
      onClick={onGetStarted}
      className="nm-btn-primary nm-focus lg:hidden mt-8 h-12 px-7 text-sm"
    >
      Get Started
      <ArrowRight className="w-4 h-4" />
    </button>
    <p className="nm-hint nm-muted hidden lg:flex items-center gap-2 font-semibold tracking-wide">
      <ArrowLeft className="w-3.5 h-3.5" /> Use the sidebar to get started
    </p>
  </div>
);
