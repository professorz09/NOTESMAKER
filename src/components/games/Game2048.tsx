import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { readBest, saveBest } from './storage';

const BEST_KEY = 'nmGameBest.2048';
const N = 4;

type Tile = { id: number; v: number; isNew?: boolean; merged?: boolean };
type Board = (Tile | null)[];

let uid = 1;

const addRandom = (b: Board): Board => {
  const empty = b.map((t, i) => (t ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return b;
  const next = b.slice();
  next[empty[Math.floor(Math.random() * empty.length)]] = { id: uid++, v: Math.random() < 0.9 ? 2 : 4, isNew: true };
  return next;
};

const fresh = (): Board => addRandom(addRandom(Array(N * N).fill(null)));

type Dir = 'left' | 'right' | 'up' | 'down';

/** Slides the board; returns the new board, points earned and whether anything moved. */
const slide = (b: Board, dir: Dir) => {
  const next: Board = Array(N * N).fill(null);
  let gained = 0, moved = false;
  for (let line = 0; line < N; line++) {
    // indices of this row/column in the order tiles travel towards
    const idx = Array.from({ length: N }, (_, k) => {
      const p = dir === 'left' || dir === 'up' ? k : N - 1 - k;
      return dir === 'left' || dir === 'right' ? line * N + p : p * N + line;
    });
    const tiles = idx.map(i => b[i]).filter((t): t is Tile => !!t);
    const out: Tile[] = [];
    for (let k = 0; k < tiles.length; k++) {
      if (k + 1 < tiles.length && tiles[k].v === tiles[k + 1].v) {
        const v = tiles[k].v * 2;
        out.push({ id: uid++, v, merged: true });
        gained += v;
        k++;
      } else {
        out.push({ id: tiles[k].id, v: tiles[k].v });
      }
    }
    idx.forEach((i, k) => {
      next[i] = out[k] ?? null;
      if ((b[i]?.id ?? null) !== (next[i]?.id ?? null)) moved = true;
    });
  }
  return { board: next, gained, moved };
};

const canMove = (b: Board) => {
  if (b.some(t => !t)) return true;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = b[r * N + c]!.v;
      if (c + 1 < N && b[r * N + c + 1]!.v === v) return true;
      if (r + 1 < N && b[(r + 1) * N + c]!.v === v) return true;
    }
  return false;
};

const tileClass = (v: number) => `nmg-tile nmg-t${v > 2048 ? 'max' : v}`;

export const Game2048: React.FC = () => {
  const [board, setBoard] = useState<Board>(fresh);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(BEST_KEY));
  const [won, setWon] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const over = !canMove(board);

  // Refs mirror the latest board/score so rapid key presses never act on a stale board.
  const boardRef = useRef(board);
  const scoreRef = useRef(0);
  const bestRef = useRef(best);

  const move = useCallback((dir: Dir) => {
    const prev = boardRef.current;
    if (!canMove(prev)) return;
    const { board: slid, gained, moved } = slide(prev, dir);
    if (!moved) return;
    const next = addRandom(slid);
    boardRef.current = next;
    setBoard(next);
    if (gained) {
      scoreRef.current += gained;
      setScore(scoreRef.current);
      if (scoreRef.current > bestRef.current) {
        bestRef.current = scoreRef.current;
        setBest(bestRef.current);
        saveBest(BEST_KEY, bestRef.current);
      }
    }
    if (slid.some(t => t && t.v >= 2048)) setWon(true);
  }, []);

  const restart = () => {
    const b = fresh();
    boardRef.current = b; scoreRef.current = 0;
    setBoard(b); setScore(0); setWon(false); setKeepGoing(false);
    hostRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => { hostRef.current?.focus({ preventScroll: true }); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    move(d);
  };

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    hostRef.current?.focus({ preventScroll: true });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };

  const showWin = won && !keepGoing;

  return (
    <div className="nmg-2048">
      <div className="nmg-scorebar">
        <div className="nmg-stat"><span className="nm-label">Score</span><b>{score}</b></div>
        <div className="nmg-stat"><span className="nm-label">Best</span><b>{best}</b></div>
        <button type="button" className="nm-icon-btn nmg-restart" onClick={restart} aria-label="New game" title="New game">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={hostRef}
        tabIndex={0}
        className="nmg-area nmg-board"
        aria-label="2048 board: swipe or use the arrow keys"
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => { start.current = null; }}
      >
        {board.map((t, i) => (
          <div key={i} className="nmg-cell">
            {t && (
              <div key={t.id} className={`${tileClass(t.v)}${t.isNew ? ' nmg-new' : ''}${t.merged ? ' nmg-merged' : ''}`}>
                {t.v}
              </div>
            )}
          </div>
        ))}
        {(over || showWin) && (
          <div className="nmg-board-over">
            <b className="nm-head">{showWin ? 'You made 2048!' : 'No more moves'}</b>
            <div className="flex gap-2">
              {showWin && <button type="button" className="nm-btn px-4 h-10 text-sm" onClick={() => setKeepGoing(true)}>Keep going</button>}
              <button type="button" className="nm-btn-primary px-4 h-10 text-sm" onClick={restart}>Play again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
