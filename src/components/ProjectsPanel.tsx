import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Plus, Trash2, Pencil, Check, X, FolderClosed, Cloud, HardDrive, Loader2, ChevronRight } from 'lucide-react';
import type { ProjectMeta } from '../hooks/useProjects';

interface ProjectsPanelProps {
  projects: ProjectMeta[];
  loading: boolean;
  error: string | null;
  activeProjectId: string | null;
  isSupabaseConfigured: boolean;
  onOpen: () => void;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onSaveCurrentProject: () => void;
  hasContent: boolean;
}

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  projects,
  loading,
  error,
  activeProjectId,
  isSupabaseConfigured,
  onOpen,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onSaveCurrentProject,
  hasContent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) onOpen();
  }, [isOpen]);

  useEffect(() => {
    if (isCreating) newInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreateProject(name);
    setNewName('');
    setIsCreating(false);
  };

  const handleRename = (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    onRenameProject(id, name);
    setRenamingId(null);
    setRenameValue('');
  };

  const safeProjects = projects ?? [];
  const activeProject = safeProjects.find(p => p.id === activeProjectId);

  return (
    <div className="border-t border-white/8 pt-3 mt-1">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors group"
      >
        <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase flex-1 text-left">Projects</span>
        {isSupabaseConfigured
          ? <Cloud className="w-3 h-3 text-blue-400 flex-shrink-0" title="Synced to Supabase" />
          : <HardDrive className="w-3 h-3 text-slate-500 flex-shrink-0" title="Stored locally" />
        }
        <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {/* Active project indicator */}
          {activeProject && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 rounded-xl border border-amber-500/20 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <FolderClosed className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-300 font-medium truncate">{activeProject.name}</span>
              </div>
              {hasContent && (
                <button
                  onClick={onSaveCurrentProject}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider flex-shrink-0 ml-2"
                >
                  Save
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-[11px] text-red-400 px-2 pb-1">{error}</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            </div>
          )}

          {/* Project list */}
          {!loading && safeProjects.map(project => (
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
                    className="flex-1 bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500/60"
                  />
                  <button onClick={() => handleRename(project.id)} className="text-green-400 hover:text-green-300 p-1">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setRenamingId(null); setRenameValue(''); }} className="text-slate-400 hover:text-slate-300 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (confirmDeleteId === project.id) { setConfirmDeleteId(null); return; }
                    onSelectProject(project.id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <FolderClosed className={`w-3.5 h-3.5 flex-shrink-0 ${activeProjectId === project.id ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-xs flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-slate-500 flex-shrink-0 hidden group-hover:block">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </button>
              )}

              {/* Action buttons on hover */}
              {renamingId !== project.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(project.id);
                      setRenameValue(project.name);
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {confirmDeleteId === project.id ? (
                    <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg border border-white/10 px-1">
                      <span className="text-[10px] text-red-400">Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteId(null); }}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="p-1 text-slate-400 hover:text-slate-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                      className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {!loading && safeProjects.length === 0 && !isCreating && (
            <p className="text-[11px] text-slate-500 px-3 py-2">No projects yet. Create one to save your work.</p>
          )}

          {/* Create new */}
          {isCreating ? (
            <div className="flex items-center gap-1 px-2 py-1 mt-1">
              <input
                ref={newInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Project name..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                }}
                className="flex-1 bg-white/8 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-500/60"
              />
              <button onClick={handleCreate} className="text-green-400 hover:text-green-300 p-1">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setIsCreating(false); setNewName(''); }} className="text-slate-400 hover:text-slate-300 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs">New project</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
