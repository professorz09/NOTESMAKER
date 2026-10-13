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
    <label className="nm-label block px-0.5">Output style</label>
    <div className="nm-seg nms-modes nms-styles" role="radiogroup" aria-label="Output style">
      {OUTPUT_STYLES.map(({ id, label, icon: Icon, desc }) => {
        const isActive = outputStyle === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            onClick={() => setOutputStyle(id)}
            title={desc}
            aria-checked={isActive}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
