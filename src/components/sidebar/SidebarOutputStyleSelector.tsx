import React from 'react';
import { AlignLeft, GraduationCap, FlaskConical, BarChart2 } from 'lucide-react';

type OutputStyle = 'notes' | 'upsc' | 'research' | 'table';

interface SidebarOutputStyleSelectorProps {
  outputStyle: OutputStyle;
  setOutputStyle: (style: OutputStyle) => void;
}

const OUTPUT_STYLES = [
  { id: 'notes'    as const, label: 'Notes',    icon: AlignLeft,     desc: 'Study notes'    },
  { id: 'upsc'     as const, label: 'UPSC',     icon: GraduationCap, desc: 'Exam answers'   },
  { id: 'research' as const, label: 'Research', icon: FlaskConical,  desc: 'Academic paper' },
  { id: 'table'    as const, label: 'Table',    icon: BarChart2,     desc: 'AI table'       },
];

export const SidebarOutputStyleSelector: React.FC<SidebarOutputStyleSelectorProps> = ({ outputStyle, setOutputStyle }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">Output Style</label>
    <div className="grid grid-cols-2 gap-2">
      {OUTPUT_STYLES.map(({ id, label, icon: Icon, desc }) => {
        const isActive = outputStyle === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setOutputStyle(id)}
            className={`flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl border transition-all duration-200 text-center ${
              isActive
                ? 'bg-slate-800 border-slate-600 shadow-lg'
                : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-600/30' : 'bg-white/5'}`}>
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className={`text-xs font-bold leading-none mb-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`}>{label}</p>
              <p className={`text-[10px] leading-tight ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
