import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2, Pencil, Check, X, Cloud, HardDrive,
  Loader2, RefreshCw, Search, Plus, CheckCircle2, History, Save,
} from 'lucide-react';
import type { ProjectMeta } from '../hooks/useProjects';

interface ProjectsPanelProps {
  projects: ProjectMeta[];
  loading: boolean;
  error: string | null;
  activeProjectId: string | null;
  isSupabaseConfigured: boolean;
  lastSavedAt: Date | null;
  onOpen: () => void;
  onSync: () => void;
  onSaveNow: () => void;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  hasContent: boolean;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function getGroup(updatedAt: string): string {
  const date = new Date(updatedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'Earlier';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier', 'Older'];

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects,
  loading,
  error,
  activeProjectId,
  isSupabaseConfigured,
  lastSavedAt,
  onOpen,
  onSync,
  onSaveNow,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  hasContent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tick every 30s to refresh "X ago" labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isOpen) onOpen();
  }, [isOpen]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  const handleRename = (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    onRenameProject(id, name);
    setRenamingId(null);
    setRenameValue('');
  };

  const handleSync = async () => {
    setSyncing(true);
    onSync();
    setTimeout(() => setSyncing(false), 700);
  };

  const safeProjects = [...(projects ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const filtered = searchQuery.trim()
    ? safeProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : safeProjects;

  // Group projects
  const grouped: Record<string, ProjectMeta[]> = {};
  filtered.forEach(p => {
    const g = getGroup(p.updated_at);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  });

  const totalCount = safeProjects.length;

  return (
    <div className="border-t border-white/8 pt-2 mt-1">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-1 px-1 mb-0.5">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-1.5 py-1.5 flex-1 min-w-0 group"
        >
          <History className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex-1 text-left group-hover:text-slate-400 transition-colors">
            History
          </span>
          {totalCount > 0 && (
            <span className="text-[9px] text-slate-600 bg-white/5 rounded px-1">{totalCount}</span>
          )}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); setShowSearch(s => !s); }}
          title="Search"
          className={`p-1 rounded hover:bg-white/8 transition-colors ${showSearch ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
        >
          <Search className="w-3 h-3" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); handleSync(); }}
          title="Refresh"
          className="p-1 rounded hover:bg-white/8 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {isSupabaseConfigured
          ? <Cloud className="w-3 h-3 text-blue-600/50 flex-shrink-0" title="Cloud sync" />
          : <HardDrive className="w-3 h-3 text-slate-700 flex-shrink-0" title="Local only" />
        }
      </div>

      {/* ── AUTO-SAVE STATUS + MANUAL SAVE (always visible) ── */}
      {activeProjectId && (
        <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
          {lastSavedAt ? (
            <>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/70 flex-shrink-0" />
              <span className="text-[9px] text-slate-600 flex-1">Saved {timeAgo(lastSavedAt)}</span>
            </>
          ) : (
            <span className="text-[9px] text-slate-700 flex-1">Not saved yet</span>
          )}
          <button
            onClick={onSaveNow}
            title="Save now"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-slate-600 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
          >
            <Save className="w-2.5 h-2.5" />
            <span>Save</span>
          </button>
        </div>
      )}

      {isOpen && (
        <div>
          {/* Search bar */}
          {showSearch && (
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-600" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-700 outline-none focus:border-white/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}

          {error && <p className="text-[10px] text-red-400/80 px-2 mb-1">{error}</p>}

          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-3 text-slate-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">Loading...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[10px] text-slate-700 px-2 py-2">
              {searchQuery ? 'No results found' : 'Nothing here yet'}
            </p>
          ) : (
            /* Grouped history list */
            GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
              <div key={group} className="mb-2">
                <p className="text-[9px] font-semibold text-slate-700 uppercase tracking-widest px-2 py-1">
                  {group}
                </p>
                {grouped[group].map(project => (
                  <div key={project.id} className="group relative">
                    {renamingId === project.id ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(project.id);
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                          }}
                          className="flex-1 bg-white/8 border border-white/15 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-amber-500/50"
                        />
                        <button onClick={() => handleRename(project.id)} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => { setRenamingId(null); setRenameValue(''); }} className="p-0.5 text-slate-600 hover:text-slate-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-md transition-colors pr-14 ${
                          activeProjectId === project.id
                            ? 'bg-white/8 text-slate-200'
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                      >
                        <span className={`block text-[11px] leading-snug truncate ${
                          activeProjectId === project.id ? 'font-medium' : ''
                        }`}>
                          {project.name}
                        </span>
                      </button>
                    )}

                    {/* Hover actions */}
                    {renamingId !== project.id && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-sm rounded px-0.5">
                        {confirmDeleteId === project.id ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); }}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Confirm"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="p-1 text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.name); }}
                              className="p-1 text-slate-600 hover:text-slate-300"
                              title="Rename"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                              className="p-1 text-slate-600 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Save current as new entry */}
          {hasContent && (
            <button
              onClick={onCreateProject}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 text-slate-600 hover:text-slate-400 hover:bg-white/5 rounded-md transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span className="text-[11px]">Save as new</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
