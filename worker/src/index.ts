// NotesMaker batch-queue worker.
//
// The app's Batch Question Queue (see src/hooks/useBatchQueue.ts and
// src/hooks/useGeneration.ts's runBatchQueue) normally only runs inside an
// open browser tab — queue a bunch of questions, close the tab or lock the
// phone, and processing stops until the tab is open and active again. This
// process is the same idea running server-side instead: it polls the same
// `pending_questions` table, generates answers through the exact same
// AI-generation code the app uses (imported straight from ../src/services/
// ai — nothing here is a re-implementation, so prompts never drift out of
// sync with the app), and appends them straight into the note's saved
// content. It's meant to run continuously (see README.md for Render setup)
// so a long batch run finishes even with no device open at all.
//
// Deliberately simpler than the browser's version in one respect: there's
// no "live canvas" here, only the note's saved `content` in the `projects`
// table — every append re-reads that fresh right before writing, so this
// process can never suffer the "resumed onto a stale canvas" class of bug
// the browser path has to guard against explicitly.
import { createClient } from '@supabase/supabase-js';
import * as http from 'node:http';
import { generateUPSCAnswer, correctQuestionHindi, type UPSCAnswerStyle, type UPSCSubject } from '../../src/services/ai/upscAnswerGeneration';
import { generateEssay } from '../../src/services/ai/essayGeneration';
import { generateResearchPaper } from '../../src/services/ai/researchAndPdf';
import { generateTopicContent } from '../../src/services/ai/topicGeneration';
import { wrapUPSCBlock, escapeHtml } from '../../src/services/ai/htmlBlocks';
import { sanitizeHtml } from '../../src/utils/sanitize';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_SHARED_SECRET = process.env.WORKER_SHARED_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[worker] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot start.');
  process.exit(1);
}
if (!WORKER_SHARED_SECRET) {
  console.error('[worker] Missing WORKER_SHARED_SECRET — AI calls would 401 against gemini-proxy. Cannot start.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Paced the same as the browser's batch queue (see useGeneration.ts) —
// Vertex AI's per-minute quota is the real ceiling, not this process.
const ITEM_GAP_MS = 60_000;
const RETRY_DELAY_MS = 90_000;
const MAX_ATTEMPTS = 3;
// How often to check for new work when the queue is empty.
const IDLE_POLL_MS = 20_000;
// An 'active' row this old almost certainly means the worker was killed or
// restarted mid-item (a Render redeploy, an OOM, …) — reclaim it rather
// than leaving it stuck forever.
const STALE_ACTIVE_MS = 15 * 60_000;

interface PendingRow {
  id: string;
  project_id: string | null;
  question: string;
  output_style: 'notes' | 'upsc' | 'essay' | 'research';
  answer_style: string | null;
  marks: number | null;
  subject: string | null;
  language: string | null;
  ai_model: string | null;
  grounding: boolean;
  multi_variant: boolean;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function resetStuckActiveItems(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_ACTIVE_MS).toISOString();
  const { error } = await admin
    .from('pending_questions')
    .update({ status: 'pending' })
    .eq('status', 'active')
    .lt('updated_at', staleBefore);
  if (error) console.error('[worker] failed resetting stuck items:', error.message);
}

// Items with no project_id yet were queued before the student had saved
// any note to attach them to — only the live app (which knows what's on
// screen) can resolve those, so this worker leaves them alone entirely.
async function claimNextItem(): Promise<PendingRow | null> {
  const { data: candidates, error } = await admin
    .from('pending_questions')
    .select('*')
    .eq('status', 'pending')
    .not('project_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) { console.error('[worker] failed listing pending items:', error.message); return null; }
  if (!candidates || candidates.length === 0) return null;

  // Claim atomically (status='pending' in the WHERE clause) so this worker
  // and a browser tab that happens to be open at the same time never both
  // pick up the same row — whichever update actually matches wins it.
  for (const row of candidates as PendingRow[]) {
    const { data: claimed, error: claimErr } = await admin
      .from('pending_questions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select();
    if (claimErr) { console.error('[worker] failed claiming item:', claimErr.message); continue; }
    if (claimed && claimed.length > 0) return row;
  }
  return null;
}

async function generateForItem(row: PendingRow): Promise<string> {
  const language = row.language || 'English';
  const aiModel = row.ai_model || 'gemini-3.1-pro-preview';

  if (row.output_style === 'upsc') {
    let question = row.question;
    const subject = (row.subject as UPSCSubject) || 'gs';
    if (language === 'Hindi' || subject === 'hindi_literature') {
      try {
        const corrected = await correctQuestionHindi(question);
        if (corrected) question = corrected;
      } catch { /* keep original if correction fails */ }
    }
    const answer = await generateUPSCAnswer(
      question, language, aiModel,
      row.marks || 15, (row.answer_style as UPSCAnswerStyle) || 'topper',
      subject, row.grounding, row.multi_variant,
    );
    return wrapUPSCBlock(question, answer, subject);
  }
  if (row.output_style === 'essay') {
    const body = await generateEssay(row.question, language, aiModel, row.grounding);
    return `<section class="essay-block"><h1 class="essay-title">${escapeHtml(row.question)}</h1>${body}</section>`;
  }
  if (row.output_style === 'research') {
    return await generateResearchPaper(row.question, language, aiModel);
  }
  return await generateTopicContent(row.question, language, aiModel);
}

// Always re-reads the note's current saved content right before writing —
// see the file-level comment on why that's what keeps this path immune to
// the "resumed onto a stale canvas" bug class the browser has to guard
// against explicitly.
async function appendToProject(projectId: string, block: string): Promise<void> {
  const { data: proj, error: readErr } = await admin
    .from('projects')
    .select('content')
    .eq('id', projectId)
    .single();
  if (readErr) throw readErr;
  const existing = (proj?.content as string | null) || '';
  const divider = existing ? '\n<hr class="upsc-qa-divider" />\n' : '';
  const combined = sanitizeHtml(existing + divider + block);
  const { error: writeErr } = await admin
    .from('projects')
    .update({ content: combined, updated_at: new Date().toISOString() })
    .eq('id', projectId);
  if (writeErr) throw writeErr;
}

async function processItem(row: PendingRow): Promise<void> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const block = await generateForItem(row);
      // project_id is guaranteed non-null here — claimNextItem only ever
      // selects rows where it's set.
      await appendToProject(row.project_id as string, block);
      const { error: delErr } = await admin.from('pending_questions').delete().eq('id', row.id);
      if (delErr) console.error(`[worker] generated but failed to dequeue ${row.id}:`, delErr.message);
      console.log(`[worker] done: "${row.question.slice(0, 60)}" (project ${row.project_id})`);
      return;
    } catch (err: any) {
      lastErr = err;
      console.error(`[worker] attempt ${attempt}/${MAX_ATTEMPTS} failed for "${row.question.slice(0, 60)}":`, err?.message || err);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  const { error: failErr } = await admin
    .from('pending_questions')
    .update({ status: 'failed', error: String(lastErr?.message || lastErr || 'Unknown error') })
    .eq('id', row.id);
  if (failErr) console.error(`[worker] failed marking ${row.id} as failed:`, failErr.message);
}

async function loop(): Promise<void> {
  console.log('[worker] started, polling pending_questions…');
  while (true) {
    try {
      await resetStuckActiveItems();
      const row = await claimNextItem();
      if (row) {
        await processItem(row);
        await sleep(ITEM_GAP_MS);
      } else {
        await sleep(IDLE_POLL_MS);
      }
    } catch (err) {
      console.error('[worker] loop error:', err);
      await sleep(IDLE_POLL_MS);
    }
  }
}

// A tiny HTTP server is the whole reason this can run on Render's FREE Web
// Service tier: a "Background Worker" service there has no free tier, but
// a free Web Service does — it just sleeps after 15 minutes with no HTTP
// traffic. Point a free external pinger (e.g. cron-job.org) at this
// service's URL every ~10 minutes to keep it awake; the actual queue
// polling above runs independently of any request arriving here. See
// README.md for the full setup.
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});
const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`[worker] health server listening on :${port}`));

loop();
