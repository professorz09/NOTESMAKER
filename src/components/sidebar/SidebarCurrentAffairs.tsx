import React from 'react';
import { Newspaper, Zap, Globe2, CalendarDays, ListChecks, Radar } from 'lucide-react';
import { looksLikeVideoUrl } from '../../services/supadata';

interface SidebarCurrentAffairsProps {
  caUrls: string;
  setCaUrls: (v: string) => void;
  caDate: string;
  setCaDate: (v: string) => void;
  caStyle: 'quick' | 'deep' | 'scan' | 'agentic';
  setCaStyle: (v: 'quick' | 'deep' | 'scan' | 'agentic') => void;
  caProgress: { current: number; total: number; note: string } | null;
}

export const SidebarCurrentAffairs: React.FC<SidebarCurrentAffairsProps> = ({
  caUrls, setCaUrls, caDate, setCaDate, caStyle, setCaStyle, caProgress,
}) => {
  const lines = caUrls.split('\n').map(u => u.trim()).filter(Boolean);
  const urlCount = lines.filter(looksLikeVideoUrl).length;
  const topicCount = lines.length - urlCount;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase px-0.5">
        <Newspaper className="w-3 h-3" /> Daily Current Affairs
      </label>

      {/* Date this batch is filed under — used for the Current Affairs tag
          in history and for the calendar date-range combined read. */}
      <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2 focus-within:border-amber-500/50 transition-all">
        <CalendarDays className="w-4 h-4 text-amber-400/90 flex-shrink-0" />
        <input
          type="date"
          value={caDate}
          onChange={(e) => setCaDate(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none min-w-0 [color-scheme:dark]"
        />
      </div>

      <textarea
        value={caUrls}
        onChange={(e) => setCaUrls(e.target.value)}
        placeholder={'Optional — paste video link(s) or type topic(s), one per line.\nLeave empty to just use the date above.'}
        rows={4}
        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-white/6 transition-all resize-none leading-relaxed"
      />
      {(urlCount > 0 || topicCount > 0) ? (
        <p className="text-[10px] text-slate-600 px-0.5">
          {urlCount > 0 && `${urlCount} video link${urlCount !== 1 ? 's' : ''}`}
          {urlCount > 0 && topicCount > 0 && ' · '}
          {topicCount > 0 && `${topicCount} topic${topicCount !== 1 ? 's' : ''}`}
        </p>
      ) : (
        <p className="text-[10px] text-slate-600 px-0.5">Nothing pasted — will research today's news for the date above via live search.</p>
      )}

      {/* Generation style — four options, all on the Flash model:
          Quick (1 call), Deep Research (topics → one grounded verify+write
          call), Headline Scan (two grounded discovery calls in parallel
          against different source groups, formatted with no writing call),
          Agentic (same dual-grounding discovery, then one grounded call
          writing fuller notes with a static-fact box per item). */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
        {([
          { key: 'quick', label: 'Quick', sub: '1 call • fastest', Icon: Zap, active: 'bg-gradient-to-b from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-900/30', subActive: 'text-orange-100/90' },
          { key: 'deep', label: 'Deep Research', sub: 'PIB + trusted sources', Icon: Globe2, active: 'bg-gradient-to-b from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/30', subActive: 'text-indigo-100/90' },
          { key: 'scan', label: 'Headline Scan', sub: '2x grounding • headlines', Icon: ListChecks, active: 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-lg shadow-teal-900/30', subActive: 'text-teal-100/90' },
          { key: 'agentic', label: 'Agentic', sub: '2x grounding + detail', Icon: Radar, active: 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-purple-900/30', subActive: 'text-purple-100/90' },
        ] as const).map(({ key, label, sub, Icon, active, subActive }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCaStyle(key)}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all duration-200 text-center ${
              caStyle === key ? active : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold leading-none">{label}</span>
            <span className={`text-[8px] leading-tight ${caStyle === key ? subActive : 'text-slate-600'}`}>{sub}</span>
          </button>
        ))}
      </div>
      <p className="text-[9.5px] text-slate-600 leading-relaxed px-0.5">
        {caStyle === 'quick' && (urlCount > 0
          ? 'One fast Flash call reads the transcript(s) and extracts only the exam-relevant points — no search needed, facts already come from the video.'
          : 'One Flash call, grounded with live Google Search — no video given, so it searches for real facts itself instead of relying on the video.')}
        {caStyle === 'deep' && 'Perplexity-style deep research: Flash first lists the news items (from the video, your topics, or discovered fresh via search), then ONE grounded call verifies and expands each against PIB and other trusted UPSC sources, with a source line per item.'}
        {caStyle === 'scan' && 'Two grounded calls run in parallel — one searching PIB alone, one searching every other trusted source — merged into one headline list with no writing call at all. Fastest way to see everything exam-relevant today.'}
        {caStyle === 'agentic' && 'Same dual-grounding discovery as Headline Scan, then one grounded call writes a fuller paragraph per item plus a "static fact" box of background it builds on — the standing fact you should already know alongside today\'s news.'}
      </p>

      {caProgress && (
        <div className="space-y-1.5 pt-0.5">
          <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(6, Math.round((caProgress.current / Math.max(1, caProgress.total)) * 100))}%`,
                background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
              }}
            />
          </div>
          <p className="text-[10px] text-amber-300/90 leading-snug truncate">{caProgress.note}</p>
        </div>
      )}
    </div>
  );
};
