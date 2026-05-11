import React from 'react';
import { NotebookPen, Plus, CheckCircle2 } from 'lucide-react';

interface SidebarOnePagerProps {
  onePagerTopicInput: string;
  setOnePagerTopicInput: (v: string) => void;
  onePagerTopics: string[];
  onePagerLoading: boolean;
  handleAddOnePager: () => void;
}

export const SidebarOnePager: React.FC<SidebarOnePagerProps> = ({
  onePagerTopicInput, setOnePagerTopicInput,
  onePagerTopics, onePagerLoading, handleAddOnePager,
}) => (
  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/4 p-3 space-y-3">
    <div className="flex items-center gap-2 px-1">
      <NotebookPen className="w-3.5 h-3.5 text-indigo-400" />
      <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex-1">One Pager Notes</p>
      {onePagerTopics.length > 0 && (
        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
          {onePagerTopics.length} topics
        </span>
      )}
    </div>

    <p className="text-[9.5px] text-slate-500 px-1 leading-relaxed">
      Enter topic name — compact 1-page notes will be generated &amp; appended below
    </p>

    <div className="flex gap-2">
      <input
        type="text"
        value={onePagerTopicInput}
        onChange={(e) => setOnePagerTopicInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOnePager(); } }}
        placeholder="Topic name e.g. Mughal Empire"
        disabled={onePagerLoading}
        className="flex-1 min-w-0 bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/6 transition-all disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleAddOnePager}
        disabled={onePagerLoading || !onePagerTopicInput.trim()}
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
        title="Add Topic"
      >
        {onePagerLoading
          ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : <Plus className="w-4 h-4 text-white" />
        }
      </button>
    </div>

    {onePagerTopics.length > 0 && (
      <div className="space-y-1">
        <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider px-1">Added Topics:</p>
        <div className="flex flex-wrap gap-1.5">
          {onePagerTopics.map((t, i) => (
            <div key={i} className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
              <span className="text-[9.5px] text-indigo-200 font-medium leading-none truncate max-w-[120px]">{t}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
