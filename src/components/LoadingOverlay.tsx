import React from 'react';
import { ChevronDown } from 'lucide-react';
import { GenerationStatus } from '../types';
import { getScrollParent } from '../utils/editorUtils';

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
//
// Tapping it jumps to the very bottom of the document — where the answer
// currently being written is appearing, and where the queue/settings panels
// sit. During a long batch run that's the one place worth getting to, and
// scrolling a 200-page note by hand to reach it is its own chore.
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  if (status === GenerationStatus.IDLE) return null;

  const label = LABELS[status] ?? 'Generating…';

  const jumpToBottom = () => {
    const editor = document.querySelector('.editor-content');
    const scroller = editor ? getScrollParent(editor) : null;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    } else {
      // Page itself is the scroller (no inner overflow container).
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={jumpToBottom}
        title="Jump to the bottom — where it's being written"
        aria-label="Jump to the bottom of the document"
        className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg pl-3 pr-4 py-2 cursor-pointer transition-all hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.97]">
        <span className="relative flex w-5 h-5 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-600" />
          <span
            className="absolute inset-0 rounded-full border-2 border-t-blue-600 dark:border-t-blue-400 border-r-violet-500 dark:border-r-violet-400 border-b-transparent border-l-transparent animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
      </button>
    </div>
  );
};
