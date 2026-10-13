import React from 'react';
import { AlignLeft, GraduationCap, FlaskConical, BarChart2, PenTool } from 'lucide-react';

type OutputStyle = 'notes' | 'upsc' | 'essay' | 'research' | 'table';

interface SidebarOutputStyleSelectorProps {
  outputStyle: OutputStyle;
  setOutputStyle: (style: OutputStyle) => void;
}

const OUTPUT_STYLES = [
  { id: 'notes'    as const, label: 'Notes',    icon: AlignLeft,     desc: 'Study notes'    },
  { id: 'upsc'     as const, label: 'UPSC',     icon: GraduationCap, desc: 'Exam answers'   },
  { id: 'essay'    as const, label: 'Essay',    icon: PenTool,       desc: 'Essay paper'    },
  { id: 'research' as const, label: 'Research', icon: FlaskConical,  desc: 'Academic paper' },
  { id: 'table'    as const, label: 'Table',    icon: BarChart2,     desc: 'AI table'       },
];

export const SidebarOutputStyleSelector: React.FC<SidebarOutputStyleSelectorProps> = ({ outputStyle, setOutputStyle }) => (
  <div className="space-y-2">
    <label className="nm-label block px-0.5">Output Style</label>
    <div className="grid grid-cols-3 gap-2">
      {OUTPUT_STYLES.map(({ id, label, icon: Icon, desc }) => {
        const isActive = outputStyle === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setOutputStyle(id)}
            title={desc}
            aria-pressed={isActive}
            className={`nm-tile nms-tile ${isActive ? 'on' : ''}`}
          >
            <span className="nm-tile-ico"><Icon /></span>
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
