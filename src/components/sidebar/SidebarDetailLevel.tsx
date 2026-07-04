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
  { id: 'normal',   label: 'Normal',   desc: 'Fast • single pass' },
  { id: 'medium',   label: 'Medium',   desc: '2 steps • deeper' },
  { id: 'detailed', label: 'Detailed', desc: 'Full topic • detailed' },
  { id: 'deep',     label: 'Deep',     desc: 'Pro • deepest' },
];

const HELP: Record<Exclude<DetailLevel, 'normal'>, string> = {
  medium: 'AI first builds the structure, then expands each main heading in depth.',
  detailed: 'AI first builds the full structure, then writes each heading + sub-heading in depth, and finally adds any remaining points.',
  deep: 'The biggest pipeline: Gemini 3 Pro analyses topic → subtopics → sub-subtopics and builds the structure, then expands every part in depth with Pro, and finally adds any remaining points. A live mind map is shown on screen during generation.',
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
          ? 'Normal: the video is split into parts and turned straight into detailed notes.'
          : 'AI first builds the whole video\'s structure (all topics + sub-points), shows a live mind map on screen, then expands each part ' + (detailLevel === 'deep' ? 'to the deepest level (down to sub-points)' : detailLevel === 'detailed' ? 'in depth' : 'well') + ' as per the structure.'}
      </p>
    )}
    {(mode === 'text' || mode === 'file') && (
      <p className="text-[9.5px] text-slate-600 leading-relaxed px-0.5">
        {detailLevel === 'normal'
          ? 'Normal: pasted text or uploaded files are turned straight into detailed notes.'
          : `AI first builds the structure of all your content (text/files), shows a live mind map on screen, then expands each part ${detailLevel === 'deep' ? 'to the deepest level' : detailLevel === 'detailed' ? 'in depth' : 'well'} — nothing is missed.`}
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
            After generation, scans every heading and adds live-search info only where latest/current data is needed — everything else is left untouched
          </p>
        </div>
        <div className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${groundingEnabled ? 'bg-sky-500' : 'bg-white/15'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${groundingEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </div>
      </button>
    )}
  </div>
);
