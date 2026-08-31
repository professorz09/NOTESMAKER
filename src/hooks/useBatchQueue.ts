import { useCallback, useRef, useState } from 'react';
import { isSupabaseConfigured, getSupabaseClient } from '../services/supabase';

// Batch Question Queue — lets the user drop in many topics/questions at
// once (across UPSC / Essay / Research / Notes) and have them generated one
// by one in the background, instead of one blocking "Generate" click at a
// time. Backed by the `pending_questions` table (see
// supabase/migrations/20260831120000_pending_questions.sql) so the queue
// survives a page reload / a dropped connection instead of living only in
// localStorage — but degrades to an in-memory (this-tab-only) queue when
// Supabase isn't configured, or the migration hasn't been applied to this
// deployment yet, so the feature still works either way.

export type BatchOutputStyle = 'notes' | 'upsc' | 'essay' | 'research';
export type BatchItemStatus = 'pending' | 'active' | 'done' | 'failed';

export interface BatchQueueDraft {
  question: string;
  outputStyle: BatchOutputStyle;
  answerStyle: string | null;
  marks: number | null;
  subject: string | null;
  language: string;
  aiModel: string;
  grounded: boolean;
  multiVariant: boolean;
}

export interface BatchQueueItem extends BatchQueueDraft {
  id: string;
  status: BatchItemStatus;
  attempt: number;
  error: string | null;
  createdAt: string;
}

const LOCAL_KEY = 'ai_book_writer_batch_queue';

// Detects "the pending_questions table/columns don't exist yet" so the app
// can fall back to an in-memory queue instead of breaking outright — same
// pattern useProjects.ts uses for the current-affairs tags migration.
function isMissingTableError(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === '42703' || code === 'PGRST204'
    || (msg.includes('relation') && msg.includes('does not exist'))
    || (msg.includes('could not find the table'))
    || (msg.includes('column') && msg.includes('does not exist'));
}

function loadLocal(): BatchQueueItem[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveLocal(items: BatchQueueItem[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch { /* non-fatal */ }
}

function rowToItem(row: any): BatchQueueItem {
  return {
    id: row.id,
    question: row.question,
    outputStyle: (row.output_style as BatchOutputStyle) || 'upsc',
    answerStyle: row.answer_style ?? null,
    marks: row.marks ?? null,
    subject: row.subject ?? null,
    language: row.language || 'English',
    aiModel: row.ai_model || 'gemini-3.1-pro-preview',
    grounded: row.grounding ?? true,
    multiVariant: row.multi_variant ?? false,
    status: (row.status as BatchItemStatus) || 'pending',
    attempt: row.attempt || 0,
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}

export function useBatchQueue() {
  const [items, setItems] = useState<BatchQueueItem[]>(() => (isSupabaseConfigured ? [] : loadLocal()));
  // `usingServer` starts optimistic when Supabase is configured; the first
  // failed request that looks like a missing table flips it off for the
  // rest of the session so we don't keep retrying a table that isn't there.
  const usingServerRef = useRef(isSupabaseConfigured);
  // Mirrors `items` synchronously so the async worker loop (which lives
  // outside React's render cycle) always reads the latest queue state
  // instead of a stale closure from whenever it started.
  const itemsRef = useRef<BatchQueueItem[]>(items);

  const setAndSync = useCallback((updater: (prev: BatchQueueItem[]) => BatchQueueItem[]) => {
    itemsRef.current = updater(itemsRef.current);
    setItems(itemsRef.current);
    if (!usingServerRef.current) saveLocal(itemsRef.current);
  }, []);

  const loadQueue = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const local = loadLocal();
      itemsRef.current = local;
      setItems(local);
      return;
    }
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('pending_questions')
        .select('*')
        .in('status', ['pending', 'active', 'failed'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      usingServerRef.current = true;
      const list = ((data as any[]) || []).map(rowToItem);
      itemsRef.current = list;
      setItems(list);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        usingServerRef.current = false;
        const local = loadLocal();
        itemsRef.current = local;
        setItems(local);
      }
      // Any other error (network, RLS) — leave the queue as-is rather than
      // wiping out whatever was already loaded.
    }
  }, []);

  const addItems = useCallback(async (drafts: BatchQueueDraft[]): Promise<BatchQueueItem[]> => {
    if (usingServerRef.current) {
      try {
        const sb = getSupabaseClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error('Not signed in');
        const rows = drafts.map(d => ({
          user_id: user.id,
          question: d.question,
          output_style: d.outputStyle,
          answer_style: d.answerStyle,
          marks: d.marks,
          subject: d.subject,
          language: d.language,
          ai_model: d.aiModel,
          grounding: d.grounded,
          multi_variant: d.multiVariant,
        }));
        const { data, error } = await sb.from('pending_questions').insert(rows).select('*');
        if (error) throw error;
        const newItems = ((data as any[]) || []).map(rowToItem);
        setAndSync(prev => [...prev, ...newItems]);
        return newItems;
      } catch (e: any) {
        if (!isMissingTableError(e)) throw e;
        usingServerRef.current = false;
        // fall through to the local-queue path below
      }
    }
    const newItems: BatchQueueItem[] = drafts.map((d, i) => ({
      ...d,
      id: `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      attempt: 0,
      error: null,
      createdAt: new Date().toISOString(),
    }));
    setAndSync(prev => [...prev, ...newItems]);
    return newItems;
  }, [setAndSync]);

  const updateItem = useCallback(async (id: string, patch: Partial<Pick<BatchQueueItem, 'status' | 'attempt' | 'error'>>) => {
    setAndSync(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
    if (usingServerRef.current) {
      try {
        const sb = getSupabaseClient();
        await sb.from('pending_questions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      } catch {
        // Best-effort — local state already reflects the change either way.
      }
    }
  }, [setAndSync]);

  // Removes a queue row outright — used both for "user removed a pending
  // item" and "an item finished and its content already landed in the
  // document", so the table doesn't grow forever with completed rows.
  const removeItem = useCallback(async (id: string) => {
    setAndSync(prev => prev.filter(it => it.id !== id));
    if (usingServerRef.current) {
      try {
        const sb = getSupabaseClient();
        await sb.from('pending_questions').delete().eq('id', id);
      } catch {
        // Best-effort — it'll just linger server-side; loadQueue will pick
        // it back up next time, at worst showing as already-failed/done.
      }
    }
  }, [setAndSync]);

  return { items, itemsRef, loadQueue, addItems, updateItem, removeItem };
}
