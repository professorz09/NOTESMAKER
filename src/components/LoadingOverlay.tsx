import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Gamepad2 } from 'lucide-react';
import { GenerationStatus } from '../types';
import { getScrollParent } from '../utils/editorUtils';
import { GameDock } from './GameDock';
import '../liquid-games.css';

const LABELS: Record<string, string> = {
  [GenerationStatus.GENERATING_CHAPTER]: 'Writing content…',
  [GenerationStatus.GENERATING_TABLE]: 'Building table…',
  [GenerationStatus.GENERATING_IMAGE]: 'Creating diagram…',
};

interface LoadingOverlayProps {
  status: GenerationStatus;
}

const fmt = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

// A compact, NON-BLOCKING progress pill pinned to the bottom of the screen.
// It intentionally does NOT cover the editor (no full-screen backdrop, and
// `pointer-events-none` on the wrapper) so the document stays visible and the
// user can keep reading / scrolling while an answer is being written below.
//
// Tapping it jumps to the very bottom of the document — where the answer
// currently being written is appearing, and where the queue/settings panels
// sit. During a long batch run that's the one place worth getting to, and
// scrolling a 200-page note by hand to reach it is its own chore.
//
// The small game button opens the GameDock (mini games for long waits).
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  const active = status !== GenerationStatus.IDLE;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const openRef = useRef(open);
  openRef.current = open;

  // Elapsed timer: starts when status leaves IDLE, keeps running across
  // CHAPTER/TABLE/IMAGE changes, resets once it is back to IDLE.
  useEffect(() => {
    if (!active) { setStartedAt(null); return; }
    const t0 = Date.now();
    setStartedAt(t0);
    setNow(t0);
    setDone(false);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  // Back to IDLE: if the games were open, show "Done — notes ready" for 2 s, then close.
  useEffect(() => {
    if (active || !openRef.current) { if (!active) setOpen(false); return; }
    setDone(true);
    const id = window.setTimeout(() => { setDone(false); setOpen(false); }, 2000);
    return () => window.clearTimeout(id);
  }, [active]);

  const close = useCallback(() => setOpen(false), []);

  if (!active && !done) return null;

  const label = done ? 'Done — notes ready' : (LABELS[status] ?? 'Generating…');

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
    // Bottom-RIGHT, not centred: centred it sat right on top of the line
    // being read at the bottom of the page, which is exactly where the eye
    // is during a long generation.
    <div className={`nmg-wrap${open ? ' is-open' : ''}`}>
      {open && <GameDock onClose={close} done={done} />}
      <div className={`nmg-pill nm-raised${done ? ' is-done' : ''}`}>
        <button
          type="button"
          onClick={jumpToBottom}
          title="Jump to the bottom — where it's being written"
          aria-label="Jump to the bottom of the document"
          className="nmg-pill-main">
          {done ? (
            <span className="nmg-ring-done"><Check className="w-3 h-3" /></span>
          ) : (
            <span className="nmg-ring" aria-hidden="true" />
          )}
          <span className="nmg-pill-label">{label}</span>
          {!done && startedAt !== null && (
            <span className="nmg-pill-time" aria-label="Elapsed time">{fmt(now - startedAt)}</span>
          )}
          <ChevronDown className="nmg-pill-chev w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`nmg-pill-game${open ? ' on' : ''}`}
          aria-label={open ? 'Hide games' : 'Play a game while you wait'}
          aria-expanded={open}
          title={open ? 'Hide games' : 'Play while you wait'}>
          <Gamepad2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
