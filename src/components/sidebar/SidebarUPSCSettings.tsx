import React from 'react';
import { GraduationCap, Bot, Trophy, List, Brain, Type, BookOpen, BookText, Sparkles, ListChecks, Loader2 } from 'lucide-react';
import type { UPSCAnswerStyle, UPSCSubject } from '../../services/ai/index';

interface SidebarUPSCSettingsProps {
  upscMarks: number;
  setUpscMarks: (marks: number) => void;
  upscAnswerStyle: UPSCAnswerStyle;
  setUpscAnswerStyle: (s: UPSCAnswerStyle) => void;
  upscSubject: UPSCSubject;
  setUpscSubject: (s: UPSCSubject) => void;
  onFindPYQQuestions: () => void;
  isFindingPyq: boolean;
}

// UPSC answers are sized by MARKS — each targets a word count, not a page
// estimate (an editable canvas doesn't paginate like a physical answer
// sheet, so "pages" was a confusing, inaccurate proxy for length).
const MARKS_OPTIONS: { marks: number; words: string }[] = [
  { marks: 10, words: '~400 words' },
  { marks: 15, words: '~560 words' },
  { marks: 20, words: '~825 words' },
  { marks: 50, words: '~1350 words' },
];

const ANSWER_STYLES: { id: UPSCAnswerStyle; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }[] = [
  { id: 'auto',       icon: Bot,      label: 'AI Auto',    desc: 'AI decides all'  },
  { id: 'topper',     icon: Trophy,   label: "Topper's",   desc: 'Adaptive smart'  },
  { id: 'classic',    icon: Sparkles, label: 'Classic',    desc: 'Hook→body→end'   },
  { id: 'bullets',    icon: List,     label: 'Bullet',     desc: 'Scannable pts'   },
  { id: 'analytical', icon: Brain,    label: 'Analytical', desc: 'Deep critical'   },
];

const STYLE_HINTS: Record<UPSCAnswerStyle, string> = {
  auto:       '🤖 Simple prompt — AI freely chooses structure, evidence & style',
  topper:     '🏆 Adaptive prompt — structure & evidence match the subject/topic',
  classic:    '✨ Fixed intro (quote/example/definition) → body → nishkarsh — example-rich, top-level',
  bullets:    '📋 Bullet-heavy — dense, scannable, ideal for quick exam writing',
  analytical: '🔍 Deep analysis — weighs multiple angles, takes a clear stand',
};

export const SidebarUPSCSettings: React.FC<SidebarUPSCSettingsProps> = ({
  upscMarks, setUpscMarks,
  upscAnswerStyle, setUpscAnswerStyle,
  upscSubject, setUpscSubject,
  onFindPYQQuestions, isFindingPyq,
}) => (
  <>
    {/* Subject Type */}
    <div className="space-y-2">
      <label className="nm-label nms-title">
        <BookOpen /> Subject
      </label>
      <div className="nm-seg nms-tight">
        <button
          type="button"
          onClick={() => setUpscSubject('gs')}
          aria-pressed={upscSubject === 'gs'}
          title="GS Paper"
        >
          <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">General Studies</span>
        </button>
        <button
          type="button"
          onClick={() => setUpscSubject('hindi_literature')}
          aria-pressed={upscSubject === 'hindi_literature'}
          title="Optional Paper"
        >
          <BookText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Hindi Literature</span>
        </button>
      </div>
      {upscSubject === 'hindi_literature' && (
        <p className="nms-help">
          📚 As per UPSC syllabus — Kabir, Tulsi, Premchand, Nirala, Mahadevi, etc.
        </p>
      )}
    </div>

    {/* Marks — answer length is sized by marks, not word count */}
    <div className="space-y-2">
      <label className="nm-label nms-title">
        <Type /> Marks
      </label>
      <div className="nm-seg nms-two">
        {MARKS_OPTIONS.map(({ marks, words }) => (
          <button
            key={marks}
            type="button"
            onClick={() => setUpscMarks(marks)}
            aria-pressed={upscMarks === marks}
          >
            <span className="text-[14px] font-extrabold leading-none">{marks}</span>
            <span className="nms-sub">{words}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Answer Style */}
    <div className="space-y-2">
      <label className="nm-label nms-title">
        <GraduationCap /> Answer Style
      </label>
      <div className="grid grid-cols-3 gap-2">
        {ANSWER_STYLES.map(({ id, icon: Icon, label, desc }) => {
          const active = upscAnswerStyle === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setUpscAnswerStyle(id)}
              aria-pressed={active}
              title={desc}
              className={`nm-tile nms-tile ${active ? 'on' : ''}`}
            >
              <span className="nm-tile-ico"><Icon /></span>
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="nms-help">{STYLE_HINTS[upscAnswerStyle]}</p>
    </div>

    {/* PYQ Question Bank — type a topic above, then find every distinct
        question-type UPSC PYQs have asked on it, tick the ones you want,
        and get model answers for just those. */}
    <div className="space-y-1.5 pt-1">
      <button
        type="button"
        onClick={onFindPYQQuestions}
        disabled={isFindingPyq}
        className="nm-btn w-full min-h-[44px] px-3 text-[13px]"
      >
        {isFindingPyq ? <Loader2 className="w-4 h-4 animate-spin nm-accent-text" /> : <ListChecks className="w-4 h-4 nm-accent-text" />}
        {isFindingPyq ? 'Finding PYQ questions…' : 'Find PYQ Question Set for this Topic'}
      </button>
      <p className="nms-help">
        Type a topic above, then tap this to get several distinct PYQ-style questions on it — tick the ones you want and generate model answers for all of them together.
      </p>
    </div>
  </>
);
