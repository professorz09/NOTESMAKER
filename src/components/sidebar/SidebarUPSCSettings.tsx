import React from 'react';
import { GraduationCap, Bot, Trophy, List, Brain, Type } from 'lucide-react';
import type { UPSCAnswerStyle } from '../../services/ai/index';

interface SidebarUPSCSettingsProps {
  wordLimit: number;
  setWordLimit: (limit: number) => void;
  upscAnswerStyle: UPSCAnswerStyle;
  setUpscAnswerStyle: (s: UPSCAnswerStyle) => void;
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
}) => (
  <>
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
