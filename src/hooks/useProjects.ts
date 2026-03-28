import { useState, useCallback } from 'react';
import { isSupabaseConfigured, getSupabaseClient, Project, ProjectWithContent } from '../services/supabase';

const LOCAL_PROJECTS_KEY = 'ai_book_writer_projects';

interface LocalProject {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  content: string | null;
}

function getLocalProjects(): LocalProject[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalProjects(projects: LocalProject[]) {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
}

export type ProjectMeta = { id: string; name: string; created_at: string; updated_at: string };

export function useProjects() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { data, error: sbErr } = await sb
          .from('projects')
          .select('id, name, created_at, updated_at')
          .order('updated_at', { ascending: false });
        if (sbErr) throw sbErr;
        setProjects((data as ProjectMeta[]) || []);
      } else {
        const local = getLocalProjects().map(({ id, name, created_at, updated_at }) => ({ id, name, created_at, updated_at }));
        local.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setProjects(local);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjectContent = useCallback(async (id: string): Promise<string | null> => {
    try {
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { data, error: sbErr } = await sb
          .from('projects')
          .select('content')
          .eq('id', id)
          .single();
        if (sbErr) throw sbErr;
        return (data as { content: string | null })?.content ?? null;
      } else {
        const local = getLocalProjects();
        const p = local.find(lp => lp.id === id);
        return p?.content ?? null;
      }
    } catch {
      return null;
    }
  }, []);

  const createProject = useCallback(async (name: string, content: string): Promise<ProjectMeta | null> => {
    try {
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { data, error: sbErr } = await sb
          .from('projects')
          .insert({ name, content })
          .select('id, name, created_at, updated_at')
          .single();
        if (sbErr) throw sbErr;
        const proj = data as ProjectMeta;
        setProjects(prev => [proj, ...prev]);
        return proj;
      } else {
        const now = new Date().toISOString();
        const newProject: LocalProject = {
          id: crypto.randomUUID(),
          name,
          content,
          created_at: now,
          updated_at: now,
        };
        const local = getLocalProjects();
        local.unshift(newProject);
        saveLocalProjects(local);
        const meta: ProjectMeta = { id: newProject.id, name: newProject.name, created_at: newProject.created_at, updated_at: newProject.updated_at };
        setProjects(prev => [meta, ...prev]);
        return meta;
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create project');
      return null;
    }
  }, []);

  const saveProject = useCallback(async (id: string, content: string): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { error: sbErr } = await sb
          .from('projects')
          .update({ content, updated_at: now })
          .eq('id', id);
        if (sbErr) throw sbErr;
      } else {
        const local = getLocalProjects();
        const idx = local.findIndex(p => p.id === id);
        if (idx !== -1) {
          local[idx].content = content;
          local[idx].updated_at = now;
          saveLocalProjects(local);
        }
      }
      setProjects(prev =>
        prev.map(p => p.id === id ? { ...p, updated_at: now } : p)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      );
      return true;
    } catch (e: any) {
      setError(e?.message || 'Failed to save project');
      return false;
    }
  }, []);

  const renameProject = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { error: sbErr } = await sb
          .from('projects')
          .update({ name, updated_at: now })
          .eq('id', id);
        if (sbErr) throw sbErr;
      } else {
        const local = getLocalProjects();
        const idx = local.findIndex(p => p.id === id);
        if (idx !== -1) { local[idx].name = name; local[idx].updated_at = now; saveLocalProjects(local); }
      }
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name, updated_at: now } : p));
      return true;
    } catch {
      return false;
    }
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured) {
        const sb = getSupabaseClient();
        const { error: sbErr } = await sb.from('projects').delete().eq('id', id);
        if (sbErr) throw sbErr;
      } else {
        const local = getLocalProjects().filter(p => p.id !== id);
        saveLocalProjects(local);
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
      return true;
    } catch {
      return false;
    }
  }, [activeProjectId]);

  return {
    projects,
    loading,
    error,
    activeProjectId,
    setActiveProjectId,
    fetchProjects,
    loadProjectContent,
    createProject,
    saveProject,
    renameProject,
    deleteProject,
    isSupabaseConfigured,
  };
}
