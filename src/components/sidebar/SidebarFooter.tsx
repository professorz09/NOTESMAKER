import React from 'react';
import { Sparkles, Table as TableIcon, Eraser, Undo } from 'lucide-react';

interface SidebarFooterProps {
  outputStyle: 'notes' | 'upsc' | 'research' | 'table';
  mode: 'topic' | 'text' | 'file';
  isGenerating: boolean;
  canUndo: boolean;
  handleMainClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleClearCanvas: () => void;
  handleUndo: () => void;
}

const GENERATE_LABELS: Record<string, string> = {
  table: 'Generate Table',
  upsc: 'Generate UPSC Answer',
  research: 'Generate Research Paper',
};

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  outputStyle, mode, isGenerating, canUndo,
  handleMainClick, handleClearCanvas, handleUndo,
}) => {
  const label = isGenerating
    ? 'Generating…'
    : GENERATE_LABELS[outputStyle] ?? (mode === 'text' ? 'Format My Notes' : mode === 'file' ? 'Analyze Files' : 'Generate Notes');

  return (
    <div
      className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-white/6 space-y-2.5 bg-[#0b1120]"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
    >
      {/* Generate button */}
      <button
        type="button"
        onClick={handleMainClick}
        disabled={isGenerating}
        className="w-full relative flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white overflow-hidden transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] group"
        style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' }}
      >
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {/* Shimmer during generation */}
        {isGenerating && (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s linear infinite',
            }}
          />
        )}
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin relative z-10" />
            <span className="relative z-10 animate-pulse">{label}</span>
          </>
        ) : (
          <>
            {outputStyle === 'table'
              ? <TableIcon className="w-4 h-4 relative z-10" />
              : <Sparkles className="w-4 h-4 relative z-10" />
            }
            <span className="relative z-10">{label}</span>
          </>
        )}
      </button>

      {/* Clear + Undo */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleClearCanvas}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-400/80 bg-red-500/8 border border-red-500/12 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/25 transition-all active:scale-[0.97]"
        >
          <Eraser className="w-3.5 h-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo || isGenerating}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400/80 bg-white/4 border border-white/8 hover:bg-white/10 hover:text-slate-200 hover:border-white/16 transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>

      <p className="text-center text-[9px] text-slate-700 font-medium tracking-wider uppercase">
        AI Powered • Professor UPSC V2.1
      </p>
    </div>
  );
};
