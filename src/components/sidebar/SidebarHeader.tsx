import React from 'react';
import { BookOpen } from 'lucide-react';

export const SidebarHeader: React.FC = () => (
  <div className="flex-shrink-0 px-4 pt-4 pb-2 flex items-center gap-3">
    <div className="nms-logo" aria-hidden="true">
      <BookOpen className="w-[19px] h-[19px]" strokeWidth={2.4} />
    </div>
    <div className="min-w-0">
      <h1 className="nm-head text-[16px] font-extrabold tracking-tight leading-none">
        Professor <span className="nm-accent-text">UPSC</span>
      </h1>
      <p className="nm-muted text-[11px] font-semibold mt-1 leading-none">Notes Maker</p>
    </div>
  </div>
);
