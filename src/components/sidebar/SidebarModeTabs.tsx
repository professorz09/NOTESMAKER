import React from 'react';
import { Sparkles, FileText, Mic } from 'lucide-react';

type Mode = 'topic' | 'text' | 'file' | 'transcript';

interface SidebarModeTabsProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

// 'text' and 'file' share a single tab/panel — the user pastes text and/or
// uploads files in one place, so there's no reason to force a choice
// up front. Whichever one actually has content at generate-time decides
// which pipeline runs (see useGeneration's handleGenerate).
const TABS = [
  { id: 'topic'      as const, icon: Sparkles, label: 'Topic'      },
  { id: 'text'       as const, icon: FileText, label: 'Text / File' },
  { id: 'transcript' as const, icon: Mic,      label: 'Transcript' },
];

export const SidebarModeTabs: React.FC<SidebarModeTabsProps> = ({ mode, setMode }) => (
  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
    {TABS.map(({ id, icon: Icon, label }) => {
      const isActive = id === 'text' ? (mode === 'text' || mode === 'file') : mode === id;
      return (
        <button
          key={id}
          onClick={() => setMode(id === 'text' && mode === 'file' ? 'file' : id)}
          className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-[11px] leading-tight font-semibold text-center transition-all duration-200 ${
            isActive
              ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      );
    })}
  </div>
);
