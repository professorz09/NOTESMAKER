import React from 'react';
import { Sparkles, FileText, Mic, Newspaper } from 'lucide-react';

type Mode = 'topic' | 'text' | 'file' | 'transcript' | 'currentAffairs';

interface SidebarModeTabsProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

// 'text' and 'file' share a single tab/panel — the user pastes text and/or
// uploads files in one place, so there's no reason to force a choice
// up front. Whichever one actually has content at generate-time decides
// which pipeline runs (see useGeneration's handleGenerate).
// `short` is the visible label (four tabs must fit a ~300px panel); the
// full `label` stays as the accessible name and tooltip.
const TABS = [
  { id: 'topic'          as const, icon: Sparkles, label: 'Topic',           short: 'Topic'      },
  { id: 'text'           as const, icon: FileText, label: 'Text / File',     short: 'Text/File'  },
  { id: 'transcript'     as const, icon: Mic,      label: 'Transcript',      short: 'Transcript' },
  { id: 'currentAffairs' as const, icon: Newspaper,label: 'Current Affairs', short: 'News'       },
];

export const SidebarModeTabs: React.FC<SidebarModeTabsProps> = ({ mode, setMode }) => (
  <div className="nm-seg nms-modes" role="tablist" aria-label="Input mode">
    {TABS.map(({ id, icon: Icon, label, short }) => {
      const isActive = id === 'text' ? (mode === 'text' || mode === 'file') : mode === id;
      return (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-label={label}
          title={label}
          onClick={() => setMode(id === 'text' && mode === 'file' ? 'file' : id)}
        >
          <Icon className="w-[18px] h-[18px]" />
          <span>{short}</span>
        </button>
      );
    })}
  </div>
);
