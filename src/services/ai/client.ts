import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getAccessToken } from "../supabase";

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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PROXY_BASE_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/gemini-proxy` : '';

function installProxyFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if ((window as any).__notesmakerAiFetchPatched) return;
  if (!PROXY_BASE_URL) return;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    if (url.startsWith(PROXY_BASE_URL)) {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign-in required for AI features.');
      const headers = new Headers(init?.headers || {});
      headers.delete('x-goog-api-key');
      headers.set('Authorization', `Bearer ${token}`);
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (anon && !headers.has('apikey')) headers.set('apikey', anon);
      return origFetch(input, { ...init, headers });
    }
    return origFetch(input, init);
  };
  (window as any).__notesmakerAiFetchPatched = true;
}

export const createAIClient = () => {
  if (!PROXY_BASE_URL) {
    throw new Error('AI proxy not configured — VITE_SUPABASE_URL missing.');
  }
  installProxyFetchInterceptor();
  // apiKey is a placeholder — the interceptor above swaps it for the
  // user's Supabase JWT before the request leaves the browser.
  return new GoogleGenAI({
    apiKey: 'proxied',
    httpOptions: { baseUrl: PROXY_BASE_URL },
  });
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
  return {
    parts: [
      ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
      { text: prompt },
    ]
  };
};