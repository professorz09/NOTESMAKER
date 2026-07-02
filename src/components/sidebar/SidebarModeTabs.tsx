import React from 'react';
import { Sparkles, FileText, Upload, Mic } from 'lucide-react';

type Mode = 'topic' | 'text' | 'file' | 'transcript';

interface SidebarModeTabsProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const TABS = [
  { id: 'topic'      as const, icon: Sparkles, label: 'Topic'      },
  { id: 'text'       as const, icon: FileText, label: 'Text'       },
  { id: 'file'       as const, icon: Upload,   label: 'File'       },
  { id: 'transcript' as const, icon: Mic,      label: 'Transcript' },
];

export const SidebarModeTabs: React.FC<SidebarModeTabsProps> = ({ mode, setMode }) => (
  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
    {TABS.map(({ id, icon: Icon, label }) => (
      <button
        key={id}
        onClick={() => setMode(id)}
        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          mode === id
            ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    ))}
  </div>
);
