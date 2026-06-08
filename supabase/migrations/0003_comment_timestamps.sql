-- Binned timestamps + OpenTimestamps anchoring for comments (mirrors posts).
-- Run in the SQL editor for project qcgjevnchsmticnrhafb.

alter table public.comments
  add column if not exists posted_at    timestamptz,
  add column if not exists posted_label text,
  add column if not exists posted_date  date,
  add column if not exists content_hash text,
  add column if not exists ots_status   text not null default 'none',
  add column if not exists ots_proof    text,
  add column if not exists anchored_at  timestamptz;

create index if not exists comments_ots_status_idx on public.comments (ots_status);

-- Comments are immutable (no edit), so just coarsen the stored creation time.
alter table public.comments alter column created_at set default date_trunc('hour', now());

-- Word limits (250–750 words) are enforced in the app; widen the char guard so
-- a 750-word comment fits.
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments
  add constraint comments_body_check check (char_length(body) between 1 and 8000);

-- Backfill existing comments so displays/anchoring have values.
update public.comments
   set posted_at    = date_trunc('hour', created_at),
       posted_date  = created_at::date,
       posted_label = 'earlier'
 where posted_at is null;

update public.comments set created_at = date_trunc('hour', created_at);
