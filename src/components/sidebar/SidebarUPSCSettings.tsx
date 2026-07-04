import React from 'react';
import { GraduationCap, Bot, Trophy, List, Brain, Type, BookOpen, BookText } from 'lucide-react';
import type { UPSCAnswerStyle, UPSCSubject } from '../../services/ai/index';

interface SidebarUPSCSettingsProps {
  wordLimit: number;
  setWordLimit: (limit: number) => void;
  upscAnswerStyle: UPSCAnswerStyle;
  setUpscAnswerStyle: (s: UPSCAnswerStyle) => void;
  upscSubject: UPSCSubject;
  setUpscSubject: (s: UPSCSubject) => void;
}

const WORD_LIMITS = [150, 250, 500, 1000];

const ANSWER_STYLES: { id: UPSCAnswerStyle; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }[] = [
  { id: 'auto',       icon: Bot,    label: 'AI Auto',    desc: 'AI decides all'  },
  { id: 'topper',     icon: Trophy, label: "Topper's",   desc: 'Adaptive smart'  },
  { id: 'bullets',    icon: List,   label: 'Bullet',     desc: 'Scannable pts'   },
  { id: 'analytical', icon: Brain,  label: 'Analytical', desc: 'Deep critical'   },
];

const STYLE_HINTS: Record<UPSCAnswerStyle, string> = {
  auto:       '🤖 Simple prompt — AI freely chooses structure, evidence & style',
  topper:     '🏆 Adaptive prompt — structure & evidence match the subject/topic',
  bullets:    '📋 Bullet-heavy — dense, scannable, ideal for quick exam writing',
  analytical: '🔍 Deep analysis — weighs multiple angles, takes a clear stand',
};

export const SidebarUPSCSettings: React.FC<SidebarUPSCSettingsProps> = ({
  wordLimit, setWordLimit,
  upscAnswerStyle, setUpscAnswerStyle,
  upscSubject, setUpscSubject,
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

    {/* Word Limit */}
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <Type className="w-3 h-3" /> Word Limit
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {WORD_LIMITS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWordLimit(w)}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              wordLimit === w
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-white/4 border border-white/8 text-slate-400 hover:bg-white/8 hover:text-white'
            }`}
          >
            {w}
          </button>
        ))}
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
  </>
);
