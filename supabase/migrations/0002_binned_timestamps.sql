-- Privacy-preserving binned timestamps + content hash for cryptographic anchoring.
-- Run this in the Supabase SQL editor for project qcgjevnchsmticnrhafb.

alter table public.posts
  add column if not exists posted_at    timestamptz,  -- coarse OFFICIAL instant (8am / rounded hour)
  add column if not exists posted_label text,         -- "around 3pm" | "late evening" | "early morning"
  add column if not exists posted_date  date,         -- author-local date to display
  add column if not exists author_tz    text,         -- IANA zone (server-only; not exposed to anon)
  add column if not exists content_hash text,         -- sha256 of {title, content, author, binned time}
  add column if not exists ots_status   text not null default 'none', -- none | pending | confirmed
  add column if not exists ots_proof    text,         -- base64 OpenTimestamps proof (filled in phase 2)
  add column if not exists anchored_at  timestamptz;  -- when the OTS proof was confirmed

create index if not exists posts_posted_at_idx on public.posts (posted_at desc);

-- Backfill existing rows so displays have something to show.
update public.posts
   set posted_at   = coalesce(published_at, updated_at, created_at),
       posted_date = coalesce(published_at, updated_at, created_at)::date,
       posted_label = 'earlier'
 where posted_at is null;

-- The public (anon) must never see exact server timestamps or the author's
-- timezone — only the binned posted_* fields. Replace anon's blanket SELECT
-- with a column whitelist. (authenticated keeps full access; RLS still limits
-- which rows authors/admins can see.)
revoke select on public.posts from anon;
grant select
  (id, author_id, title, slug, content, excerpt, status,
   posted_at, posted_label, posted_date, content_hash, ots_status, anchored_at)
  on public.posts to anon;
