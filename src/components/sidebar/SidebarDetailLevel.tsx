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
    <label className="nm-label nms-title">
      <Gauge /> Detail Level
    </label>
    <div className="nm-seg nms-tight">
      {LEVELS.map(({ id, label, desc }) => (
        <button
          key={id}
          type="button"
          title={desc}
          aria-pressed={detailLevel === id}
          onClick={() => setDetailLevel(id)}
        >
          {label}
        </button>
      ))}
    </div>
    <p className="nms-help font-semibold">{LEVELS.find(l => l.id === detailLevel)?.desc}</p>
    {mode === 'topic' && detailLevel !== 'normal' && (
      <p className="nms-help">{HELP[detailLevel]}</p>
    )}
    {mode === 'transcript' && (
      <p className="nms-help">
        {detailLevel === 'normal'
          ? 'Normal: the video is split into parts and turned straight into detailed notes.'
          : 'AI first builds the whole video\'s structure (all topics + sub-points), shows a live mind map on screen, then expands each part ' + (detailLevel === 'deep' ? 'to the deepest level (down to sub-points)' : detailLevel === 'detailed' ? 'in depth' : 'well') + ' as per the structure.'}
      </p>
    )}
    {(mode === 'text' || mode === 'file') && (
      <p className="nms-help">
        {detailLevel === 'normal'
          ? 'Normal: pasted text or uploaded files are turned straight into detailed notes.'
          : `AI first builds the structure of all your content (text/files), shows a live mind map on screen, then expands each part ${detailLevel === 'deep' ? 'to the deepest level' : detailLevel === 'detailed' ? 'in depth' : 'well'} — nothing is missed.`}
      </p>
    )}

    {/* Grounding — live Google Search attached to the generation calls. Off
        by default, and shown at EVERY detail level including Normal: the
        single-pass Normal call takes the search tool just as the leveled
        pipelines do, and hiding the toggle there made it look like the
        setting had been lost on switching to Normal. */}
    <SidebarGroundingToggle
      groundingEnabled={groundingEnabled}
      setGroundingEnabled={setGroundingEnabled}
      description={detailLevel === 'normal'
        ? 'Writes the notes with live Google Search attached, so facts that change (schemes, data, appointments) come from the web rather than the model\'s training cutoff'
        : undefined}
    />
  </div>
);
