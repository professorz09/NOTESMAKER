// Supabase Edge Function: gemini-proxy (UPSC app)
//
// Forwards Gemini-shape requests to Vertex AI with the GCP Service Account
// credentials attached server-side. The browser bundle NEVER sees the GCP
// key — it can only call this function with its Supabase user JWT.
//
// Why this exists:
//   The original app shipped VITE_GEMINI_API_KEY in the bundle, which a
//   modded build (or anyone opening DevTools → Network) can extract and
//   run unlimited inference on. This proxy keeps credentials on the
//   server and gates access by a valid Supabase JWT.
//
// Routing:
//   When GCP_SA_KEY + GCP_PROJECT_ID env vars are set, generateContent
//   calls go to Vertex AI — billed against the GCP project's billing
//   account (where the $300 free trial credit applies). If those env
//   vars are missing AND GEMINI_API_KEY is set, calls fall back to the
//   AI Studio direct endpoint so the app keeps working during the switch.
//
// Local dev:
//   1. supabase secrets set GCP_SA_KEY="$(cat sa.json)" GCP_PROJECT_ID=...
//   2. supabase functions serve gemini-proxy
//   3. Client calls POST /functions/v1/gemini-proxy/v1beta/models/...
//      with `Authorization: Bearer <supabase-jwt>`.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_VERTEX_REGION = "us-central1";
// Module-scope cache survives across invocations within the same Edge
// Function instance. Cold-start adds ~200ms (one token exchange); every
// other call within the next hour reads from this cache.
let cachedAccessToken = null;
function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for(let i = 0; i < bytes.length; i++)s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToBase64Url(s) {
  return bufToBase64Url(new TextEncoder().encode(s).buffer);
}
async function importPkcs8Pem(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c)=>c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
}
/** Sign a service-account JWT and exchange it at Google's OAuth endpoint
 *  for a short-lived access token. Cached at module scope until ~60s
 *  before expiry so concurrent calls don't race on the boundary. */ async function getVertexAccessToken(saJson) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch  {
    throw new Error("GCP_SA_KEY is not valid JSON");
  }
  if (!sa.private_key || !sa.client_email) {
    throw new Error("GCP_SA_KEY missing private_key or client_email");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: sa.private_key_id
  };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const signingInput = `${strToBase64Url(JSON.stringify(header))}.${strToBase64Url(JSON.stringify(claims))}`;
  const key = await importPkcs8Pem(sa.private_key);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${bufToBase64Url(sigBuf)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Vertex token exchange failed (${tokenRes.status}): ${errText}`);
  }
  const tokenJson = await tokenRes.json();
  const expiresInSec = Number(tokenJson.expires_in ?? 3600);
  cachedAccessToken = {
    token: tokenJson.access_token,
    expiresAt: Date.now() + expiresInSec * 1000
  };
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
 *  Returns a shallow-cloned body — never mutates the caller's object. */ function translateForVertex(body) {
  if (!body || typeof body !== "object") return body;
  const tc = body?.generationConfig?.thinkingConfig;
  if (!tc || typeof tc !== "object") return body;
  const hasLevel = "thinkingLevel" in tc;
  const hasBudget = "thinkingBudget" in tc;
  if (!hasLevel) return body; // Nothing to translate or strip.
  const BUDGET = {
    OFF: 0,
    NONE: 0,
    MINIMAL: 512,
    LOW: 1024,
    MEDIUM: 8192,
    HIGH: -1
  };
  // Drop thinkingLevel either way — if a budget was already supplied keep
  // it, otherwise compute one from the level. Unknown level + no budget
  // means drop the whole field so Vertex falls back to its own default.
  const { thinkingLevel: _drop, ...restThinking } = tc;
  let nextThinking = {
    ...restThinking
  };
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
  const nextGenCfg = {
    ...body.generationConfig
  };
  if (nextThinking === null) {
    delete nextGenCfg.thinkingConfig;
  } else {
    nextGenCfg.thinkingConfig = nextThinking;
  }
  return {
    ...body,
    generationConfig: nextGenCfg
  };
}
/** Forward-migrate model IDs that Google has explicitly deprecated on
 *  Vertex AI. The Upscapp client hard-codes a few preview model strings;
 *  most are still valid (gemini-3-flash-preview, gemini-3.1-pro-preview,
 *  gemini-3.1-flash-lite-preview) and pass through unchanged.
 *
 *  Mappings only target IDs that already 404 from Vertex or are scheduled
 *  to stop serving — so a caller's model selection survives the upstream
 *  retirement without us having to chase the client code.
 *
 *  Source: Google Cloud Vertex AI model lifecycle page (June 2026):
 *    - gemini-3-pro-preview         : discontinued 2026-03-26 → 3.1-pro-preview
 *    - gemini-3.1-flash-lite-preview: discontinued 2026-07-09 → 3.1-flash-lite
 *    - All gemini-2.0 / 1.5 / 1.0   : returns 404 → 2.5-flash-lite (last-resort) */ function normaliseVertexModel(model) {
  const MAP = {
    "gemini-3-pro-preview": "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
    "gemini-2.0-flash": "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-2.5-pro"
  };
  return MAP[model] ?? model;
}
Deno.serve(async (req)=>{
  // Origin allow-list — first line of defence. Even though the JWT gate
  // below blocks raw, unauthenticated callers, the app bakes a single
  // email/password into the frontend so ANY visitor can mint a valid
  // JWT and drain the GCP credit. Browsers can't spoof the Origin
  // header from JS, so pinning the proxy to the deployed app's origins
  // raises the abuse bar significantly. Configure via the
  // ALLOWED_ORIGINS secret (comma-separated). Unset = allow all (dev).
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((o)=>o.trim())
    .filter(Boolean);
  const reqOrigin = req.headers.get("Origin") ?? "";
  const originAllowed = allowedOrigins.length === 0
    || allowedOrigins.includes("*")
    || allowedOrigins.includes(reqOrigin);
  const responseCors = corsHeaders(originAllowed ? reqOrigin : "");
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: responseCors
    });
  }
  if (!originAllowed) {
    return new Response(JSON.stringify({
      error: "Origin not allowed"
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...responseCors
      }
    });
  }
  if (req.method !== "POST") {
    return json({
      error: "Method not allowed"
    }, 405);
  }
  // 1. Auth gate — require a valid Supabase JWT. Without this anyone with
  //    the public function URL can burn the GCP credit.
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return json({
      error: "Missing Authorization header"
    }, 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json({
      error: "Server is missing Supabase env vars"
    }, 500);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: auth
      }
    },
    auth: {
      persistSession: false
    }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({
      error: "Invalid or expired session"
    }, 401);
  }
  // 2. Extract the Gemini API path from the incoming URL. The client sets
  //    httpOptions.baseUrl on the @google/genai SDK so the SDK's native
  //    `POST /v1beta/models/{model}:{action}` lands here verbatim under
  //    /functions/v1/gemini-proxy/v1beta/models/... .
  const reqUrl = new URL(req.url);
  const idx = reqUrl.pathname.indexOf("/gemini-proxy");
  if (idx === -1) {
    return json({
      error: "Proxy mount point not found in URL"
    }, 400);
  }
  const subPath = reqUrl.pathname.slice(idx + "/gemini-proxy".length) || "/";
  // Reject path traversal / scheme-switch tricks before resolving so the
  // origin pinning below isn't bypassable.
  if (subPath.includes("..") || subPath.includes("//") || subPath.includes("\\") || /%2e%2e|%2f%2f|%5c/i.test(subPath)) {
    return json({
      error: "Path contains disallowed sequence"
    }, 400);
  }
  let resolved;
  try {
    resolved = new URL(subPath, GEMINI_BASE);
  } catch  {
    return json({
      error: "Invalid path"
    }, 400);
  }
  if (resolved.origin !== new URL(GEMINI_BASE).origin) {
    return json({
      error: "Path must resolve under Gemini base"
    }, 400);
  }
  if (!resolved.pathname.startsWith("/v1beta/models/")) {
    return json({
      error: "Path must be under /v1beta/models/"
    }, 400);
  }
  // 3. Read and bound the request body. 6 MB matches Supabase's inline-
  //    upload ceiling and covers text prompts + PDF text + small images.
  const MAX_BODY_BYTES = 6 * 1024 * 1024;
  const declaredLen = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
    return json({
      error: "Request body too large"
    }, 413);
  }
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return json({
      error: "Request body too large"
    }, 413);
  }
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch  {
    return json({
      error: "Invalid JSON body"
    }, 400);
  }
  const isGenerateCall = resolved.pathname.endsWith(":generateContent");
  const gcpSaKey = Deno.env.get("GCP_SA_KEY");
  const gcpProjectId = Deno.env.get("GCP_PROJECT_ID");
  const gcpRegion = Deno.env.get("GCP_REGION") ?? DEFAULT_VERTEX_REGION;
  const vertexConfigured = !!gcpSaKey && !!gcpProjectId;
  const useVertex = vertexConfigured && isGenerateCall;
  // Extract the model name from the path so we can route it correctly.
  // Path shape: /v1beta/models/{model}:{action}
  const modelMatch = resolved.pathname.match(/\/v1beta\/models\/([^:]+):/);
  const model = modelMatch ? modelMatch[1] : "";
  let upstreamRes;
  let lastErrText = "";
  if (useVertex) {
    // Vertex AI :generateContent — same body shape as Gemini REST except
    // for the thinkingConfig translation handled above.
    // Map AI-Studio-only preview names (gemini-3-flash-preview etc.) onto
    // the closest Vertex-supported model so an outdated client model
    // string doesn't 404 the whole feature.
    const vertexModel = normaliseVertexModel(model);
    // Gemini 3 preview models are only served on Vertex's *global*
    // endpoint (no region prefix). Regional endpoints (us-central1,
    // europe-west4) return 404 for gemini-3.x. The "global" pseudo-region
    // is the location segment AND swaps the hostname to the un-prefixed
    // one — without that swap the URL becomes global-aiplatform...
    // which doesn't resolve.
    const hostname = gcpRegion === "global"
      ? "aiplatform.googleapis.com"
      : `${gcpRegion}-aiplatform.googleapis.com`;
    const url = `https://${hostname}/v1/projects/${gcpProjectId}/locations/${gcpRegion}/publishers/google/models/${vertexModel}:generateContent`;
    const vertexBody = translateForVertex(body);
    // Vertex on a fresh GCP project enforces strict per-minute quotas
    // (often 30-60 RPM). Retry with short exponential backoff so most
    // transient 429s recover before we surface an error.
    const BACKOFF_MS = [
      0,
      300,
      700,
      1400,
      2500
    ];
    let accessToken;
    try {
      accessToken = await getVertexAccessToken(gcpSaKey);
    } catch (err) {
      return json({
        error: `Vertex auth failed: ${err?.message ?? err}`
      }, 502);
    }
    let res = null;
    for(let attempt = 0; attempt < BACKOFF_MS.length; attempt++){
      if (BACKOFF_MS[attempt] > 0) {
        await new Promise((r)=>setTimeout(r, BACKOFF_MS[attempt]));
      }
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(vertexBody)
        });
      } catch (err) {
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
    if (!res) {
      return json({
        error: `Vertex unreachable: ${lastErrText || "unknown"}`
      }, 502);
    }
    upstreamRes = res;
  } else {
    // Fallback: AI Studio direct. Used when GCP creds aren't configured
    // yet OR for endpoints other than :generateContent (the only one we
    // translate). Requires GEMINI_API_KEY in env. If neither is set we
    // 500 because there's no way to serve the request.
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({
        error: "Server has no AI backend configured (set GCP_SA_KEY+GCP_PROJECT_ID or GEMINI_API_KEY)"
      }, 500);
    }
    const upstream = `${GEMINI_BASE}${resolved.pathname}?key=${encodeURIComponent(apiKey)}`;
    try {
      upstreamRes = await fetch(upstream, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      return json({
        error: `Upstream fetch failed: ${err?.message ?? err}`
      }, 502);
    }
  }
  let text = await upstreamRes.text();
  // Scrub the AI Studio API key from any error body before forwarding to
  // the client. Google's 403 ("Consumer 'api_key:AIza...' has been
  // suspended") embeds the literal key in the user-visible message.
  if (!upstreamRes.ok && text) {
    text = text.replace(/api_key:\s*AIza[\w-]+/gi, "api_key:[redacted]").replace(/key=AIza[\w-]+/gi, "key=[redacted]").replace(/AIza[\w-]{20,}/g, "[redacted]");
  }
  return new Response(text, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json",
      ...corsHeaders()
    }
  });
});
function corsHeaders(echoOrigin?: string) {
  // When ALLOWED_ORIGINS is set, echo back the specific origin instead
  // of "*" so credentialed requests work and a single misconfigured
  // origin can't impersonate the allow-list. Empty echoOrigin = caller
  // is not on the list (request will get a 403 below) — still emit a
  // safe non-empty value so the preflight error message is readable.
  const origin = echoOrigin && echoOrigin.length > 0 ? echoOrigin : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-goog-api-key, X-Client-Info"
  };
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}
