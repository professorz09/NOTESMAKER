import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getAccessToken } from "../supabase";
import { readEnv } from "../../utils/env";

// All AI calls go through a Supabase Edge Function (gemini-proxy) that
// holds the GCP Service Account key server-side and forwards to Vertex
// AI. The browser bundle never sees a Gemini/Vertex credential — only
// the user's short-lived Supabase JWT.
//
// Mechanics:
//   1. Override the SDK's base URL to the proxy.
//   2. Patch global fetch ONCE: when the URL starts with the proxy
//      prefix, swap the SDK's `x-goog-api-key` header for an
//      `Authorization: Bearer <supabase-jwt>` header that the edge
//      function's verify_jwt = true gate will accept.
//
// This module also runs, unmodified, inside the background worker (see
// worker/ — a small always-on process that keeps the batch question queue
// moving even with no browser tab open). There's no logged-in browser
// session there to pull a Supabase JWT from, so the interceptor below has a
// second branch: when running under Node (no `window`), it patches
// `globalThis.fetch` instead and authenticates with a shared worker secret
// (WORKER_SHARED_SECRET) that the edge function's auth gate also accepts —
// see the `X-Worker-Secret` branch in supabase/functions/gemini-proxy.

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
// The Supabase Edge Function — always the last resort.
const EDGE_PROXY_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/gemini-proxy` : '';

// Optional long-running proxy hosts, tried first and in order: the
// background worker's server on Render (or Railway, or anything running
// worker/), which serves the very same proxy code without the Edge
// Function's wall-clock limit — the limit long Deep-notes sections run
// into. Comma-separated base URLs, e.g. "https://notesmaker.onrender.com".
// Unset = everything goes to the Edge Function exactly as before.
const SERVER_PROXY_URLS = (readEnv('VITE_AI_PROXY_URL') || '')
  .split(',')
  .map(u => u.trim().replace(/\/+$/, ''))
  .filter(u => /^https?:\/\//.test(u))
  .map(u => `${u}/gemini-proxy`);

// With server proxies configured, the SDK is pointed at a placeholder base
// and the interceptor below maps each request onto a real host (server
// proxies first, then the Edge Function), so a fallback never needs a
// second SDK client. Without them the base is the Edge Function itself and
// requests go out exactly as they always have.
const PROXY_BASE_URL = !EDGE_PROXY_URL ? '' : SERVER_PROXY_URLS.length ? 'https://ai-proxy.notesmaker.invalid' : EDGE_PROXY_URL;
const proxyHosts = (): string[] => [...SERVER_PROXY_URLS, EDGE_PROXY_URL].filter(Boolean);

// A host that just failed is skipped for a while, so every call doesn't
// first wait out a sleeping or unreachable server before falling back.
const HOST_COOLDOWN_MS = 2 * 60_000;
const hostDownUntil = new Map<string, number>();

// Whether a reply means "this host can't serve the call" rather than "the
// call itself is bad" — only then is the next host tried. A reply without
// the proxy's marker header didn't come from the proxy at all (a sleeping
// host's gateway page, an older worker build without the route). 502/503/
// 504 cover an unconfigured or failing server proxy and gateway timeouts.
// Errors from the AI itself (400 bad request, 401/403 auth, 404 unknown
// model, 429 quota) are passed back unchanged: another host would only
// repeat them.
const isHostFailure = (res: Response) =>
  res.headers.get('X-NM-AI-Proxy') !== '1' || res.status === 502 || res.status === 503 || res.status === 504;

// --- Global AI concurrency cap -----------------------------------------
// The gemini-proxy edge function imposes NO rate limit of its own — the
// real ceiling is Vertex AI's per-minute quota (a fresh GCP project gets
// ~30-60 RPM; the proxy retries 429s with backoff). Our section calls are
// long (30-60s each), so ~30 simultaneous calls produce roughly
// 30-60 requests/minute — around the quota ceiling; the proxy's own
// 429 backoff-retries plus the client's per-section retries absorb
// the occasional throttle. This semaphore sits
// on the ONE chokepoint every AI call flows through (the proxy fetch
// interceptor below), so no matter how pipeline-level and sub-batch
// parallelism multiply (sections × sub-batches × add-a-point clicks…),
// the wire never carries more than this many AI requests at once —
// extras simply queue here until a slot frees.
const MAX_CONCURRENT_AI_CALLS = 30;
let aiCallsInFlight = 0;
const aiSlotWaiters: (() => void)[] = [];
const acquireAiSlot = (): Promise<void> => new Promise((resolve) => {
  if (aiCallsInFlight < MAX_CONCURRENT_AI_CALLS) {
    aiCallsInFlight++;
    resolve();
  } else {
    aiSlotWaiters.push(() => { aiCallsInFlight++; resolve(); });
  }
});
const releaseAiSlot = () => {
  aiCallsInFlight--;
  const next = aiSlotWaiters.shift();
  if (next) next();
};

function installProxyFetchInterceptor() {
  if (!PROXY_BASE_URL) return;
  // Browser: patch window.fetch, authenticate as the logged-in user.
  // Worker (no window): patch globalThis.fetch, authenticate with the
  // shared worker secret instead — there's no browser session to pull a
  // Supabase JWT from.
  const isBrowser = typeof window !== 'undefined';
  const globalTarget: any = isBrowser ? window : globalThis;
  if (globalTarget.__notesmakerAiFetchPatched) return;
  const origFetch = globalTarget.fetch.bind(globalTarget);
  globalTarget.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    if (url.startsWith(PROXY_BASE_URL)) {
      await acquireAiSlot();
      try {
        const headers = new Headers(init?.headers || {});
        headers.delete('x-goog-api-key');
        if (isBrowser) {
          const token = await getAccessToken();
          if (!token) throw new Error('Sign-in required for AI features.');
          headers.set('Authorization', `Bearer ${token}`);
          const anon = readEnv('VITE_SUPABASE_ANON_KEY');
          if (anon && !headers.has('apikey')) headers.set('apikey', anon);
        } else {
          const workerSecret = readEnv('WORKER_SHARED_SECRET');
          if (!workerSecret) throw new Error('WORKER_SHARED_SECRET is not set for the background worker.');
          headers.set('X-Worker-Secret', workerSecret);
        }
        const suffix = url.slice(PROXY_BASE_URL.length);
        const hosts = proxyHosts();
        // Healthy hosts first, in configured order; cooled-down ones are
        // still tried last rather than not at all.
        const now = Date.now();
        const ordered = [
          ...hosts.filter(h => (hostDownUntil.get(h) ?? 0) <= now),
          ...hosts.filter(h => (hostDownUntil.get(h) ?? 0) > now),
        ];
        // A request body the SDK hands over as a string can be replayed
        // against the next host; anything else (a stream) can be sent once.
        const replayable = init?.body == null || typeof init.body === 'string';
        let lastError: unknown = null;
        for (let i = 0; i < ordered.length; i++) {
          const host = ordered[i];
          const isLast = i === ordered.length - 1 || !replayable;
          try {
            const res = await origFetch(host + suffix, { ...init, headers });
            if (!isLast && isHostFailure(res)) {
              hostDownUntil.set(host, Date.now() + HOST_COOLDOWN_MS);
              continue;
            }
            if (res.ok) hostDownUntil.delete(host);
            return res;
          } catch (err) {
            // Aborted by the caller: stop, don't retry elsewhere.
            if ((err as any)?.name === 'AbortError') throw err;
            lastError = err;
            hostDownUntil.set(host, Date.now() + HOST_COOLDOWN_MS);
            if (isLast) throw err;
          }
        }
        throw lastError ?? new Error('No AI proxy reachable.');
      } finally {
        releaseAiSlot();
      }
    }
    return origFetch(input, init);
  };
  globalTarget.__notesmakerAiFetchPatched = true;
}

export const createAIClient = () => {
  if (PROXY_BASE_URL) {
    installProxyFetchInterceptor();
    // apiKey is a placeholder — the interceptor above swaps it for the
    // user's Supabase JWT before the request leaves the browser.
    return new GoogleGenAI({
      apiKey: 'proxied',
      httpOptions: { baseUrl: PROXY_BASE_URL },
    });
  }

  const geminiApiKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined) ||
    '';

  if (geminiApiKey) {
    return new GoogleGenAI({
      apiKey: geminiApiKey,
    });
  }

  throw new Error('Gemini API is not configured. Please set GEMINI_API_KEY in your environment or configure Supabase.');
};

// --- Generation budgets ----------------------------------------------------
// Gemini 3 (gemini-3.1-pro-preview / gemini-3.1-flash-lite) are *thinking*
// models. On Vertex they default to a large dynamic thinking budget, and
// thinking tokens are billed against maxOutputTokens. With the proxy's small
// default output cap the model spends its whole allotment "thinking" and only
// emits the heading skeleton before getting cut off — which is why notes
// started coming back as "headings only" after the Vertex switch.
//
// Fix: give long-form generators a generous output cap and a *bounded*
// thinking level so there's plenty of room left for the actual notes. The
// proxy translates thinkingLevel -> Vertex's integer thinkingBudget
// (LOW=1024, MEDIUM=8192, HIGH=dynamic). maxOutputTokens passes through
// untouched, so no proxy change is needed.

// Detailed, exhaustive notes for a topic — HIGH thinking for depth + a
// large output cap so the full answer (not just the heading skeleton) lands.
export const DETAILED_NOTES_CONFIG = {
  maxOutputTokens: 49152,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
} as const;

// Long, dense notes / answers — bounded thinking, large output room.
export const NOTES_GEN_CONFIG = {
  maxOutputTokens: 32768,
  thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
} as const;

// Deep research / analysis — keep HIGH thinking but cap output generously
// so a long answer isn't truncated mid-way.
export const RESEARCH_GEN_CONFIG = {
  maxOutputTokens: 49152,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
} as const;

// UPSC Mains answers — HIGH thinking for genuinely analytical, well-argued
// answers; output cap is smaller than the notes generators (an answer is a
// few hundred words of HTML, not a whole chapter) but still generous enough
// that grounding citations + formatting never truncate the answer.
// temperature is nudged up from the model default (~1.0) so regenerating the
// SAME question twice — e.g. clicking "Topper's" again, or a student
// re-running a practice question — doesn't come back near-identical every
// time; still low enough that structure/facts stay reliable, not erratic.
export const UPSC_ANSWER_CONFIG = {
  maxOutputTokens: 24576,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  temperature: 1.15,
} as const;

// UPSC Essay Paper — same reasoning depth as an answer, larger output cap
// since a full essay (~1000-1500 words) runs longer than a marks-based
// answer, and the same variety-friendly temperature.
export const ESSAY_CONFIG = {
  maxOutputTokens: 32768,
  thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  temperature: 1.15,
} as const;

// Attaches live Google Search grounding to a call's config when the user has
// the "Google Grounding" toggle on. Applied to every generation call in the
// leveled pipelines (outline + every section's expansion + the completeness/
// add-a-point calls) — not just the end-of-pipeline scan — so sections are
// written with real current facts from the start rather than patched
// afterwards. `enabled` defaults to false so every existing call site that
// doesn't pass it keeps its exact previous behavior.
export const withGoogleSearch = <T extends object>(config: T, enabled: boolean = false): T =>
  enabled ? ({ ...config, tools: [{ googleSearch: {} }] } as T) : config;

export const cleanHtmlOutput = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/^\s*```html\s*/i, '')
    .replace(/^\s*```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
};

export const buildContents = (prompt: string, images?: { base64: string; mimeType: string }[]) => {
  if (!images || images.length === 0) return prompt;
  // MUST include an explicit role. The @google/genai SDK's tContent() only
  // adds `role: 'user'` when the value it's given does NOT already look like
  // a Content object; a plain `{ parts }` object (no role key) already
  // satisfies that "looks like a Content" check, so it gets forwarded
  // AS-IS with no role at all. Vertex AI's REST endpoint then defaults the
  // missing field to an empty string and rejects it — "Please use a valid
  // role: user, model" — which is why every image-attached AI edit (Magic
  // AI Editor with an attached image) failed while plain text-only edits
  // worked fine (a bare string prompt goes through the SDK's OTHER branch,
  // which does add role: 'user').
  return {
    role: 'user',
    parts: [
      ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
      { text: prompt },
    ]
  };
};