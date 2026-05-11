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

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  outputStyle, mode, isGenerating, canUndo,
  handleMainClick, handleClearCanvas, handleUndo,
}) => {
  const generateLabel = () => {
    if (isGenerating) return 'Generating...';
    if (outputStyle === 'table') return 'Generate Table';
    if (outputStyle === 'upsc') return 'Generate UPSC Answer';
    if (outputStyle === 'research') return 'Generate Research Paper';
    if (mode === 'text') return 'Format My Notes';
    if (mode === 'file') return 'Analyze Files';
    return 'Generate Notes';
  };

  return (
    <div className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-white/6 space-y-2 bg-[#0b1120]">
      <button
        type="button"
        onClick={handleMainClick}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] relative overflow-hidden group"
        style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)' }}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            {outputStyle === 'table'
              ? <TableIcon className="w-4 h-4 relative z-10" />
              : <Sparkles className="w-4 h-4 relative z-10" />
            }
            <span className="relative z-10">{generateLabel()}</span>
          </>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleClearCanvas}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-400/70 bg-red-500/6 border border-red-500/10 hover:bg-red-500/12 hover:text-red-300 hover:border-red-500/20 transition-all"
        >
          <Eraser className="w-3.5 h-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo || isGenerating}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-400/70 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-slate-200 hover:border-white/14 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>

      <p className="text-center text-[9px] text-slate-700 font-medium tracking-wider uppercase" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        AI Powered • V2.1 Pro
      </p>
    </div>
  );
};
