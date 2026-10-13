// The Gemini → Vertex proxy served from this worker's HTTP server.
//
// Same job as the gemini-proxy Edge Function, and the same code: the actual
// proxying is imported from that function's own core.ts, so the two can't
// drift apart. What this host adds is time. Supabase stops an Edge Function
// at its wall-clock limit, which a long Deep-notes section (a Pro model
// writing tens of thousands of tokens) can run into; a long-lived Node
// server has no such ceiling. The app sends AI calls here first when
// VITE_AI_PROXY_URL points at this server, and falls back to the Edge
// Function when this one is unset, asleep or unreachable — see
// src/services/ai/client.ts.
//
// Security mirrors the Edge Function exactly: a valid Supabase user JWT
// (checked against Supabase Auth, not just decoded) or the worker's shared
// secret, the same ALLOWED_ORIGINS allow-list, the same path pinning under
// /v1beta/models/, and a bounded request body. The GCP key is only ever read
// from this server's own environment and never leaves it.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  corsHeaders,
  forwardGemini,
  isOriginAllowed,
  resolveGeminiPath,
  safeEqual,
} from '../../supabase/functions/gemini-proxy/core';

export const AI_PROXY_MOUNT = '/gemini-proxy';

// Larger than the Edge Function's 6 MB (that one is Supabase's inline
// ceiling) — a long source text or several page images fit here — but
// still bounded so one request can't exhaust the server's memory.
const MAX_BODY_BYTES = 20 * 1024 * 1024;

export const isAiProxyRequest = (url: string | undefined) =>
  !!url && (url === AI_PROXY_MOUNT || url.startsWith(`${AI_PROXY_MOUNT}/`) || url.startsWith(`${AI_PROXY_MOUNT}?`));

// Whether this server can actually serve AI calls. Without a key it answers
// 503, which the app treats as "use the Edge Function instead".
export const aiProxyConfigured = () => !!(process.env.GCP_SA_KEY || process.env.GEMINI_API_KEY);

function send(res: ServerResponse, status: number, text: string, contentType: string, cors: Record<string, string>) {
  res.writeHead(status, { 'Content-Type': contentType, ...cors });
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { tooLarge = true; chunks.length = 0; return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function handleAiProxy(req: IncomingMessage, res: ServerResponse, admin: SupabaseClient) {
  const reqOrigin = String(req.headers.origin ?? '');
  const originAllowed = isOriginAllowed(process.env.ALLOWED_ORIGINS, reqOrigin);
  const cors = corsHeaders(originAllowed ? reqOrigin : '');
  const plainCors = corsHeaders();
  const json = (body: unknown, status: number, c = plainCors) => send(res, status, JSON.stringify(body), 'application/json', c);

  if (req.method === 'OPTIONS') { res.writeHead(200, cors); res.end('ok'); return; }

  const workerSecret = process.env.WORKER_SHARED_SECRET;
  const supplied = req.headers['x-worker-secret'];
  const isWorkerCall = !!workerSecret && typeof supplied === 'string' && safeEqual(supplied, workerSecret);
  if (!isWorkerCall && !originAllowed) return json({ error: 'Origin not allowed' }, 403, cors);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!aiProxyConfigured()) return json({ error: 'AI proxy not configured on this server' }, 503, cors);

  if (!isWorkerCall) {
    // A real check against Supabase Auth — a token is only accepted if
    // Supabase itself says it belongs to a live session.
    const auth = String(req.headers.authorization ?? '');
    if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'Missing Authorization header' }, 401, cors);
    const token = auth.slice(7).trim();
    try {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return json({ error: 'Invalid or expired session' }, 401, cors);
    } catch {
      return json({ error: 'Could not verify session' }, 502, cors);
    }
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const subPath = url.pathname.slice(AI_PROXY_MOUNT.length) || '/';
  const resolved = resolveGeminiPath(subPath);
  if ('error' in resolved) return send(res, resolved.error.status, resolved.error.text, resolved.error.contentType, plainCors);

  const declared = parseInt(String(req.headers['content-length'] ?? '0'), 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'Request body too large' }, 413, cors);
  let raw: string | null;
  try {
    raw = await readBody(req);
  } catch {
    return json({ error: 'Could not read request body' }, 400, cors);
  }
  if (raw === null) return json({ error: 'Request body too large' }, 413, cors);
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors);
  }

  const result = await forwardGemini(resolved.pathname, body, {
    GCP_SA_KEY: process.env.GCP_SA_KEY,
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    GCP_REGION: process.env.GCP_REGION,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
  if (res.writableEnded || res.destroyed) return; // client gave up meanwhile
  send(res, result.status, result.text, result.contentType, cors);
}
