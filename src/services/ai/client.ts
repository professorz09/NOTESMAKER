import { GoogleGenAI } from "@google/genai";
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