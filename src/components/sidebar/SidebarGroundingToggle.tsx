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
    role="switch"
    aria-checked={groundingEnabled}
    onClick={() => setGroundingEnabled(!groundingEnabled)}
    title={description}
    className={`nms-toggle ${groundingEnabled ? 'on' : ''}`}
  >
    <Globe2 className={`w-[18px] h-[18px] flex-shrink-0 ${groundingEnabled ? 'nm-accent-text' : 'nm-muted'}`} />
    <span className="flex-1 min-w-0">
      <span className="block nm-head text-[13px] font-bold leading-tight">{label}</span>
      <span className="nm-muted text-[11px] leading-snug mt-0.5 line-clamp-2">{description}</span>
    </span>
    <span className={`nm-switch ${groundingEnabled ? 'on' : ''}`} aria-hidden="true" />
  </button>
);
