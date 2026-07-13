import React, { useState } from 'react';
import { ArrowRight, Bot, Trophy, List, Brain, Type, ChevronUp, GraduationCap, BookText, Loader2 } from 'lucide-react';
import type { UPSCAnswerStyle, UPSCSubject } from '../services/ai/index';

interface NextQuestionPanelProps {
  defaultStyle: UPSCAnswerStyle;
  defaultMarks: number;
  defaultSubject: UPSCSubject;
  isGenerating?: boolean;
  onGenerate: (style: UPSCAnswerStyle, marks: number, customQuestion: string, subject: UPSCSubject) => void;
}

const STYLES: { id: UPSCAnswerStyle; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'auto',       icon: Bot,    label: 'AI Auto' },
  { id: 'topper',     icon: Trophy, label: "Topper's" },
  { id: 'bullets',    icon: List,   label: 'Bullet' },
  { id: 'analytical', icon: Brain,  label: 'Analytical' },
];

const MARKS_OPTIONS: { marks: number; pages: string }[] = [
  { marks: 10, pages: '~1½ pg' },
  { marks: 15, pages: '~2 pg' },
  { marks: 20, pages: '~3 pg' },
  { marks: 50, pages: '~5 pg' },
];

export const NextQuestionPanel: React.FC<NextQuestionPanelProps> = ({
  defaultStyle,
  defaultMarks,
  defaultSubject,
  isGenerating = false,
  onGenerate,
}) => {
  const [open, setOpen] = useState(true);
  const [style, setStyle] = useState<UPSCAnswerStyle>(defaultStyle);
  const [marks, setMarks] = useState<number>(defaultMarks);
  const [subject, setSubject] = useState<UPSCSubject>(defaultSubject);
  const [question, setQuestion] = useState('');

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 mt-6 mb-2 px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all duration-200 active:scale-[0.97] hover:shadow-xl hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)' }}
        >
          <ArrowRight className="w-4 h-4" />
          Next Question
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            Next Question Settings
          </h4>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Hide
          </button>
        </div>

        {/* Subject Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
            Subject
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSubject('gs')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                subject === 'gs'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
              <span>General Studies (GS)</span>
            </button>
            <button
              type="button"
              onClick={() => setSubject('hindi_literature')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                subject === 'hindi_literature'
                  ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <BookText className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Hindi Literature</span>
            </button>
          </div>
        </div>

        {/* Custom Question */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
            Question <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(leave empty = AI will create one)</span>
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Type the next question here… (AI will refine it into proper Hindi)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none resize-none"
          />
        </div>

        {/* Marks */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
            <Type className="w-3 h-3" /> Marks
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MARKS_OPTIONS.map(({ marks: m, pages }) => {
              const active = marks === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarks(m)}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold leading-none">{m}</span>
                  <span className={`text-[8px] leading-none ${active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>{pages}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Answer Style */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
            Answer Style
          </label>
          <div className="grid grid-cols-4 gap-2">
            {STYLES.map(({ id, icon: Icon, label }) => {
              const active = style === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStyle(id)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all ${
                    active
                      ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          disabled={isGenerating}
          onClick={() => {
            onGenerate(style, marks, question.trim(), subject);
            setQuestion('');
          }}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)' }}
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Writing the answer below…</>
          ) : (
            <><ArrowRight className="w-4 h-4" /> Generate Next Question</>
          )}
        </button>
      </div>
    </div>
  );
};
