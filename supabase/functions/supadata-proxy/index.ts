// Supabase Edge Function: supadata-proxy
//
// Fetches video/audio transcripts from Supadata (https://supadata.ai) with the
// SUPADATA_API_KEY held server-side. The browser bundle NEVER sees the key —
// it can only call this function with a valid Supabase user JWT, exactly like
// the gemini-proxy function.
//
// Why a proxy (not a direct browser fetch):
//   1. Keeps the Supadata API key off the client (a bundled key can be
//      extracted and drained).
//   2. Avoids browser CORS restrictions against api.supadata.ai.
//
// Protocol (client → this function, POST JSON):
//   { "action": "start", "url": "<video url>", "lang"?: "en" }
//       → { status: "completed", content, lang }         (short videos)
//       → { status: "queued", jobId }                    (videos > ~20 min)
//   { "action": "poll", "jobId": "<id>" }
//       → { status: "queued" | "active" }
//       → { status: "completed", content, lang }
//       → { status: "failed", error }
//
// Setup (one time):
//   supabase secrets set SUPADATA_API_KEY=sd_xxx
//   supabase functions deploy supadata-proxy
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPADATA_BASE = "https://api.supadata.ai/v1";

function corsHeaders(echoOrigin?: string) {
  const origin = echoOrigin && echoOrigin.length > 0 ? echoOrigin : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

Deno.serve(async (req) => {
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const allowedOrigins = allowedOriginsRaw.split(",").map((o) => o.trim()).filter(Boolean);
  const reqOrigin = req.headers.get("Origin") ?? "";
  const originAllowed = allowedOrigins.length === 0 || allowedOrigins.includes("*") || allowedOrigins.includes(reqOrigin);
  const responseCors = corsHeaders(originAllowed ? reqOrigin : "");

  if (req.method === "OPTIONS") return new Response("ok", { headers: responseCors });
  if (!originAllowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...responseCors },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth gate — require a valid Supabase JWT.
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Missing Authorization header" }, 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Server is missing Supabase env vars" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid or expired session" }, 401);

  const apiKey = Deno.env.get("SUPADATA_API_KEY");
  if (!apiKey) {
    return json({ error: "Server has no Supadata key configured. Set the SUPADATA_API_KEY secret." }, 500);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = payload?.action;
  let upstreamUrl = "";
  if (action === "start") {
    const url = String(payload?.url ?? "").trim();
    if (!url) return json({ error: "Missing 'url'" }, 400);
    const lang = String(payload?.lang ?? "").trim();
    const params = new URLSearchParams({ url, text: "true", mode: "native" });
    if (lang) params.set("lang", lang);
    upstreamUrl = `${SUPADATA_BASE}/transcript?${params.toString()}`;
  } else if (action === "poll") {
    const jobId = String(payload?.jobId ?? "").trim();
    if (!jobId || !/^[\w-]+$/.test(jobId)) return json({ error: "Missing or invalid 'jobId'" }, 400);
    upstreamUrl = `${SUPADATA_BASE}/transcript/${encodeURIComponent(jobId)}`;
  } else {
    return json({ error: "Unknown action (expected 'start' or 'poll')" }, 400);
  }

  let res: Response;
  try {
    res = await fetch(upstreamUrl, { method: "GET", headers: { "x-api-key": apiKey } });
  } catch (err: any) {
    return json({ error: `Supadata unreachable: ${err?.message ?? err}` }, 502);
  }

  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Supadata error ${res.status}`;
    return json({ error: String(msg), status: "failed" }, res.status === 401 ? 502 : res.status);
  }

  // HTTP 202 → async job accepted; normalize to a queued status the client polls.
  if (res.status === 202 || (data && data.jobId && !data.content)) {
    return json({ status: "queued", jobId: data.jobId });
  }

  // Completed synchronously (short video) or a poll that returned completed.
  const status = data?.status ?? (data?.content != null ? "completed" : "active");
  return json({
    status,
    content: data?.content ?? "",
    lang: data?.lang ?? "",
    jobId: data?.jobId,
    error: data?.error,
  });
});
