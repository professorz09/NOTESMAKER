# NotesMaker batch-queue worker

Keeps the app's Batch Question Queue moving even with no browser tab open —
queue 80 questions, close your laptop, and this process (running on Render,
for free) keeps generating and saving answers in the background. Open the
app later and they're all there.

It polls the same `pending_questions` table the app already writes to, and
generates through the exact same AI code the app uses (`../src/services/ai`)
— no separate prompts to keep in sync.

## One-time setup

### 1. Give the AI proxy a worker secret

The app's `gemini-proxy` Supabase Edge Function normally only accepts calls
from a logged-in browser session. This worker has no browser session, so it
authenticates with a shared secret instead. Generate one and set it on the
edge function:

```bash
openssl rand -hex 32
# copy the output, then:
supabase secrets set WORKER_SHARED_SECRET=<paste-it-here>
```

(If your `gemini-proxy` deployment predates this feature, redeploy it first —
`supabase functions deploy gemini-proxy` — so it knows to check this secret.)

### 2. Get your Supabase service role key

Supabase Dashboard → your project → Project Settings → API → **service_role**
key (NOT the anon key — this one bypasses Row Level Security, which the
worker needs since it processes every user's queue, not just one).

### 3. Deploy to Render (free)

This repo includes `render.yaml` at the root, so the easiest path is:

1. Render Dashboard → **New +** → **Blueprint** → connect this repo/branch.
2. Render reads `render.yaml` and proposes one service, `notesmaker-batch-worker`.
3. When prompted, fill in the three env vars:
   - `VITE_SUPABASE_URL` — same URL the app itself uses.
   - `SUPABASE_SERVICE_ROLE_KEY` — from step 2.
   - `WORKER_SHARED_SECRET` — from step 1 (the exact same string).
4. Deploy.

(No Blueprint? Create the service by hand instead: **New +** → **Web
Service**, same repo, Build Command `npm install && npm install --prefix
worker`, Start Command `npm --prefix worker start`, plan **Free**, same
three env vars.)

### 4. Keeping it awake (free tier) — handled automatically

Render's free Web Service tier sleeps after ~15 minutes with no **inbound**
HTTP request. Everything this worker does is outbound, so its own work
counts for nothing: without inbound traffic a long queue goes to sleep
mid-run and simply stops, with items still pending and nothing generating.

The worker handles this itself now — it requests its own public URL every
10 minutes (using `RENDER_EXTERNAL_URL`, which Render sets for you), which
is inbound traffic like any other. Nothing to configure. Check
`lastSelfPingAt` on the health endpoint to confirm it's firing.

An external pinger ([cron-job.org](https://cron-job.org),
[UptimeRobot](https://uptimerobot.com) — both free) pointed at the same URL
every 10 minutes still works as a belt-and-braces backup, and covers the
one case the self-ping can't: a process that has already died. It is no
longer required, though. On a paid plan none of this matters — paid
services don't sleep.

## How it behaves

- Picks up the **oldest pending item that already has a note to write into**
  (items queued before any note existed yet are left for the app itself,
  since only it knows what's currently on screen).
- One item at a time, same pacing as the app (~60s between items) to stay
  under Vertex AI's per-minute quota.
- 3 attempts per item (90s apart) before marking it `failed` — same as the
  app's own retry policy.
- Safe to run at the same time as the app actively processing its own
  queue: claiming an item is an atomic "still pending?" update, so the
  worker and a browser tab can never both generate the same question twice.

## Local testing

```bash
cp .env.example .env   # fill in the three values
npm install
npm start
```

`npm run typecheck` runs `tsc --noEmit` if you want to check types without
starting the poll loop.

## Long-running AI proxy (optional)

Long Deep-notes sections can outlast the Supabase Edge Function's time
limit. This server can serve the same AI proxy without that limit, at
`/gemini-proxy` — it runs the Edge Function's own code
(`supabase/functions/gemini-proxy/core.ts`), with the same checks: a valid
Supabase login (or the worker secret), the `ALLOWED_ORIGINS` list, paths
pinned under `/v1beta/models/`, and a bounded body.

1. On Render, add `GCP_SA_KEY` (the whole service-account `.json` as one
   value) and, if the Supabase function uses it, the same `ALLOWED_ORIGINS`.
2. On the frontend host (Vercel), add
   `VITE_AI_PROXY_URL=https://<this-service>.onrender.com` and redeploy.

The app then tries this server first and falls back to the Supabase function
whenever this one is unset, asleep, unreachable or not configured — nothing
breaks if it goes away. The health JSON at `/` shows `aiProxy: ready` once
the key is set.
