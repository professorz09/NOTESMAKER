import React, { useEffect, useRef, useState } from 'react';
import { Check, Flame, X } from 'lucide-react';
import { readBest, saveBest } from './storage';
import { FACTS } from './quizFacts';

const BEST_KEY = 'nmGameBest.quiz';

const shuffled = () => {
  const order = FACTS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

export const QuizFlash: React.FC = () => {
  const [order, setOrder] = useState(shuffled);
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => readBest(BEST_KEY));
  const nextRef = useRef<HTMLButtonElement>(null);

  const fact = FACTS[order[pos]];
  const answered = answer !== null;
  const right = answered && answer === fact.answer;

  const choose = (v: boolean) => {
    if (answered) return;
    setAnswer(v);
    if (v === fact.answer) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) { setBest(s); saveBest(BEST_KEY, s); }
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    setAnswer(null);
    if (pos + 1 >= order.length) { setOrder(shuffled()); setPos(0); }
    else setPos(pos + 1);
  };

  useEffect(() => { if (answered) nextRef.current?.focus({ preventScroll: true }); }, [answered]);

  return (
    <div className="nmg-quiz">
      <div className="nmg-scorebar">
        <span className="nm-badge">{fact.subject}</span>
        <span className="nmg-streak" title="Streak" aria-label={`Streak ${streak}, best ${best}`}>
          <Flame className="w-3.5 h-3.5" /> {streak}
          <span className="nm-muted">· best {best}</span>
        </span>
      </div>
      <div key={order[pos]} className={`nmg-card nmg-area${answered ? (right ? ' is-right' : ' is-wrong') : ''}`}>
        <p className="nmg-q nm-head">{fact.q}</p>
        {answered && (
          <div className="nmg-explain" role="status">
            <b className={right ? 'nmg-ok' : 'nmg-bad'}>
              {right ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {right ? 'Right' : 'Not quite'} — {fact.answer ? 'True' : 'False'}
            </b>
            <span className="nm-muted">{fact.why}</span>
          </div>
        )}
      </div>
      {answered ? (
        <button ref={nextRef} type="button" className="nm-btn-primary nmg-wide" onClick={next}>Next fact</button>
      ) : (
        <div className="nmg-tf">
          <button type="button" className="nm-btn nmg-true" onClick={() => choose(true)}><Check className="w-4 h-4" /> True</button>
          <button type="button" className="nm-btn nmg-false" onClick={() => choose(false)}><X className="w-4 h-4" /> False</button>
        </div>
      )}
    </div>
  );
};
