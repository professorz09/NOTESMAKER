import React from 'react';
import { Gauge } from 'lucide-react';
import type { DetailLevel } from '../../services/ai/index';
import { SidebarGroundingToggle } from './SidebarGroundingToggle';

interface SidebarDetailLevelProps {
  detailLevel: DetailLevel;
  setDetailLevel: (level: DetailLevel) => void;
  mode: 'topic' | 'text' | 'file' | 'transcript' | 'currentAffairs';
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
  medium: "AI first builds the structure, then expands each main heading — but not to a uniform depth: it judges how exam-relevant each part actually is and goes deeper on high-yield sections, lighter on minor ones, instead of treating every heading the same.",
  detailed: 'Same pipeline as Deep — Gemini 3 Pro analyses topic → subtopics → sub-subtopics and builds the structure, then Flash writes each part in depth, and Pro adds any remaining points. Faster than Deep, same structure.',
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
      <SidebarGroundingToggle groundingEnabled={groundingEnabled} setGroundingEnabled={setGroundingEnabled} />
    )}
  </div>
);
