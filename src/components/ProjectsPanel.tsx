import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, Trash2, Pencil, Check, X, FolderClosed,
  Cloud, HardDrive, Loader2, ChevronRight, RefreshCw,
  Search, Plus, CheckCircle2,
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
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects,
  loading,
  error,
  activeProjectId,
  isSupabaseConfigured,
  lastSavedAt,
  onOpen,
  onSync,
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
  const [tick, setTick] = useState(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tick every 15s to update "X ago" timestamps
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
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
    await onSync();
    setTimeout(() => setSyncing(false), 600);
  };

  const safeProjects = projects ?? [];
  const filtered = searchQuery.trim()
    ? safeProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : safeProjects;

  const activeProject = safeProjects.find(p => p.id === activeProjectId);

  return (
    <div className="border-t border-white/8 pt-2 mt-1">
      {/* Header row */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-1.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex-1 min-w-0"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase flex-1 text-left">Projects</span>
          <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        {/* Compact icon buttons in header */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSearch(s => !s); }}
          title="Search projects"
          className="p-1 rounded-md hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Search className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleSync(); }}
          title="Sync from cloud"
          className="p-1 rounded-md hover:bg-white/8 text-slate-500 hover:text-blue-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>
        {isSupabaseConfigured
          ? <Cloud className="w-3 h-3 text-blue-500/60 flex-shrink-0" title="Synced to Supabase" />
          : <HardDrive className="w-3 h-3 text-slate-600 flex-shrink-0" title="Local storage" />
        }
      </div>

      {isOpen && (
        <div className="mt-1.5 space-y-0.5">
          {/* Auto-save status */}
          {activeProject && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/8 rounded-lg border border-amber-500/15 mb-1.5">
              <FolderClosed className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-300 font-medium truncate flex-1">{activeProject.name}</span>
              {lastSavedAt && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[9px] text-emerald-400">{timeAgo(lastSavedAt)}</span>
                </div>
              )}
            </div>
          )}

          {/* Search input */}
          {showSearch && (
            <div className="relative mb-1.5">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none focus:border-amber-500/50"
              />
            </div>
          )}

          {/* Error */}
          {error && <p className="text-[10px] text-red-400 px-2">{error}</p>}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            </div>
          )}

          {/* Project list */}
          {!loading && filtered.map(project => (
            <div key={project.id} className="group relative">
              {renamingId === project.id ? (
                <div className="flex items-center gap-1 px-1 py-0.5">
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(project.id);
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                    }}
                    className="flex-1 bg-white/8 border border-white/15 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-amber-500/60"
                  />
                  <button onClick={() => handleRename(project.id)} className="p-0.5 text-green-400 hover:text-green-300">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setRenamingId(null); setRenameValue(''); }} className="p-0.5 text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeProjectId === project.id ? 'bg-amber-500/12' : 'hover:bg-white/5'
                }`}>
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    <FolderClosed className={`w-3 h-3 flex-shrink-0 ${activeProjectId === project.id ? 'text-amber-400' : 'text-slate-600'}`} />
                    <span className={`text-[11px] truncate ${activeProjectId === project.id ? 'text-amber-200' : 'text-slate-400'}`}>
                      {project.name}
                    </span>
                  </button>

                  {/* Always-visible small action icons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirmDeleteId === project.id ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); }}
                          className="p-0.5 text-red-400 hover:text-red-300"
                          title="Confirm delete"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          className="p-0.5 text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.name); }}
                          className="p-0.5 rounded hover:bg-white/10 text-slate-600 hover:text-slate-300"
                          title="Rename"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <p className="text-[10px] text-slate-600 px-2 py-1.5">
              {searchQuery ? 'No matching projects' : 'No projects yet'}
            </p>
          )}

          {/* Save current as new project — auto-names from H1 */}
          {hasContent && (
            <button
              onClick={onCreateProject}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-500/8 transition-colors mt-1 border border-dashed border-white/8 hover:border-amber-500/20"
            >
              <Plus className="w-3 h-3" />
              <span className="text-[11px]">Save as new project</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
