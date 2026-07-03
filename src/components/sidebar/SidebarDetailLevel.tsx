import React from 'react';
import { Gauge } from 'lucide-react';
import type { DetailLevel } from '../../services/ai/index';

interface SidebarDetailLevelProps {
  detailLevel: DetailLevel;
  setDetailLevel: (level: DetailLevel) => void;
  mode: 'topic' | 'text' | 'file' | 'transcript';
}

const LEVELS: { id: DetailLevel; label: string; desc: string }[] = [
  { id: 'normal',   label: 'Normal',   desc: 'तेज़ • एक बार में' },
  { id: 'medium',   label: 'Medium',   desc: '2 steps • गहरा' },
  { id: 'detailed', label: 'Detailed', desc: 'पूरा topic • विस्तृत' },
  { id: 'deep',     label: 'Deep',     desc: 'Pro+Flash • सबसे गहरा' },
];

const HELP: Record<Exclude<DetailLevel, 'normal'>, string> = {
  medium: 'AI पहले structure बनाएगा, फिर हर मुख्य heading को depth में expand करेगा।',
  detailed: 'AI पहले पूरा structure बनाएगा, फिर हर heading + sub-heading को गहराई में लिखेगा, और अंत में बचे बिंदु जोड़ेगा।',
  deep: 'सबसे बड़ी pipeline: Gemini 3 Pro topic→subtopics→sub-subtopics का analysis + structure बनाता है, Flash हर हिस्से को expand करता है, और Pro अंत में बचे बिंदु जोड़ता है। generation के समय screen पर live mindmap दिखेगा।',
};

export const SidebarDetailLevel: React.FC<SidebarDetailLevelProps> = ({ detailLevel, setDetailLevel, mode }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
      <Gauge className="w-3 h-3" /> Detail Level
    </label>
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
      {LEVELS.map(({ id, label, desc }) => {
        const isActive = detailLevel === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setDetailLevel(id)}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all duration-200 text-center ${
              isActive
                ? 'bg-gradient-to-b from-indigo-600 to-violet-700 text-white shadow-lg shadow-violet-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
            }`}
          >
            <span className="text-[11px] font-bold leading-none">{label}</span>
            <span className={`text-[8px] leading-tight ${isActive ? 'text-indigo-200/90' : 'text-slate-600'}`}>{desc}</span>
          </button>
        );
      })}
    </div>
    {mode === 'topic' && detailLevel !== 'normal' && (
      <p className="text-[9.5px] text-slate-600 leading-relaxed px-0.5">{HELP[detailLevel]}</p>
    )}
  </div>
);
