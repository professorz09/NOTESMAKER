-- Daily Current Affairs feature: tag notes so they can be filtered in
-- history, and record the date they belong to so a calendar date-range can
-- pull them all up for a combined read.
--
-- Run this against your Supabase project (SQL editor, or `supabase db push`)
-- before using the Current Affairs section — the app reads/writes these
-- columns unconditionally once deployed.

alter table public.projects
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists entry_date date;

-- Fast "which notes are tagged current-affairs" lookups.
create index if not exists projects_tags_gin_idx
  on public.projects using gin (tags);

-- Fast "notes between these two dates" lookups for the date-range read.
create index if not exists projects_entry_date_idx
  on public.projects (entry_date);
