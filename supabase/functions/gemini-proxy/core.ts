// Runtime-neutral core of the Gemini → Vertex AI proxy.
//
// Shared, unmodified, by BOTH places the proxy runs:
//   - the Supabase Edge Function (./index.ts, Deno), and
//   - the background worker's HTTP server (worker/src/aiProxy.ts, Node),
//     which serves long generations without the Edge Function's wall-clock
//     limit.
// Keeping one copy is the point: the two hosts can never drift apart in how
// they parse the key, pick the model or talk to Vertex. Nothing in here may
// use Deno.* or node:* — only web-standard fetch / crypto.subtle / atob.
// Configuration arrives as an explicit `env` object from the host.
// deno-lint-ignore-file no-explicit-any

export const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_VERTEX_REGION = "us-central1";

export interface ProxyEnv {
  GCP_SA_KEY?: string;
  GCP_PROJECT_ID?: string;
  GCP_REGION?: string;
  GEMINI_API_KEY?: string;
}

export interface ProxyResult {
  status: number;
  text: string;
  contentType: string;
}

const jsonResult = (body: unknown, status: number): ProxyResult => ({
  status,
  text: JSON.stringify(body),
  contentType: "application/json",
});

// Module-scope cache survives across invocations within the same instance.
// Cold-start adds ~200ms (one token exchange); every other call within the
// next hour reads from this cache.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToBase64Url(s: string): string {
  return bufToBase64Url(new TextEncoder().encode(s).buffer as ArrayBuffer);
}
async function importPkcs8Pem(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/** Parse the service-account key exactly as downloaded from Google Cloud
 *  (the whole JSON file pasted into ONE secret). Tolerates what pasting into
 *  a dashboard tends to do to it: wrapping quotes, a base64-encoded copy,
 *  and a private key whose newlines arrived as literal "\\n". */
export function parseServiceAccount(raw: unknown): any {
  let text = String(raw ?? "").trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"') && !text.startsWith('"{'))) {
    text = text.slice(1, -1).trim();
  }
  if (!text.startsWith("{")) {
    try {
      text = atob(text).trim();
    } catch {
      /* not base64 — fall through to the JSON error */
    }
  }
  let sa: any;
  try {
    sa = JSON.parse(text);
    // A JSON string that itself contains the JSON (double-encoded paste).
    if (typeof sa === "string") sa = JSON.parse(sa);
  } catch {
    throw new Error("GCP_SA_KEY is not valid JSON — paste the whole service-account .json file contents");
  }
  if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

/** Sign a service-account JWT and exchange it at Google's OAuth endpoint
 *  for a short-lived access token. Cached until ~60s before expiry so
 *  concurrent calls don't race on the boundary. */
async function getVertexAccessToken(saJson: string): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const sa = parseServiceAccount(saJson);
  if (!sa.private_key || !sa.client_email) {
    throw new Error("GCP_SA_KEY missing private_key or client_email");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${strToBase64Url(JSON.stringify(header))}.${strToBase64Url(JSON.stringify(claims))}`;
  const key = await importPkcs8Pem(sa.private_key);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${bufToBase64Url(sigBuf)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Vertex token exchange failed (${tokenRes.status}): ${errText}`);
  }
  const tokenJson: any = await tokenRes.json();
  const expiresInSec = Number(tokenJson.expires_in ?? 3600);
  cachedAccessToken = { token: tokenJson.access_token, expiresAt: Date.now() + expiresInSec * 1000 };
  return tokenJson.access_token;
}

/** Translate a Gemini REST generateContent body into the shape Vertex
 *  AI's `:generateContent` endpoint actually accepts.
 *
 *  The `@google/genai` SDK serialises `thinkingConfig` as
 *  `{ thinkingLevel: "LOW" | "MEDIUM" | "HIGH" }`, but Vertex's REST
 *  surface only understands the integer `{ thinkingBudget: <number> }`.
 *  An unrecognised `thinkingLevel` field returns 400 INVALID_ARGUMENT.
 *  Map the enum onto the integers Vertex documents for Gemini 2.5/3.x.
 *
 *  Edge cases this defends against:
 *    1. Only thinkingLevel sent           → map to thinkingBudget, strip thinkingLevel.
 *    2. Only thinkingBudget sent          → pass through unchanged.
 *    3. BOTH thinkingLevel + thinkingBudget — happens when caller explicitly
 *       sets thinkingBudget but the SDK also defaults a thinkingLevel. We
 *       trust the caller-supplied thinkingBudget and DROP the thinkingLevel
 *       so Vertex doesn't 400 on the unknown field.
 *    4. Unknown thinkingLevel value       → drop the field entirely rather
 *       than send something Vertex can't parse.
 *
 *  Returns a shallow-cloned body — never mutates the caller's object. */
function translateForVertex(body: any): any {
  if (!body || typeof body !== "object") return body;
  const tc = body?.generationConfig?.thinkingConfig;
  if (!tc || typeof tc !== "object") return body;
  const hasLevel = "thinkingLevel" in tc;
  const hasBudget = "thinkingBudget" in tc;
  if (!hasLevel) return body; // Nothing to translate or strip.
  const BUDGET: Record<string, number> = { OFF: 0, NONE: 0, MINIMAL: 512, LOW: 1024, MEDIUM: 8192, HIGH: -1 };
  // Drop thinkingLevel either way — if a budget was already supplied keep
  // it, otherwise compute one from the level. Unknown level + no budget
  // means drop the whole field so Vertex falls back to its own default.
  const { thinkingLevel: _drop, ...restThinking } = tc;
  let nextThinking: any = { ...restThinking };
  if (!hasBudget) {
    const level = String(tc.thinkingLevel ?? "").toUpperCase();
    const budget = BUDGET[level];
    if (budget === undefined) {
      // No translation possible — drop thinkingConfig entirely rather than
      // forward an empty `{}` that might confuse the server.
      nextThinking = Object.keys(restThinking).length > 0 ? restThinking : null;
    } else {
      nextThinking.thinkingBudget = budget;
    }
  }
  const nextGenCfg = { ...body.generationConfig };
  if (nextThinking === null) delete nextGenCfg.thinkingConfig;
  else nextGenCfg.thinkingConfig = nextThinking;
  return { ...body, generationConfig: nextGenCfg };
}

/** Forward-migrate model IDs that Google has explicitly deprecated on
 *  Vertex AI. The client hard-codes a few preview model strings; most are
 *  still valid and pass through unchanged.
 *
 *  Mappings only target IDs that already 404 from Vertex or are scheduled
 *  to stop serving — so a caller's model selection survives the upstream
 *  retirement without us having to chase the client code.
 *
 *  Source: Google Cloud Vertex AI model lifecycle page (June 2026):
 *    - gemini-3-pro-preview         : discontinued 2026-03-26 → 3.1-pro-preview
 *    - gemini-3.1-flash-lite-preview: discontinued 2026-07-09 → 3.1-flash-lite
 *    - All gemini-2.0 / 1.5 / 1.0   : returns 404 → 2.5-flash-lite (last-resort) */
function normaliseVertexModel(model: string): string {
  const MAP: Record<string, string> = {
    "gemini-3-pro-preview": "gemini-3.1-pro-preview",
    "gemini-3.7-flash": "gemini-3.8-flash",
    "gemini-3-flash-preview": "gemini-3.8-flash",
    "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
    "gemini-2.0-flash": "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-2.5-pro",
  };
  return MAP[model] ?? model;
}

/** Validate the path that follows the proxy's mount point and pin it under
 *  the Gemini models API. Rejects traversal / scheme-switch tricks before
 *  resolving so the origin pinning can't be bypassed. */
export function resolveGeminiPath(subPath: string): { pathname: string } | { error: ProxyResult } {
  if (subPath.includes("..") || subPath.includes("//") || subPath.includes("\\") || /%2e%2e|%2f%2f|%5c/i.test(subPath)) {
    return { error: jsonResult({ error: "Path contains disallowed sequence" }, 400) };
  }
  let resolved: URL;
  try {
    resolved = new URL(subPath, GEMINI_BASE);
  } catch {
    return { error: jsonResult({ error: "Invalid path" }, 400) };
  }
  if (resolved.origin !== new URL(GEMINI_BASE).origin) {
    return { error: jsonResult({ error: "Path must resolve under Gemini base" }, 400) };
  }
  if (!resolved.pathname.startsWith("/v1beta/models/")) {
    return { error: jsonResult({ error: "Path must be under /v1beta/models/" }, 400) };
  }
  return { pathname: resolved.pathname };
}

/** Forward an already-authenticated, already-validated request to Vertex AI
 *  (or, without a service-account key, to AI Studio) and return the reply. */
export async function forwardGemini(pathname: string, body: any, env: ProxyEnv): Promise<ProxyResult> {
  const isGenerateCall = pathname.endsWith(":generateContent");
  const gcpSaKey = env.GCP_SA_KEY;
  // The project id is inside the service-account JSON — GCP_PROJECT_ID is
  // only needed to point a key at a different project than its own.
  let gcpProjectId = env.GCP_PROJECT_ID;
  if (!gcpProjectId && gcpSaKey) {
    try {
      gcpProjectId = parseServiceAccount(gcpSaKey).project_id;
    } catch {
      /* reported when the token is minted */
    }
  }
  let gcpRegion = env.GCP_REGION ?? DEFAULT_VERTEX_REGION;
  // Path shape: /v1beta/models/{model}:{action}
  const modelMatch = pathname.match(/\/v1beta\/models\/([^:]+):/);
  const model = modelMatch ? modelMatch[1] : "";
  // Map retired preview names onto the closest Vertex-supported model so an
  // outdated client model string doesn't 404 the whole feature.
  const vertexModel = normaliseVertexModel(model);
  // Gemini 3 models are only served on Vertex's *global* endpoint — regional
  // endpoints return 404 for gemini-3.x. Force it regardless of GCP_REGION
  // so a stale region setting can't silently break every gemini-3 call.
  if (vertexModel.startsWith("gemini-3") || vertexModel.startsWith("gemini-4")) gcpRegion = "global";

  const useVertex = !!gcpSaKey && !!gcpProjectId && isGenerateCall;
  let upstreamRes: Response;
  let lastErrText = "";
  if (useVertex) {
    // The "global" pseudo-region is the location segment AND swaps the
    // hostname to the un-prefixed one — without that swap the URL becomes
    // global-aiplatform... which doesn't resolve.
    const hostname = gcpRegion === "global" ? "aiplatform.googleapis.com" : `${gcpRegion}-aiplatform.googleapis.com`;
    const url = `https://${hostname}/v1/projects/${gcpProjectId}/locations/${gcpRegion}/publishers/google/models/${vertexModel}:generateContent`;
    // Gemini 4 Argon takes thinking levels (low/medium/high) natively; older
    // models get them translated to a token budget
    const vertexBody = vertexModel.startsWith("gemini-4") ? body : translateForVertex(body);
    // Vertex on a fresh GCP project enforces strict per-minute quotas
    // (often 30-60 RPM). Retry with short exponential backoff so most
    // transient 429s recover before we surface an error.
    const BACKOFF_MS = [0, 300, 700, 1400, 2500];
    let accessToken: string;
    try {
      accessToken = await getVertexAccessToken(gcpSaKey!);
    } catch (err: any) {
      return jsonResult({ error: `Vertex auth failed: ${err?.message ?? err}` }, 502);
    }
    let res: Response | null = null;
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (BACKOFF_MS[attempt] > 0) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(vertexBody),
        });
      } catch (err: any) {
        lastErrText = err?.message ?? String(err);
        console.error(`[gemini-proxy] Vertex fetch threw attempt ${attempt + 1}: ${lastErrText}`);
        continue;
      }
      if (res.ok) break;
      const retryable = res.status === 429 || res.status >= 500;
      const isLast = attempt === BACKOFF_MS.length - 1;
      if (!retryable || isLast) {
        lastErrText = await res.clone().text();
        console.error(`[gemini-proxy] Vertex ${res.status} final (attempt ${attempt + 1}): ${lastErrText.slice(0, 200)}`);
        break;
      }
      console.error(`[gemini-proxy] Vertex ${res.status} attempt ${attempt + 1}, will retry`);
    }
    if (!res) return jsonResult({ error: `Vertex unreachable: ${lastErrText || "unknown"}` }, 502);
    upstreamRes = res;
  } else {
    // Fallback: AI Studio direct. Used when no service-account key is
    // configured OR for endpoints other than :generateContent (the only one
    // we translate). Requires GEMINI_API_KEY.
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResult({ error: "Server has no AI backend configured (set GCP_SA_KEY or GEMINI_API_KEY)" }, 500);
    }
    const upstream = `${GEMINI_BASE}${pathname}?key=${encodeURIComponent(apiKey)}`;
    try {
      upstreamRes = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      return jsonResult({ error: `Upstream fetch failed: ${err?.message ?? err}` }, 502);
    }
  }
  let text = await upstreamRes.text();
  // Scrub the AI Studio API key from any error body before forwarding to
  // the client. Google's 403 ("Consumer 'api_key:AIza...' has been
  // suspended") embeds the literal key in the user-visible message.
  if (!upstreamRes.ok && text) {
    text = text
      .replace(/api_key:\s*AIza[\w-]+/gi, "api_key:[redacted]")
      .replace(/key=AIza[\w-]+/gi, "key=[redacted]")
      .replace(/AIza[\w-]{20,}/g, "[redacted]");
  }
  return {
    status: upstreamRes.status,
    text,
    contentType: upstreamRes.headers.get("Content-Type") ?? "application/json",
  };
}

/** Origin allow-list from a comma-separated ALLOWED_ORIGINS value. Unset or
 *  containing "*" = allow all (dev). Browsers can't spoof Origin from JS. */
export function isOriginAllowed(allowedOriginsRaw: string | undefined, reqOrigin: string): boolean {
  const allowed = String(allowedOriginsRaw ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes("*") || allowed.includes(reqOrigin);
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const PROXY_MARKER_HEADER = "X-NM-AI-Proxy";

export function corsHeaders(echoOrigin?: string): Record<string, string> {
  // When ALLOWED_ORIGINS is set, echo back the specific origin instead of
  // "*" so credentialed requests work and a single misconfigured origin
  // can't impersonate the allow-list. Empty echoOrigin = caller is not on
  // the list (request gets a 403) — still emit a safe non-empty value so
  // the preflight error message is readable.
  const origin = echoOrigin && echoOrigin.length > 0 ? echoOrigin : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Per the Fetch/CORS spec, a wildcard "*" here NEVER matches the
    // "Authorization" header — it must always be listed literally. Every
    // call to this proxy sends "Authorization: Bearer <supabase-jwt>", so
    // without it the preflight fails client-side and every request throws
    // "TypeError: Failed to fetch" with no server-visible trace. The
    // trailing "*" is only a fallback for future SDK headers.
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-goog-api-client, x-goog-api-key, x-goog-upload-status, x-goog-upload-url, *",
    "Access-Control-Max-Age": "86400",
    // Marks a reply as coming from this proxy (not, say, an older worker
    // build answering every path with its health JSON), so the app knows
    // when to fall back to the next host. Exposed so browsers can read it.
    [PROXY_MARKER_HEADER]: "1",
    "Access-Control-Expose-Headers": PROXY_MARKER_HEADER,
  };
}
