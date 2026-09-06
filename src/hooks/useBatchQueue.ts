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
// 'paused' is what Stop puts items into. It matters that it's a status and
// not a tab-local flag: the background worker only ever claims rows that are
// still 'pending', so pausing here stops the worker too. Otherwise Stop would
// only quiet this tab while the worker kept writing answers into the note —
// which reads as the button not working at all.
export type BatchItemStatus = 'pending' | 'active' | 'paused' | 'done' | 'failed';

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
  // The note this item's generated answer belongs to — captured at the
  // moment it was queued, NOT re-read later. Without this, an item queued
  // while note A is open would land in whatever note happens to be open
  // by the time the worker gets to it, including a completely different
  // note the student switched to in between. Null means "no note was open
  // yet when this was queued" (the very first generation of a fresh
  // document) — that one case still appends to whatever's on screen.
  projectId: string | null;
}

export interface BatchQueueItem extends BatchQueueDraft {
  id: string;
  status: BatchItemStatus;
  attempt: number;
  error: string | null;
  createdAt: string;
  // When this row's status last changed — lets a stale 'active' claim (left
  // behind by a killed tab or a crashed worker instance) be told apart from
  // one still genuinely in progress, instead of guessing from status alone.
  updatedAt: string;
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
    projectId: row.project_id ?? null,
    status: (row.status as BatchItemStatus) || 'pending',
    attempt: row.attempt || 0,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
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

  // Scoped to ONE note (`projectId`, or null for "no note open yet") — the
  // list shown is always specific to whichever note is currently open, so
  // switching notes and coming back shows exactly what was left queued for
  // that note, not a mix of everything the account has ever queued.
  const loadQueue = useCallback(async (projectId: string | null) => {
    if (!isSupabaseConfigured) {
      const local = loadLocal().filter(it => it.projectId === projectId);
      itemsRef.current = local;
      setItems(local);
      return;
    }
    try {
      const sb = getSupabaseClient();
      let query = sb
        .from('pending_questions')
        .select('*')
        .in('status', ['pending', 'active', 'paused', 'failed'])
        .order('created_at', { ascending: true });
      query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null);
      const { data, error } = await query;
      if (error) throw error;
      usingServerRef.current = true;
      const list = ((data as any[]) || []).map(rowToItem);
      itemsRef.current = list;
      setItems(list);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        usingServerRef.current = false;
        const local = loadLocal().filter(it => it.projectId === projectId);
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
          project_id: d.projectId,
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
    const nowIso = new Date().toISOString();
    const newItems: BatchQueueItem[] = drafts.map((d, i) => ({
      ...d,
      id: `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      attempt: 0,
      error: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    setAndSync(prev => [...prev, ...newItems]);
    return newItems;
  }, [setAndSync]);

  const updateItem = useCallback(async (id: string, patch: Partial<Pick<BatchQueueItem, 'status' | 'attempt' | 'error'>>) => {
    const nowIso = new Date().toISOString();
    setAndSync(prev => prev.map(it => (it.id === id ? { ...it, ...patch, updatedAt: nowIso } : it)));
    if (usingServerRef.current) {
      try {
        const sb = getSupabaseClient();
        await sb.from('pending_questions').update({ ...patch, updated_at: nowIso }).eq('id', id);
      } catch {
        // Best-effort — local state already reflects the change either way.
      }
    }
  }, [setAndSync]);

  // How long an 'active' row is believed to be genuinely in progress. Past
  // this it's treated as abandoned (a killed tab, a restarted worker) and
  // no longer blocks anything. Matches the worker's own threshold.
  const STALE_ACTIVE_MS = 15 * 60_000;

  // Takes an item to generate. Two separate guards, both needed:
  //
  //  1. ONE WRITER PER NOTE. If anything is already generating for this note
  //     — the background worker, or another open tab — this returns 'busy'
  //     and the caller stands down. Claiming per-row atomically is NOT
  //     enough on its own: it stops two processors taking the SAME question,
  //     but happily lets them take two DIFFERENT questions from the same
  //     note at once. Both then read that note, append their answer, and
  //     save it back — so whichever saves second overwrites the other's
  //     answer. That's the note-eating bug all over again, just with two
  //     writers instead of a stale canvas.
  //  2. ATOMIC ROW CLAIM. The update only lands if the row is still
  //     'pending' server-side at that instant, so even in the split second
  //     where two processors both pass guard 1, only one can win the row.
  //
  // Returns 'won' | 'taken' (someone else got this row) | 'busy' (this
  // note already has a writer).
  const claimItem = useCallback(async (
    id: string,
    projectId: string | null,
  ): Promise<'won' | 'taken' | 'busy'> => {
    const nowIso = new Date().toISOString();
    if (!usingServerRef.current) {
      // Local-only fallback queue: this tab is the only actor, no race.
      setAndSync(prev => prev.map(it => (it.id === id ? { ...it, status: 'active', updatedAt: nowIso } : it)));
      return 'won';
    }
    try {
      const sb = getSupabaseClient();
      const freshSince = new Date(Date.now() - STALE_ACTIVE_MS).toISOString();
      let busyQuery = sb
        .from('pending_questions')
        .select('id')
        .eq('status', 'active')
        .gt('updated_at', freshSince)
        .neq('id', id)
        .limit(1);
      busyQuery = projectId ? busyQuery.eq('project_id', projectId) : busyQuery.is('project_id', null);
      const { data: busy, error: busyErr } = await busyQuery;
      if (busyErr) throw busyErr;
      if (busy && busy.length > 0) return 'busy';

      const { data, error } = await sb
        .from('pending_questions')
        .update({ status: 'active', updated_at: nowIso })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) return 'taken';
      setAndSync(prev => prev.map(it => (it.id === id ? { ...it, status: 'active', updatedAt: nowIso } : it)));
      return 'won';
    } catch {
      // Can't tell who has what — standing down is always the safe answer.
      return 'busy';
    }
  }, [setAndSync]);

  // Bulk status change across this note's whole queue — what Stop (pending
  // + active -> paused) and Resume (paused -> pending) are built on. Done as
  // one server-side update rather than a loop of updateItem calls so a long
  // queue stops in a single round trip, and so the worker sees the whole
  // queue change state at once instead of racing a trickle of updates.
  // Returns whether the change actually reached the server. Stop depends on
  // that answer: the pause only stops the background worker once the rows
  // are 'paused' server-side, so a failed write means the worker is still
  // going regardless of what this tab now shows — the caller has to be able
  // to say so rather than report a stop that didn't happen.
  const bulkSetStatus = useCallback(async (
    projectId: string | null,
    from: BatchItemStatus[],
    to: BatchItemStatus,
  ): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    setAndSync(prev => prev.map(it => (from.includes(it.status) ? { ...it, status: to, updatedAt: nowIso } : it)));
    if (!usingServerRef.current) return true;
    try {
      const sb = getSupabaseClient();
      let q = sb.from('pending_questions')
        .update({ status: to, updated_at: nowIso })
        .in('status', from);
      q = projectId ? q.eq('project_id', projectId) : q.is('project_id', null);
      const { error } = await q;
      if (error) throw error;
      return true;
    } catch {
      return false;
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

  return { items, itemsRef, loadQueue, addItems, updateItem, claimItem, bulkSetStatus, removeItem };
}
