import React, { useState } from 'react';
import { ArrowRight, Bot, Trophy, List, Brain, Type, ChevronUp, GraduationCap, BookText, Loader2, Sparkles, ListPlus } from 'lucide-react';
import type { UPSCAnswerStyle, UPSCSubject } from '../services/ai/index';
import '../liquid-panels.css';

interface NextQuestionPanelProps {
  defaultStyle: UPSCAnswerStyle;
  defaultMarks: number;
  defaultSubject: UPSCSubject;
  isGenerating?: boolean;
  onGenerate: (style: UPSCAnswerStyle, marks: number, customQuestion: string, subject: UPSCSubject) => void;
  // Batch queue: adds this exact question (with the Subject/Marks/Style
  // picked right here) to the queue below instead of generating it right
  // now — lets the student line up several next-questions in one go and
  // walk away while they're written one at a time in the background.
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

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 mt-6 mb-2 px-4">
        <button
          onClick={() => setOpen(true)}
          className="nm-btn-primary px-6 min-h-[48px] text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          Next Question{queuedCount > 0 ? ` (${queuedCount} queued)` : ''}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2 mx-auto max-w-2xl px-4">
      <div className="nm-panel nm-pop rounded-[24px] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="nm-head text-sm font-bold flex items-center gap-2.5">
            <span className="nm-ico-badge !w-8 !h-8 !rounded-[10px]"><ArrowRight className="w-4 h-4" /></span>
            Next Question Settings
          </h4>
          <button
            onClick={() => setOpen(false)}
            className="nm-chip min-h-[36px]"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Hide
          </button>
        </div>

        {/* Subject Selector */}
        <div className="space-y-2">
          <label className="nm-label block">
            Subject
          </label>
          <div className="nm-seg">
            <button
              type="button"
              aria-pressed={subject === 'gs'}
              onClick={() => setSubject('gs')}
              className="nm-focus !min-h-[40px] !text-xs"
            >
              <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">General Studies (GS)</span>
            </button>
            <button
              type="button"
              aria-pressed={subject === 'hindi_literature'}
              onClick={() => setSubject('hindi_literature')}
              className="nm-focus !min-h-[40px] !text-xs"
            >
              <BookText className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Hindi Literature</span>
            </button>
          </div>
        </div>

        {/* Custom Question */}
        <div className="space-y-2">
          <label className="nm-label block">
            Question <span className="normal-case tracking-normal font-medium">(leave empty = AI will create one)</span>
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Type the next question here… (AI will refine it into proper Hindi)"
            className="nm-input resize-none"
          />
        </div>

        {/* Marks */}
        <div className="space-y-2">
          <label className="nm-label flex items-center gap-1.5">
            <Type className="w-3 h-3" /> Marks
          </label>
          <div className="nm-seg">
            {MARKS_OPTIONS.map(({ marks: m, words }) => {
              const active = marks === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMarks(m)}
                  className="nm-focus !flex-col !gap-0.5 !min-h-[44px] !px-1"
                >
                  <span className="text-xs font-bold leading-none">{m}</span>
                  <span className={`text-[9px] font-semibold leading-none ${active ? 'opacity-75' : 'opacity-70'}`}>{words}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Answer Style */}
        <div className="space-y-2">
          <label className="nm-label block">
            Answer Style
          </label>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {STYLES.map(({ id, icon: Icon, label }) => {
              const active = style === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStyle(id)}
                  aria-pressed={active}
                  className={`nm-tile !px-0 !py-2 !rounded-2xl min-w-0 ${active ? 'on' : ''}`}
                >
                  <span className="nm-tile-ico !w-7 !h-7 !rounded-[9px]"><Icon className="w-3.5 h-3.5" /></span>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold leading-none truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
          <button
            disabled={isGenerating}
            onClick={() => {
              onGenerate(style, marks, question.trim(), subject);
              setQuestion('');
            }}
            className="nm-btn-primary px-3 min-h-[48px] text-sm whitespace-nowrap"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Writing…</>
            ) : (
              <><ArrowRight className="w-4 h-4" /> Generate Now</>
            )}
          </button>
          <button
            disabled={isGenerating || !question.trim()}
            title={!question.trim() ? 'Type a question first — the queue needs the exact question text' : 'Add this question (with the Subject/Marks/Style above) to the batch queue instead of generating it right now'}
            onClick={() => {
              onAddToQueue(style, marks, question.trim(), subject);
              setQuestion('');
            }}
            className="nm-btn px-3 min-h-[48px] text-sm whitespace-nowrap"
          >
            <ListPlus className="w-4 h-4" /> Add to Queue{queuedCount > 0 ? ` (${queuedCount})` : ''}
          </button>
        </div>
        {!question.trim() && (
          <p className="nm-muted text-[11px] leading-snug text-center -mt-1">
            Type a question above, then "Add to Queue" to line up several without waiting for each one.
          </p>
        )}
      </div>
    </div>
  );
};
