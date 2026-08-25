import React from 'react';
import { Globe2 } from 'lucide-react';

interface SidebarGroundingToggleProps {
  groundingEnabled: boolean;
  setGroundingEnabled: (v: boolean) => void;
  label?: string;
  description?: string;
}

// Shared toggle button used by the notes/transcript pipeline's "Grounding"
// setting (see SidebarDetailLevel) and, separately, by UPSC/Essay generation
// (which default this ON — real facts matter more there — but let the user
// switch it off for a faster/cheaper answer without live search).
export const SidebarGroundingToggle: React.FC<SidebarGroundingToggleProps> = ({
  groundingEnabled, setGroundingEnabled,
  label = 'Google Grounding',
  description = 'After generation, scans every heading and adds live-search info only where latest/current data is needed — everything else is left untouched',
}) => (
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
      <p className={`text-[11.5px] font-bold leading-tight ${groundingEnabled ? 'text-sky-300' : 'text-slate-300'}`}>{label}</p>
      <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">{description}</p>
    </div>
    <div className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${groundingEnabled ? 'bg-sky-500' : 'bg-white/15'}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${groundingEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </div>
  </button>
);
