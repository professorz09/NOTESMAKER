import React, { useState } from 'react';
import { ArrowRight, Bot, Trophy, List, Brain, Type, ChevronUp, GraduationCap, BookText, Loader2, Sparkles, ListPlus, X, Layers } from 'lucide-react';
import type { UPSCAnswerStyle, UPSCSubject } from '../services/ai/index';

interface StagedQuestion {
  id: string;
  text: string;
  style: UPSCAnswerStyle;
  marks: number;
  subject: UPSCSubject;
}

interface NextQuestionPanelProps {
  defaultStyle: UPSCAnswerStyle;
  defaultMarks: number;
  defaultSubject: UPSCSubject;
  isGenerating?: boolean;
  onGenerate: (style: UPSCAnswerStyle, marks: number, customQuestion: string, subject: UPSCSubject) => void;
  // Batch queue: adds one question (with whatever Subject/Marks/Style was
  // picked for it) to the queue below instead of generating it right now.
  // "Generate All" calls this once per staged question, so several land in
  // the queue together in one click instead of one at a time.
  onAddToQueue: (style: UPSCAnswerStyle, marks: number, question: string, subject: UPSCSubject) => void;
  queuedCount?: number;
}

const STYLES: { id: UPSCAnswerStyle; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'auto',       icon: Bot,      label: 'AI Auto' },
  { id: 'topper',     icon: Trophy,   label: "Topper's" },
  { id: 'classic',    icon: Sparkles, label: 'Classic' },
  { id: 'bullets',    icon: List,     label: 'Bullet' },
  { id: 'analytical', icon: Brain,    label: 'Analytical' },
];

const MARKS_OPTIONS: { marks: number; words: string }[] = [
  { marks: 10, words: '~400w' },
  { marks: 15, words: '~560w' },
  { marks: 20, words: '~825w' },
  { marks: 50, words: '~1350w' },
];

export const NextQuestionPanel: React.FC<NextQuestionPanelProps> = ({
  defaultStyle,
  defaultMarks,
  defaultSubject,
  isGenerating = false,
  onGenerate,
  onAddToQueue,
  queuedCount = 0,
}) => {
  const [open, setOpen] = useState(true);
  const [style, setStyle] = useState<UPSCAnswerStyle>(defaultStyle);
  const [marks, setMarks] = useState<number>(defaultMarks);
  const [subject, setSubject] = useState<UPSCSubject>(defaultSubject);
  const [question, setQuestion] = useState('');
  // Staged locally in this panel before being sent to the queue — lets the
  // student build up a whole list ("Add Another Question" repeatedly,
  // changing Subject/Marks/Style between each if they want) and then send
  // all of them to the queue together with one "Generate All" click.
  const [staged, setStaged] = useState<StagedQuestion[]>([]);

  const handleAddAnother = () => {
    if (!question.trim()) return;
    setStaged(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: question.trim(), style, marks, subject,
    }]);
    setQuestion('');
  };

  const removeStaged = (id: string) => setStaged(prev => prev.filter(s => s.id !== id));

  const handleGenerateAll = () => {
    const all = question.trim()
      ? [...staged, { id: 'current', text: question.trim(), style, marks, subject }]
      : staged;
    if (all.length === 0) return;
    all.forEach(item => onAddToQueue(item.style, item.marks, item.text, item.subject));
    setStaged([]);
    setQuestion('');
  };

  const totalStaged = staged.length + (question.trim() ? 1 : 0);

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 mt-6 mb-2 px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all duration-200 active:scale-[0.97] hover:shadow-xl hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)' }}
        >
          <ArrowRight className="w-4 h-4" />
          Next Question{queuedCount > 0 ? ` (${queuedCount} queued)` : ''}
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

        {/* Staged questions — built up via "Add Another Question" below,
            each keeping the Subject/Marks/Style it was staged with, then
            sent to the queue together with "Generate All". */}
        {staged.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5">
            <p className="text-[10px] font-bold tracking-widest text-cyan-700 dark:text-cyan-400 uppercase px-0.5">
              Staged ({staged.length})
            </p>
            <div className="space-y-1 max-h-[160px] overflow-y-auto pr-0.5">
              {staged.map((s) => (
                <div key={s.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70">
                  <span className="flex-1 min-w-0 text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{s.text}</span>
                  <button
                    type="button"
                    onClick={() => removeStaged(s.id)}
                    className="text-slate-400 hover:text-red-500 flex-shrink-0"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Marks */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
            <Type className="w-3 h-3" /> Marks
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MARKS_OPTIONS.map(({ marks: m, words }) => {
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
                  <span className={`text-[8px] leading-none ${active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>{words}</span>
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
          <div className="grid grid-cols-5 gap-2">
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

        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={isGenerating}
            onClick={() => {
              onGenerate(style, marks, question.trim(), subject);
              setQuestion('');
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)' }}
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Writing…</>
            ) : (
              <><ArrowRight className="w-4 h-4" /> Generate Now</>
            )}
          </button>
          <button
            disabled={isGenerating || !question.trim()}
            title={!question.trim() ? 'Type a question first' : 'Stage this question locally — pick different settings for the next one, then send them all with "Generate All"'}
            onClick={handleAddAnother}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
          >
            <Layers className="w-4 h-4" /> Add Another Question
          </button>
        </div>

        <button
          disabled={isGenerating || totalStaged === 0}
          title={totalStaged === 0 ? 'Stage at least one question first' : `Send all ${totalStaged} staged question(s) to the batch queue together`}
          onClick={handleGenerateAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)' }}
        >
          <ListPlus className="w-4 h-4" /> Generate All{totalStaged > 0 ? ` (${totalStaged})` : ''}{queuedCount > 0 ? ` — ${queuedCount} already queued` : ''}
        </button>

        {staged.length === 0 && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center -mt-1">
            Type a question, tap "Add Another Question" to stage it and type the next — then "Generate All" sends everything staged to the queue at once.
          </p>
        )}
      </div>
    </div>
  );
};
