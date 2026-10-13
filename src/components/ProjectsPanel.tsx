import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trash2, Pencil, Check, X, Cloud, HardDrive,
  Loader2, RefreshCw, Search, Plus, CheckCircle2,
  History, Save, ChevronDown, ChevronUp, FileText,
  Newspaper, CalendarRange,
} from 'lucide-react';
import type { ProjectMeta } from '../hooks/useProjects';
import { CURRENT_AFFAIRS_TAG } from '../hooks/useProjects';

interface ProjectsPanelProps {
  projects: ProjectMeta[];
  loading: boolean;
  error: string | null;
  activeProjectId: string | null;
  isSupabaseConfigured: boolean;
  lastSavedAt: Date | null;
  onOpen: () => void;        // first-open fetch (cached, no refetch)
  onSync: () => void;        // manual force-refetch
  onSaveNow: () => void;
  onSelectProject: (id: string) => void;
  openingProjectId: string | null;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  hasContent: boolean;
  // Special calendar date-range feature — combines every Current-Affairs-
  // tagged note in [start, end] into one merged read on the canvas.
  onReadDateRange: (start: string, end: string) => void;
}

// ── Lightweight relative-time formatter ──
function timeAgo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function getGroup(updatedAt: string): string {
  const diffDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'Earlier';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier', 'Older'];
const SYNC_COOLDOWN_MS = 3000;

function fmtEntryDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects, loading, error, activeProjectId, isSupabaseConfigured,
  lastSavedAt, onOpen, onSync, onSaveNow, onSelectProject, openingProjectId, onCreateProject,
  onDeleteProject, onRenameProject, hasContent, onReadDateRange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Tag filter — "All" or just the Current Affairs stream, so daily current-
  // affairs notes can be picked out of the rest of the history at a glance.
  const [tagFilter, setTagFilter] = useState<'all' | 'ca'>('all');
  // Calendar date-range popover — the special "read several days together" feature.
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const renameInputRef = useRef<HTMLInputElement>(null);
  const syncCooldownRef = useRef(0);

  // Tick every 30s to refresh relative timestamps — only updates `now`, not the whole tree
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Open panel → trigger first-load fetch (no-op if already loaded)
  useEffect(() => { if (isOpen) onOpen(); }, [isOpen, onOpen]);
  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);

  const handleRename = useCallback((id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    onRenameProject(id, name);
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, onRenameProject]);

  const handleSync = useCallback(() => {
    const t = Date.now();
    if (t - syncCooldownRef.current < SYNC_COOLDOWN_MS) return;
    syncCooldownRef.current = t;
    setSyncing(true);
    onSync();
    setTimeout(() => setSyncing(false), 900);
  }, [onSync]);

  // ── Memoised derived data — no recomputation unless inputs change ──
  const safeProjects = useMemo(() =>
    [...(projects ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  , [projects]);

  const caCount = useMemo(() => safeProjects.filter(p => p.tags?.includes(CURRENT_AFFAIRS_TAG)).length, [safeProjects]);

  const filtered = useMemo(() => {
    let list = tagFilter === 'ca' ? safeProjects.filter(p => p.tags?.includes(CURRENT_AFFAIRS_TAG)) : safeProjects;
    if (searchQuery.trim()) list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [safeProjects, searchQuery, tagFilter]);

  const handleReadRange = useCallback(() => {
    if (!rangeStart || !rangeEnd) return;
    const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    onReadDateRange(start, end);
    setShowRangePicker(false);
  }, [rangeStart, rangeEnd, onReadDateRange]);

  const grouped = useMemo(() => {
    const g: Record<string, ProjectMeta[]> = {};
    filtered.forEach(p => {
      const key = getGroup(p.updated_at);
      if (!g[key]) g[key] = [];
      g[key].push(p);
    });
    return g;
  }, [filtered]);

  const activeProject = useMemo(
    () => safeProjects.find(p => p.id === activeProjectId),
    [safeProjects, activeProjectId]
  );

  const totalCount = safeProjects.length;

  // Expose `now` to force timeAgo recalc on tick — cheap, no big re-render
  void now;

  return (
    <div className="pt-1">
      {/* ── HEADER ROW ── */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setIsOpen(o => !o)}
          aria-expanded={isOpen}
          className="nms-disclosure flex-1 min-w-0 !px-2"
        >
          <History className="w-4 h-4 nm-muted flex-shrink-0" />
          <span className="nm-label flex-1 text-left">
            History
          </span>
          {totalCount > 0 && (
            <span className="nm-badge">
              {totalCount}
            </span>
          )}
          {isOpen
            ? <ChevronUp className="w-4 h-4 nm-muted flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 nm-muted flex-shrink-0" />
          }
        </button>

        <div className="flex items-center gap-0.5">
          {/* Sync / Cloud indicator */}
          <button
            onClick={(e) => { e.stopPropagation(); handleSync(); }}
            title={isSupabaseConfigured ? 'Sync with cloud' : 'Refresh local'}
            aria-label={isSupabaseConfigured ? 'Sync with cloud' : 'Refresh local'}
            className={`nm-icon-btn ${syncing ? 'on' : ''}`}
          >
            {isSupabaseConfigured
              ? <Cloud className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
              : <HardDrive className="w-4 h-4" />
            }
          </button>

          {/* Calendar date-range read — combines several days of Current
              Affairs notes into one merged read. Shown once there's at
              least one tagged note to combine. */}
          {caCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(true); setShowRangePicker(s => !s); }}
              title="Read current affairs by date range"
              aria-label="Read current affairs by date range"
              aria-pressed={showRangePicker}
              className={`nm-icon-btn ${showRangePicker ? 'on' : ''}`}
            >
              <CalendarRange className="w-4 h-4" />
            </button>
          )}

          {/* New project */}
          {hasContent && (
            <button
              onClick={onCreateProject}
              title="Save as new project"
              className="nm-chip !py-1.5 !px-3 ml-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>
      </div>

      {/* ── ACTIVE PROJECT STATUS BAR ── */}
      {activeProjectId && (
        <div className="nms-card flex items-center gap-2 mb-2 pl-3 pr-1.5 py-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FileText className="w-3.5 h-3.5 nm-accent-text flex-shrink-0" />
            <span className="text-[12px] font-semibold nm-head truncate">{activeProject?.name ?? 'Untitled'}</span>
          </div>
          {lastSavedAt && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <CheckCircle2 className="w-3 h-3 nms-ok" />
              <span className="text-[11px] nm-muted">{timeAgo(lastSavedAt)}</span>
            </div>
          )}
          <button
            onClick={onSaveNow}
            className="nm-btn !text-[12px] min-h-[34px] px-3 flex-shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      )}

      {/* ── DATE RANGE READ POPOVER ── the special calendar feature: pick a
          start/end date and every Current Affairs note in between is
          merged into one combined read on the canvas. */}
      {showRangePicker && (
        <div className="nms-card mb-2 p-3 space-y-2.5 nm-pop">
          <p className="text-[12px] font-bold nm-head flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 nm-accent-text" /> Read Current Affairs by date range
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              aria-label="Start date"
              className="nm-input nms-date flex-1 min-w-0 !px-2.5 !py-2 !text-[12px] !rounded-[12px]"
            />
            <span className="text-[11px] nm-muted">to</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              aria-label="End date"
              className="nm-input nms-date flex-1 min-w-0 !px-2.5 !py-2 !text-[12px] !rounded-[12px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReadRange}
              disabled={!rangeStart || !rangeEnd}
              className="nm-btn-primary flex-1 min-h-[40px] text-[13px]"
            >
              Combine &amp; Read
            </button>
            <button
              onClick={() => setShowRangePicker(false)}
              className="nm-btn min-h-[40px] px-4 text-[13px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── EXPANDED LIST ── */}
      {isOpen && (
        <div className="space-y-2.5">
          {/* Tag filter — All vs Current Affairs only */}
          {caCount > 0 && (
            <div className="flex items-center gap-1.5">
              {(['all', 'ca'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTagFilter(f)}
                  aria-pressed={tagFilter === f}
                  className={`nm-chip ${tagFilter === f ? 'on' : ''}`}
                >
                  {f === 'ca' && <Newspaper className="w-3.5 h-3.5" />}
                  {f === 'all' ? 'All' : `Current Affairs (${caCount})`}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 nm-muted pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              aria-label="Search history"
              className="nm-input !pl-10 !pr-10 !py-2.5 !text-[13px] !rounded-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="nms-x absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats + refresh row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] nm-muted">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSync}
              className="flex items-center gap-1.5 text-[11px] font-semibold nm-muted hover:underline min-h-[32px] disabled:opacity-40"
              disabled={syncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin nm-accent-text' : ''}`} />
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>

          {error && (
            <p className="text-[12px] nms-err px-3 py-2 nms-card">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 nm-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[12px]">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
              <History className="w-5 h-5 nm-muted opacity-60" />
              <p className="text-[12px] nm-muted">
                {searchQuery ? 'No results found' : 'No saved projects yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
                <div key={group}>
                  {/* Group label */}
                  <p className="nm-label !text-[10px] px-2 mb-1">{group}</p>

                  {/* Rows */}
                  <div className="space-y-0.5">
                    {grouped[group].map(project => {
                      const isActive = activeProjectId === project.id;
                      const isRenaming = renamingId === project.id;
                      const isConfirming = confirmDeleteId === project.id;
                      const isOpening = openingProjectId === project.id;

                      return (
                        <div
                          key={project.id}
                          className={`nms-row ${isActive ? 'active' : ''}`}
                        >
                          {isRenaming ? (
                            /* RENAME MODE */
                            <div className="flex items-center gap-1 p-1.5">
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRename(project.id);
                                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                }}
                                aria-label="Project name"
                                className="nm-input flex-1 min-w-0 !py-2 !px-3 !text-[13px] !rounded-[12px]"
                              />
                              <button
                                onClick={() => handleRename(project.id)}
                                aria-label="Save name"
                                className="nms-row-act nms-ok"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setRenamingId(null); setRenameValue(''); }}
                                aria-label="Cancel rename"
                                className="nms-row-act"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : isConfirming ? (
                            /* DELETE CONFIRM MODE */
                            <div className="flex items-center gap-2 p-1.5 pl-3">
                              <span className="flex-1 text-[12px] font-semibold nms-err">Delete this?</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); }}
                                className="nm-btn danger min-h-[36px] px-3 text-[12px] flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Yes
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="nm-btn min-h-[36px] px-3 text-[12px] flex-shrink-0"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            /* NORMAL VIEW */
                            <div className="flex items-center gap-0.5 pr-1">
                              <button
                                onClick={() => onSelectProject(project.id)}
                                disabled={isOpening}
                                className="flex-1 min-w-0 text-left disabled:cursor-wait pl-3 py-2 rounded-[13px] min-h-[44px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  {isOpening
                                    ? <Loader2 className="w-3 h-3 nm-accent-text animate-spin flex-shrink-0" />
                                    : project.tags?.includes(CURRENT_AFFAIRS_TAG) && (
                                        <Newspaper className="w-3 h-3 nms-warn flex-shrink-0" />
                                      )}
                                  <p className="nms-row-title nm-head text-[13px] font-semibold leading-tight truncate">
                                    {project.name}
                                  </p>
                                </div>
                                <p className="text-[11px] nm-muted mt-0.5">
                                  {isOpening ? 'Opening…' : project.entry_date ? fmtEntryDate(project.entry_date) : timeAgo(project.updated_at)}
                                </p>
                              </button>

                              {/* Always-visible action buttons */}
                              <div className="flex items-center flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.name); }}
                                  title="Rename"
                                  aria-label="Rename"
                                  className="nms-row-act"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                                  title="Delete"
                                  aria-label="Delete"
                                  className="nms-row-act danger"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
