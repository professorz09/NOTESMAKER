import React from 'react';
import { Newspaper, Zap, Globe2, CalendarDays, ListChecks, Radar, BookOpen } from 'lucide-react';
import { looksLikeVideoUrl } from '../../services/supadata';

interface SidebarCurrentAffairsProps {
  caUrls: string;
  setCaUrls: (v: string) => void;
  caDate: string;
  setCaDate: (v: string) => void;
  caStyle: 'quick' | 'deep' | 'scan' | 'agentic';
  setCaStyle: (v: 'quick' | 'deep' | 'scan' | 'agentic') => void;
  caDepth: 'deep' | 'standard';
  setCaDepth: (v: 'deep' | 'standard') => void;
  caProgress: { current: number; total: number; note: string } | null;
}

export const SidebarCurrentAffairs: React.FC<SidebarCurrentAffairsProps> = ({
  caUrls, setCaUrls, caDate, setCaDate, caStyle, setCaStyle, caDepth, setCaDepth, caProgress,
}) => {
  const lines = caUrls.split('\n').map(u => u.trim()).filter(Boolean);
  const urlCount = lines.filter(looksLikeVideoUrl).length;
  const topicCount = lines.length - urlCount;

  return (
    <div className="space-y-3">
      <label className="nm-label nms-title">
        <Newspaper /> Daily Current Affairs
      </label>

      {/* Date this batch is filed under — used for the Current Affairs tag
          in history and for the calendar date-range combined read. */}
      <div className="nm-input nms-field">
        <CalendarDays className="w-4 h-4" />
        <input
          type="date"
          value={caDate}
          onChange={(e) => setCaDate(e.target.value)}
          aria-label="Current affairs date"
          className="nms-date"
        />
      </div>

      <textarea
        value={caUrls}
        onChange={(e) => setCaUrls(e.target.value)}
        placeholder={'Optional — paste video link(s) or type topic(s), one per line.\nLeave empty to just use the date above.'}
        rows={4}
        className="nm-input resize-none leading-relaxed"
      />
      {(urlCount > 0 || topicCount > 0) ? (
        <p className="nms-help">
          {urlCount > 0 && `${urlCount} video link${urlCount !== 1 ? 's' : ''}`}
          {urlCount > 0 && topicCount > 0 && ' · '}
          {topicCount > 0 && `${topicCount} topic${topicCount !== 1 ? 's' : ''}`}
        </p>
      ) : (
        <p className="nms-help">Nothing pasted — will research today's news for the date above via live search.</p>
      )}

      {/* Generation style — four options, all on the Flash model:
          Quick (1 call), Deep Research (topics → one grounded verify+write
          call), Headline Scan (two grounded discovery calls in parallel
          against different source groups, formatted with no writing call),
          Agentic (dual-grounding discovery + comprehensive static background & Prelims traps). */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: 'agentic', label: 'Agentic Core', sub: 'Dual search + Deep basics', Icon: Radar },
          { key: 'deep', label: 'Deep Research', sub: 'PIB + trusted sources', Icon: Globe2 },
          { key: 'quick', label: 'Quick', sub: '1 call • fastest', Icon: Zap },
          { key: 'scan', label: 'Headline Scan', sub: '2x grounding • headlines', Icon: ListChecks },
        ] as const).map(({ key, label, sub, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCaStyle(key)}
            aria-pressed={caStyle === key}
            title={sub}
            className={`nm-tile nms-tile !flex-row !justify-start !min-h-[52px] !px-2.5 !text-left !gap-2.5 ${caStyle === key ? 'on' : ''}`}
          >
            <span className="nm-tile-ico"><Icon /></span>
            <span className="min-w-0">
              <span className="block leading-tight">{label}</span>
              <span className="block nms-sub nm-muted leading-tight mt-0.5">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Static Core Depth Selector */}
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="nm-label nms-title !px-0">
            <BookOpen /> Static Core Depth (मूल अवधारणा स्तर)
          </span>
        </div>
        <div className="nm-seg nms-two">
          <button
            type="button"
            onClick={() => setCaDepth('deep')}
            aria-pressed={caDepth === 'deep'}
          >
            <span>Deep Static Core</span>
            <span className="nms-sub">Tech Specs, Articles & Traps</span>
          </button>
          <button
            type="button"
            onClick={() => setCaDepth('standard')}
            aria-pressed={caDepth === 'standard'}
          >
            <span>Standard</span>
            <span className="nms-sub">Concise background</span>
          </button>
        </div>
        <p className="nms-help font-semibold">
          {caDepth === 'deep' ? 'Full Core (Pre+Mains)' : 'Standard'}
        </p>
      </div>

      <p className="nms-help">
        {caStyle === 'agentic' && 'Agentic Core: Dual-grounding live discovery across PIB & national portals, followed by intelligent multi-step synthesis connecting every event to its complete static syllabus fundamentals (e.g., for ISRO space missions: 4-stage vehicle architecture, propulsion, fuel types & payload capacities; for polity: Articles & Acts; for economy: MPC & transmission; for ecology: IUCN & wildlife schedules) along with Prelims traps and Mains analytical dimensions.'}
        {caStyle === 'deep' && 'Perplexity-style deep research: Flash identifies news developments across PIB and trusted sources, then verifies and expands each with exact numbers, dates, static background boxes, and a source verification line.'}
        {caStyle === 'quick' && (urlCount > 0
          ? 'Fast Flash extraction from transcript(s) — summarizes key exam facts and essential static linkage directly from the video.'
          : 'Fast Flash call grounded with live Google Search — searches for breaking facts and basic static context.')}
        {caStyle === 'scan' && 'Two grounded calls run in parallel — one searching PIB alone, one searching every other trusted source — merged into one headline list with no writing call at all. Fastest way to see everything exam-relevant today.'}
      </p>

      {caProgress && (
        <div className="space-y-1.5 pt-0.5">
          <div className="nms-bar">
            <div style={{ width: `${Math.max(6, Math.round((caProgress.current / Math.max(1, caProgress.total)) * 100))}%` }} />
          </div>
          <p className="nms-help truncate">{caProgress.note}</p>
        </div>
      )}
    </div>
  );
};
