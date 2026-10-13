import React, { useState } from 'react';
import { History, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { PipelineResumeSnapshot } from '../utils/pipelineResume';
import '../liquid-panels.css';

interface ResumeBannerProps {
  snapshots: PipelineResumeSnapshot[];
  onResume: (snapshot: PipelineResumeSnapshot) => void;
  onDismiss: (id: string) => void;
}

const LEVEL_LABEL: Record<string, string> = {
  medium: 'Medium',
  detailed: 'Detailed',
  deep: 'Deep',
};

const ResumeItem: React.FC<{
  snapshot: PipelineResumeSnapshot;
  onResume: () => void;
  onDismiss: () => void;
}> = ({ snapshot, onResume, onDismiss }) => {
  const done = snapshot.nodes.filter(n => n.status === 'done').length;
  const total = snapshot.nodes.length || 1;
  const title = snapshot.kind === 'topic' ? snapshot.topic : snapshot.title;

  return (
    <div className="nm-well rounded-2xl px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="nm-head text-[13px] font-semibold truncate">{title || 'Untitled'}</p>
          <p className="nm-muted text-[11px] mt-0.5">
            {LEVEL_LABEL[snapshot.level] || snapshot.level} pipeline • {done}/{total} sections done
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Discard"
          className="nm-icon-btn !w-8 !h-8 !rounded-full -mr-1 -mt-1 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={onResume}
        className="nm-btn-primary mt-2 w-full min-h-[40px] text-[13px]"
      >
        Resume
      </button>
    </div>
  );
};

// Non-blocking floating panel — several notes pipelines can be interrupted
// and left pending at once (starting a fresh generation doesn't discard an
// earlier one), so this lists all of them rather than a single blocking modal.
export const ResumeBanner: React.FC<ResumeBannerProps> = ({ snapshots, onResume, onDismiss }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!snapshots.length) return null;

  return (
    <div
      className="nm-panel nm-pop fixed z-[65] w-[min(calc(100vw-32px),340px)] rounded-[22px] overflow-hidden"
      style={{ left: '1rem', bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        className="nm-focus w-full flex items-center gap-2.5 px-3 min-h-[48px] text-left"
      >
        <span className="nm-ico-badge !w-8 !h-8 !rounded-[10px]"><History className="w-4 h-4" /></span>
        <span className="nm-head text-[13px] font-bold flex-1 text-left">
          {snapshots.length} unfinished note{snapshots.length > 1 ? 's' : ''}
        </span>
        {collapsed ? <ChevronUp className="w-4 h-4 nm-muted" /> : <ChevronDown className="w-4 h-4 nm-muted" />}
      </button>

      {!collapsed && (
        <div className="nm-scroll px-2.5 pb-2.5 space-y-2 max-h-[50vh] overflow-y-auto">
          {snapshots.map(snap => (
            <ResumeItem
              key={snap.id}
              snapshot={snap}
              onResume={() => onResume(snap)}
              onDismiss={() => onDismiss(snap.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
