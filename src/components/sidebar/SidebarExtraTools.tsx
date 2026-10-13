import React, { useState } from 'react';
import { Wrench, ChevronDown } from 'lucide-react';

// One collapsed home for the occasional-use tools — PDF→Hindi, Answer
// Analysis, Topper Copy and One Pager Notes. Expanded, they run to most of
// a phone screen between the mode/style settings above and the notes
// history below, which is a lot of permanent real estate for things reached
// once in a while. Collapsed by default; whatever is inside stays mounted
// (an upload or a run in progress must not be torn down by collapsing the
// panel), it's just hidden.
export const SidebarExtraTools: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="nms-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="nms-disclosure"
      >
        <Wrench className="w-4 h-4 nm-muted flex-shrink-0" />
        <span className="flex-1 text-left nm-label">
          PDF &amp; Extra Tools
        </span>
        <ChevronDown
          className={`w-4 h-4 nm-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={open ? 'px-2 pb-2 space-y-2' : 'hidden'}>
        {children}
      </div>
    </div>
  );
};
