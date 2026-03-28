import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trash2, Pencil, Check, X, Cloud, HardDrive,
  Loader2, RefreshCw, Search, Plus, CheckCircle2,
  History, Save, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import type { ProjectMeta } from '../hooks/useProjects';

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
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  hasContent: boolean;
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

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects, loading, error, activeProjectId, isSupabaseConfigured,
  lastSavedAt, onOpen, onSync, onSaveNow, onSelectProject, onCreateProject,
  onDeleteProject, onRenameProject, hasContent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  const filtered = useMemo(() =>
    searchQuery.trim()
      ? safeProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : safeProjects
  , [safeProjects, searchQuery]);

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
    <div className="mt-2">
      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-1 mb-3" />

      {/* ── HEADER ROW ── */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-2 flex-1 min-w-0 group py-1"
        >
          <div className="w-5 h-5 rounded-md bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <History className="w-3 h-3 text-indigo-400" />
          </div>
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase group-hover:text-slate-200 transition-colors flex-1 text-left">
            History
          </span>
          {totalCount > 0 && (
            <span className="text-[10px] font-bold text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-1.5 py-0.5 leading-none">
              {totalCount}
            </span>
          )}
          {isOpen
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
          }
        </button>

        <div className="flex items-center gap-1">
          {/* Sync / Cloud indicator */}
          <button
            onClick={(e) => { e.stopPropagation(); handleSync(); }}
            title={isSupabaseConfigured ? 'Sync with cloud' : 'Refresh local'}
            className="p-1 rounded-md hover:bg-white/8 transition-colors"
          >
            {isSupabaseConfigured
              ? <Cloud className={`w-3.5 h-3.5 transition-colors ${syncing ? 'text-blue-400 animate-pulse' : 'text-blue-500/50 hover:text-blue-400'}`} />
              : <HardDrive className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" />
            }
          </button>

          {/* New project */}
          {hasContent && (
            <button
              onClick={onCreateProject}
              title="Save as new project"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/25 hover:text-indigo-200 transition-all text-[10px] font-bold"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          )}
        </div>
      </div>

      {/* ── ACTIVE PROJECT STATUS BAR ── */}
      {activeProjectId && (
        <div className="flex items-center gap-2 mx-1 mb-2 px-2.5 py-1.5 rounded-lg bg-white/3 border border-white/6">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="text-[10px] text-slate-400 truncate">{activeProject?.name ?? 'Untitled'}</span>
          </div>
          {lastSavedAt && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              <span className="text-[9px] text-slate-500">{timeAgo(lastSavedAt)}</span>
            </div>
          )}
          <button
            onClick={onSaveNow}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all text-[9px] font-bold flex-shrink-0"
          >
            <Save className="w-2.5 h-2.5" />
            Save
          </button>
        </div>
      )}

      {/* ── EXPANDED LIST ── */}
      {isOpen && (
        <div className="space-y-2">
          {/* Search */}
          <div className="relative px-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full bg-white/4 border border-white/8 rounded-xl pl-8 pr-7 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/40 focus:bg-white/6 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Stats + refresh row */}
          <div className="flex items-center justify-between px-2">
            <span className="text-[9px] text-slate-600 uppercase tracking-wider">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSync}
              className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40"
              disabled={syncing}
            >
              <RefreshCw className={`w-2.5 h-2.5 ${syncing ? 'animate-spin text-blue-400' : ''}`} />
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>

          {error && (
            <p className="text-[10px] text-red-400/80 px-2.5 py-1.5 bg-red-500/8 rounded-lg mx-1 border border-red-500/15">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[11px]">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
              <div className="w-8 h-8 rounded-xl bg-white/4 flex items-center justify-center">
                <History className="w-4 h-4 text-slate-700" />
              </div>
              <p className="text-[11px] text-slate-600">
                {searchQuery ? 'No results found' : 'No saved projects yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 px-1">
              {GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
                <div key={group}>
                  {/* Group label */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest whitespace-nowrap">{group}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Cards */}
                  <div className="space-y-1">
                    {grouped[group].map(project => {
                      const isActive = activeProjectId === project.id;
                      const isRenaming = renamingId === project.id;
                      const isConfirming = confirmDeleteId === project.id;

                      return (
                        <div
                          key={project.id}
                          className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                            isActive
                              ? 'bg-indigo-600/15 border-indigo-500/30'
                              : 'bg-white/3 border-white/6 hover:bg-white/5 hover:border-white/10'
                          }`}
                        >
                          {isRenaming ? (
                            /* RENAME MODE */
                            <div className="flex items-center gap-1.5 p-2">
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRename(project.id);
                                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                }}
                                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-indigo-400/50 min-w-0"
                              />
                              <button
                                onClick={() => handleRename(project.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex-shrink-0 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => { setRenamingId(null); setRenameValue(''); }}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/8 text-slate-500 hover:bg-white/15 hover:text-slate-300 flex-shrink-0 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : isConfirming ? (
                            /* DELETE CONFIRM MODE */
                            <div className="flex items-center gap-2 p-2">
                              <span className="flex-1 text-[10px] text-red-300">Delete this?</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors text-[10px] font-bold flex-shrink-0"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                Yes
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/8 text-slate-400 hover:bg-white/15 transition-colors text-[10px] font-bold flex-shrink-0"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            /* NORMAL VIEW */
                            <div className="flex items-center gap-1.5 p-2">
                              <button
                                onClick={() => onSelectProject(project.id)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className={`text-[11px] font-semibold leading-tight truncate ${isActive ? 'text-indigo-200' : 'text-slate-300'}`}>
                                  {project.name}
                                </p>
                                <p className="text-[9px] text-slate-600 mt-0.5">
                                  {timeAgo(project.updated_at)}
                                </p>
                              </button>

                              {/* Always-visible action buttons */}
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.name); }}
                                  title="Rename"
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-amber-300 hover:bg-amber-500/15 transition-all"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                                  title="Delete"
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/15 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
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
