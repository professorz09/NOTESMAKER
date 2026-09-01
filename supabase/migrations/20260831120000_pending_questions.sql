-- Batch Question Queue: lets a user queue up many topics/questions at once
-- (UPSC answers, essays, research papers, or notes) and have them generated
-- one by one in the background. Previously this queue only lived in
-- memory/localStorage, so it vanished on refresh and never showed up on
-- another device — this table makes it a real, resumable server-side queue
-- instead, mirroring how `projects` itself is stored.
--
-- Run this against your Supabase project (SQL editor, or `supabase db push`)
-- before using the batch-queue feature — the app reads/writes this table
-- unconditionally once deployed, falling back to an in-memory queue for the
-- current tab only if the table isn't there yet.

create table if not exists public.pending_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The project this item's generated content gets appended to. Nullable
  -- because a queue item can be added before the document it will land in
  -- has been saved as a project yet.
  project_id uuid references public.projects(id) on delete cascade,
  -- The topic (Essay/Research/Notes) or exam question (UPSC) to generate.
  question text not null,
  -- Which generator this item runs through — 'upsc' | 'essay' | 'research' | 'notes'.
  output_style text not null default 'upsc',
  -- UPSC-only settings; null for other output styles.
  answer_style text,
  marks integer,
  subject text,
  -- Generation settings snapshotted from the sidebar at the moment the item
  -- was queued, so a later change to the sidebar's language/model/grounding
  -- doesn't retroactively change what an already-queued item generates.
  language text,
  ai_model text,
  grounding boolean not null default true,
  multi_variant boolean not null default false,
  -- pending -> active -> done (row deleted once appended), or -> failed
  -- after exhausting retries.
  status text not null default 'pending',
  attempt integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pending_questions enable row level security;

create policy "Users manage their own pending questions"
  on public.pending_questions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast "give me this project's queue, in the order it was added" reads.
create index if not exists pending_questions_project_created_idx
  on public.pending_questions (project_id, created_at);
