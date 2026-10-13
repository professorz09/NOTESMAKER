import React from 'react';
import { Sparkles, Table as TableIcon, Eraser, Undo } from 'lucide-react';

interface SidebarFooterProps {
  outputStyle: 'notes' | 'upsc' | 'essay' | 'research' | 'table';
  mode: 'topic' | 'text' | 'file' | 'transcript' | 'currentAffairs';
  isGenerating: boolean;
  canUndo: boolean;
  handleMainClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleClearCanvas: () => void;
  handleUndo: () => void;
}

const GENERATE_LABELS: Record<string, string> = {
  table: 'Generate Table',
  upsc: 'Generate UPSC Answer',
  essay: 'Generate Essay',
  research: 'Generate Research Paper',
};

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  outputStyle, mode, isGenerating, canUndo,
  handleMainClick, handleClearCanvas, handleUndo,
}) => {
  const label = isGenerating
    ? 'Generating…'
    : mode === 'currentAffairs'
      ? 'Generate Current Affairs Notes'
      : mode === 'transcript'
        ? 'Start Notes Making'
        : GENERATE_LABELS[outputStyle] ?? 'Generate Notes';

  return (
    <div
      className="flex-shrink-0 px-4 pt-3 border-t nms-divider space-y-2"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
    >
      {/* Generate button */}
      <button
        type="button"
        onClick={handleMainClick}
        disabled={isGenerating}
        className="nm-btn-primary nms-cta w-full min-h-[50px] px-4 text-[15px]"
      >
        {isGenerating ? (
          <>
            <span className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'rgba(4,38,29,0.3)', borderTopColor: 'currentColor' }} />
            <span className="truncate">{label}</span>
          </>
        ) : (
          <>
            {outputStyle === 'table'
              ? <TableIcon className="w-[18px] h-[18px] flex-shrink-0" />
              : <Sparkles className="w-[18px] h-[18px] flex-shrink-0" />
            }
            <span className="truncate">{label}</span>
          </>
        )}
      </button>

      {/* Clear + Undo — secondary, so they stay quiet next to Generate */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleClearCanvas}
          className="nms-ghost danger"
        >
          <Eraser className="w-4 h-4" />
          Clear page
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo || isGenerating}
          className="nms-ghost"
        >
          <Undo className="w-4 h-4" />
          Undo
        </button>
      </div>
    </div>
  );
};
