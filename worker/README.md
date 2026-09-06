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

### 4. Keep it awake (free tier only)

Render's free Web Service tier sleeps after 15 minutes with no incoming
HTTP request — the queue only gets processed while it's awake. Point a free
external pinger at your service's URL every 5–10 minutes:

- [cron-job.org](https://cron-job.org) (free, no card) → create a cronjob
  hitting `https://<your-service>.onrender.com/` every 10 minutes.
- Or [UptimeRobot](https://uptimerobot.com) (free tier) the same way.

Without this, the worker still runs whenever it happens to be awake, but a
long unattended batch run may pause for stretches while the service sleeps.
If you're on a paid Render plan instead, skip this step — paid services
don't sleep.

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
