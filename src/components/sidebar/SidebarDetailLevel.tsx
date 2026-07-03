import React from 'react';
import { Gauge, Globe2 } from 'lucide-react';
import type { DetailLevel } from '../../services/ai/index';

interface SidebarDetailLevelProps {
  detailLevel: DetailLevel;
  setDetailLevel: (level: DetailLevel) => void;
  mode: 'topic' | 'text' | 'file' | 'transcript';
  groundingEnabled: boolean;
  setGroundingEnabled: (v: boolean) => void;
}

const LEVELS: { id: DetailLevel; label: string; desc: string }[] = [
  { id: 'normal',   label: 'Normal',   desc: 'तेज़ • एक बार में' },
  { id: 'medium',   label: 'Medium',   desc: '2 steps • गहरा' },
  { id: 'detailed', label: 'Detailed', desc: 'पूरा topic • विस्तृत' },
  { id: 'deep',     label: 'Deep',     desc: 'Pro • सबसे गहरा' },
];

const HELP: Record<Exclude<DetailLevel, 'normal'>, string> = {
  medium: 'AI पहले structure बनाएगा, फिर हर मुख्य heading को depth में expand करेगा।',
  detailed: 'AI पहले पूरा structure बनाएगा, फिर हर heading + sub-heading को गहराई में लिखेगा, और अंत में बचे बिंदु जोड़ेगा।',
  deep: 'सबसे बड़ी pipeline: Gemini 3 Pro topic→subtopics→sub-subtopics का analysis + structure बनाता है, फिर हर हिस्से को भी Pro से गहराई में expand करता है, और अंत में बचे बिंदु जोड़ता है। generation के समय screen पर live mindmap दिखेगा।',
};

export const SidebarDetailLevel: React.FC<SidebarDetailLevelProps> = ({
  detailLevel, setDetailLevel, mode, groundingEnabled, setGroundingEnabled,
}) => (
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
    {mode === 'transcript' && (
      <p className="text-[9.5px] text-slate-600 leading-relaxed px-0.5">
        {detailLevel === 'normal'
          ? 'Normal: video को हिस्सों में बाँटकर सीधे detailed notes।'
          : 'AI पहले पूरे video का ढांचा (सभी topics + sub-points) बनाता है, screen पर live mindmap दिखता है, फिर हर हिस्से को structure के अनुसार ' + (detailLevel === 'deep' ? 'सबसे गहराई में (sub-points तक)' : detailLevel === 'detailed' ? 'गहराई में' : 'अच्छे से') + ' expand करता है।'}
      </p>
    )}
    {(mode === 'text' || mode === 'file') && (
      <p className="text-[9.5px] text-slate-600 leading-relaxed px-0.5">
        {detailLevel === 'normal'
          ? (mode === 'text' ? 'Normal: पूरा text सीधे detailed notes में बदल जाएगा।' : 'Normal: सभी files सीधे detailed notes में बदल जाएँगी।')
          : `AI पहले ${mode === 'text' ? 'पूरे content' : 'files'} का ढांचा बनाता है, screen पर live mindmap दिखता है, फिर हर हिस्से को ${detailLevel === 'deep' ? 'सबसे गहराई में' : detailLevel === 'detailed' ? 'गहराई में' : 'अच्छे से'} ${mode === 'file' ? 'उन्हीं files से' : ''} expand करता है — कुछ भी miss नहीं होता।`}
      </p>
    )}

    {/* Grounding — optional final pipeline step, only meaningful once a
        leveled (non-Normal) pipeline actually builds a node-by-node
        structure to scan. Off by default; behavior is 100% unchanged
        when off, in every mode including Normal. */}
    {detailLevel !== 'normal' && (
      <button
        type="button"
        onClick={() => setGroundingEnabled(!groundingEnabled)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
          groundingEnabled
            ? 'bg-sky-500/10 border-sky-500/40'
            : 'bg-white/3 border-white/8 hover:bg-white/6'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${groundingEnabled ? 'bg-sky-500/20' : 'bg-white/6'}`}>
          <Globe2 className={`w-4 h-4 ${groundingEnabled ? 'text-sky-400' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[11.5px] font-bold leading-tight ${groundingEnabled ? 'text-sky-300' : 'text-slate-300'}`}>Google Grounding</p>
          <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">
            generation पूरा होने के बाद, हर heading को scan करके जहाँ latest/current जानकारी चाहिए वहीं live search से जोड़ता है — बाकी को छोड़ देता है
          </p>
        </div>
        <div className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${groundingEnabled ? 'bg-sky-500' : 'bg-white/15'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${groundingEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </div>
      </button>
    )}
  </div>
);
