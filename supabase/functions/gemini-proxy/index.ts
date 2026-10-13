// Supabase Edge Function: gemini-proxy (UPSC app)
//
// Forwards Gemini-shape requests to Vertex AI with the GCP Service Account
// credentials attached server-side. The browser bundle NEVER sees the GCP
// key — it can only call this function with its Supabase user JWT, or (see
// below) the background worker's shared secret.
//
// Why this exists:
//   The original app shipped VITE_GEMINI_API_KEY in the bundle, which a
//   modded build (or anyone opening DevTools → Network) can extract and
//   run unlimited inference on. This proxy keeps credentials on the
//   server and gates access by a valid Supabase JWT.
//
// Background worker (worker/):
//   A second, always-on caller with no browser session to hand over a JWT
//   authenticates instead with `X-Worker-Secret: <WORKER_SHARED_SECRET>`,
//   checked further down. Set WORKER_SHARED_SECRET as a secret on this
//   function (`supabase secrets set WORKER_SHARED_SECRET=...`) and give the
//   worker the exact same value — leave it unset to disable this path
//   entirely (a missing secret never matches, so worker calls just 401).
//
// Routing:
//   When GCP_SA_KEY is set — the whole service-account .json pasted as one
//   value; the project id is read from it (GCP_PROJECT_ID only overrides
//   it) — generateContent calls go to Vertex AI, billed against the GCP
//   project's billing account (where the $300 free trial credit applies).
//   If it is missing AND GEMINI_API_KEY is set, calls fall back to the
//   AI Studio direct endpoint so the app keeps working during the switch.
//
// The proxying itself (key parsing, model mapping, the Vertex call) lives in
// ./core.ts, shared with the worker's Node proxy (worker/src/aiProxy.ts)
// that serves long generations without this function's wall-clock limit.
// This file is only the Deno host: auth, origin check, body limit.
//
// Local dev:
//   1. supabase secrets set GCP_SA_KEY="$(cat sa.json)"
//   2. supabase functions serve gemini-proxy
//   3. Client calls POST /functions/v1/gemini-proxy/v1beta/models/...
//      with `Authorization: Bearer <supabase-jwt>`.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, forwardGemini, isOriginAllowed, resolveGeminiPath, safeEqual } from "./core.ts";

Deno.serve(async (req)=>{
  // Origin allow-list — first line of defence. Even though the JWT gate
  // below blocks raw, unauthenticated callers, the app bakes a single
  // email/password into the frontend so ANY visitor can mint a valid
  // JWT and drain the GCP credit. Browsers can't spoof the Origin
  // header from JS, so pinning the proxy to the deployed app's origins
  // raises the abuse bar significantly. Configure via the
  // ALLOWED_ORIGINS secret (comma-separated). Unset = allow all (dev).
  const reqOrigin = req.headers.get("Origin") ?? "";
  const originAllowed = isOriginAllowed(Deno.env.get("ALLOWED_ORIGINS"), reqOrigin);
  const responseCors = corsHeaders(originAllowed ? reqOrigin : "");
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: responseCors
    });
  }
  // Background-worker auth: a shared secret only the worker process (see
  // worker/) knows, set as this function's own WORKER_SHARED_SECRET secret.
  // The worker keeps the batch question queue moving with no browser tab
  // open, so it has no logged-in session to pull a per-user JWT from —
  // it authenticates with this secret instead. A trusted server-to-server
  // call like this also skips the Origin check below: Origin is a
  // browser-only concept (plain server fetches don't send one, and CORS
  // itself is enforced by browsers, not by this function), so the check
  // exists purely to gate browser callers, not this one.
  const workerSharedSecret = Deno.env.get("WORKER_SHARED_SECRET");
  const suppliedWorkerSecret = req.headers.get("X-Worker-Secret");
  const isWorkerCall = !!workerSharedSecret && !!suppliedWorkerSecret && safeEqual(suppliedWorkerSecret, workerSharedSecret);
  if (!isWorkerCall && !originAllowed) {
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
  if (!isWorkerCall) {
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
  const resolved = resolveGeminiPath(subPath);
  if ("error" in resolved) {
    return new Response(resolved.error.text, {
      status: resolved.error.status,
      headers: {
        "Content-Type": resolved.error.contentType,
        ...corsHeaders()
      }
    });
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
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch  {
    return json({
      error: "Invalid JSON body"
    }, 400);
  }
  const result = await forwardGemini(resolved.pathname, body, {
    GCP_SA_KEY: Deno.env.get("GCP_SA_KEY"),
    GCP_PROJECT_ID: Deno.env.get("GCP_PROJECT_ID"),
    GCP_REGION: Deno.env.get("GCP_REGION"),
    GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY")
  });
  return new Response(result.text, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      ...corsHeaders(originAllowed ? reqOrigin : "")
    }
  });
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}
