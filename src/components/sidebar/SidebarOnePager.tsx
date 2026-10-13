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
  <div className="nms-card plain p-2.5 space-y-2.5">
    <div className="flex items-center gap-1.5">
      <NotebookPen className="w-3.5 h-3.5 nm-accent-text" />
      <p className="text-[12px] font-bold nm-head flex-1">One Pager Notes</p>
      {onePagerTopics.length > 0 && (
        <span className="nm-badge">
          {onePagerTopics.length} topics
        </span>
      )}
    </div>

    <p className="nms-help !px-0">
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
        className="nm-input flex-1 min-w-0 !py-2 !text-[13px] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleAddOnePager}
        disabled={onePagerLoading || !onePagerTopicInput.trim()}
        className="nm-btn-primary flex-shrink-0 w-10 h-10 !p-0"
        title="Add Topic"
        aria-label="Add Topic"
      >
        {onePagerLoading
          ? <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(4,38,29,0.3)', borderTopColor: 'currentColor' }} />
          : <Plus className="w-[18px] h-[18px]" />
        }
      </button>
    </div>

    {onePagerTopics.length > 0 && (
      <div className="space-y-1.5">
        <p className="nm-label !text-[10px]">Added Topics:</p>
        <div className="flex flex-wrap gap-1.5">
          {onePagerTopics.map((t, i) => (
            <span key={i} className="nm-badge max-w-full">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{t}</span>
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);
