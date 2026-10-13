import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { CatchGame } from './games/CatchGame';
import { Game2048 } from './games/Game2048';
import { QuizFlash } from './games/QuizFlash';
import '../liquid-games.css';

type GameId = 'catch' | '2048' | 'quiz';
const GAMES: { id: GameId; label: string }[] = [
  { id: 'catch', label: 'Catch' },
  { id: '2048', label: '2048' },
  { id: 'quiz', label: 'Quiz flash' },
];
const LAST_KEY = 'nmGameLast';

interface GameDockProps {
  onClose: () => void;
  /** Generation just finished: show the "notes ready" state (the dock closes itself shortly after). */
  done?: boolean;
}

// Mini games to play while notes are being written. A glass card above the
// progress pill on desktop; a full-width bottom sheet on phones.
export const GameDock: React.FC<GameDockProps> = ({ onClose, done = false }) => {
  const [game, setGame] = useState<GameId>(() => {
    try {
      const v = localStorage.getItem(LAST_KEY);
      return v === 'catch' || v === '2048' || v === 'quiz' ? v : 'catch';
    } catch {
      return 'catch';
    }
  });

  const pick = (id: GameId) => {
    setGame(id);
    try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section className="nmg-dock nm-panel nm-pop" role="dialog" aria-label="Play while you wait">
      <header className="nmg-dock-head">
        <h2 className="nm-head">Play while you wait</h2>
        <button type="button" className="nm-icon-btn" onClick={onClose} aria-label="Close games" title="Close">
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="nm-seg" role="tablist" aria-label="Choose a game">
        {GAMES.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={game === g.id} onClick={() => pick(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="nmg-stage" role="tabpanel">
        {game === 'catch' && <CatchGame />}
        {game === '2048' && <Game2048 />}
        {game === 'quiz' && <QuizFlash />}
        {done && (
          <div className="nmg-done" role="status">
            <span className="nmg-done-ico"><Check className="w-5 h-5" /></span>
            <b className="nm-head">Done — notes ready</b>
          </div>
        )}
      </div>
    </section>
  );
};
