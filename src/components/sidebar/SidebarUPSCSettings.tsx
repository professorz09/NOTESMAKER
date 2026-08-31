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
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <BookOpen className="w-3 h-3" /> Subject
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setUpscSubject('gs')}
          className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all duration-200 text-center ${
            upscSubject === 'gs'
              ? 'bg-blue-900/40 border-blue-500/60 shadow-lg shadow-blue-900/20'
              : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${upscSubject === 'gs' ? 'bg-blue-500/30' : 'bg-white/5'}`}>
            <GraduationCap className={`w-3.5 h-3.5 ${upscSubject === 'gs' ? 'text-blue-300' : 'text-slate-500'}`} />
          </div>
          <div>
            <p className={`text-[10px] font-bold leading-none mb-0.5 ${upscSubject === 'gs' ? 'text-white' : 'text-slate-400'}`}>General Studies</p>
            <p className={`text-[9px] leading-tight ${upscSubject === 'gs' ? 'text-slate-400' : 'text-slate-600'}`}>GS Paper</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setUpscSubject('hindi_literature')}
          className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all duration-200 text-center ${
            upscSubject === 'hindi_literature'
              ? 'bg-orange-900/40 border-orange-500/60 shadow-lg shadow-orange-900/20'
              : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${upscSubject === 'hindi_literature' ? 'bg-orange-500/30' : 'bg-white/5'}`}>
            <BookText className={`w-3.5 h-3.5 ${upscSubject === 'hindi_literature' ? 'text-orange-300' : 'text-slate-500'}`} />
          </div>
          <div>
            <p className={`text-[10px] font-bold leading-none mb-0.5 ${upscSubject === 'hindi_literature' ? 'text-white' : 'text-slate-400'}`}>Hindi Literature</p>
            <p className={`text-[9px] leading-tight ${upscSubject === 'hindi_literature' ? 'text-slate-400' : 'text-slate-600'}`}>Optional Paper</p>
          </div>
        </button>
      </div>
      {upscSubject === 'hindi_literature' && (
        <p className="text-[9px] text-orange-400/70 px-1 leading-relaxed">
          📚 As per UPSC syllabus — Kabir, Tulsi, Premchand, Nirala, Mahadevi, etc.
        </p>
      )}
    </div>

    {/* Marks — answer length is sized by marks, not word count */}
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <Type className="w-3 h-3" /> Marks
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {MARKS_OPTIONS.map(({ marks, words }) => {
          const active = upscMarks === marks;
          return (
            <button
              key={marks}
              type="button"
              onClick={() => setUpscMarks(marks)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-white/4 border border-white/8 text-slate-400 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="text-xs font-bold leading-none">{marks}</span>
              <span className={`text-[8px] leading-none ${active ? 'text-blue-100' : 'text-slate-600'}`}>{words}</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* Answer Style */}
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <GraduationCap className="w-3 h-3" /> Answer Style
      </label>
      <div className="grid grid-cols-2 gap-2">
        {ANSWER_STYLES.map(({ id, icon: Icon, label, desc }) => {
          const active = upscAnswerStyle === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setUpscAnswerStyle(id)}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all duration-200 text-center ${
                active
                  ? 'bg-violet-900/40 border-violet-500/60 shadow-lg shadow-violet-900/20'
                  : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? 'bg-violet-500/30' : 'bg-white/5'}`}>
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-violet-300' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className={`text-[10px] font-bold leading-none mb-0.5 ${active ? 'text-white' : 'text-slate-400'}`}>{label}</p>
                <p className={`text-[9px] leading-tight ${active ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[9px] text-slate-600 px-1 leading-relaxed">{STYLE_HINTS[upscAnswerStyle]}</p>
    </div>

    {/* PYQ Question Bank — type a topic above, then find every distinct
        question-type UPSC PYQs have asked on it, tick the ones you want,
        and get model answers for just those. */}
    <div className="space-y-1.5 pt-1">
      <button
        type="button"
        onClick={onFindPYQQuestions}
        disabled={isFindingPyq}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isFindingPyq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
        {isFindingPyq ? 'Finding PYQ questions…' : 'Find PYQ Question Set for this Topic'}
      </button>
      <p className="text-[9px] text-slate-600 px-1 leading-relaxed">
        Type a topic above, then tap this to get several distinct PYQ-style questions on it — tick the ones you want and generate model answers for all of them together.
      </p>
    </div>
  </>
);
