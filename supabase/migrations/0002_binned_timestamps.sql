-- Privacy-preserving binned timestamps + content hash for cryptographic anchoring.
-- Run this in the Supabase SQL editor for project qcgjevnchsmticnrhafb.

alter table public.posts
  add column if not exists posted_at    timestamptz,  -- coarse OFFICIAL instant (8am / rounded hour)
  add column if not exists posted_label text,         -- "around 3pm" | "evening" | "early morning"
  add column if not exists posted_date  date,         -- author-local date to display
  add column if not exists author_tz    text,         -- IANA zone (server-only; not exposed to anon)
  add column if not exists content_hash text,         -- sha256 of {title, content, author, binned time}
  add column if not exists ots_status   text not null default 'none', -- none | pending | confirmed
  add column if not exists ots_proof    text,         -- base64 OpenTimestamps proof (filled in phase 2)
  add column if not exists anchored_at  timestamptz;  -- when the OTS proof was confirmed

create index if not exists posts_posted_at_idx on public.posts (posted_at desc);

-- ---------------------------------------------------------------------------
-- Coarsen stored row timestamps so NO exact instant ever lives in the table.
-- ---------------------------------------------------------------------------

-- New rows: hour-resolution at worst (the app overrides with the binned time).
alter table public.posts
  alter column created_at set default date_trunc('hour', now()),
  alter column updated_at set default date_trunc('hour', now());

-- On every update, tie updated_at to the binned posted time (never an exact
-- instant). Falls back to the current hour if posted_at is somehow missing.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = coalesce(new.posted_at, date_trunc('hour', now()));
  return new;
end $$;

-- Backfill existing rows so displays have something to show. (This update fires
-- the trigger above, which coarsens their updated_at to posted_at.)
update public.posts
   set posted_at   = date_trunc('hour', coalesce(published_at, updated_at, created_at)),
       posted_date = coalesce(published_at, updated_at, created_at)::date,
       posted_label = 'earlier'
 where posted_at is null;

-- Coarsen the timestamps the trigger doesn't touch on existing rows.
update public.posts
   set created_at = date_trunc('hour', created_at),
       published_at = case when published_at is not null
                           then date_trunc('hour', published_at) end;

-- ---------------------------------------------------------------------------
-- The public (anon) must never see exact server timestamps or the author's
-- timezone — only the binned posted_* fields. Replace anon's blanket SELECT
-- with a column whitelist. (authenticated keeps full access; RLS still limits
-- which rows authors/admins can see.)
-- ---------------------------------------------------------------------------
revoke select on public.posts from anon;
-- ots_proof is public by design (that's how anyone verifies the timestamp).
grant select
  (id, author_id, title, slug, content, excerpt, status,
   posted_at, posted_label, posted_date, content_hash,
   ots_status, ots_proof, anchored_at)
  on public.posts to anon;
