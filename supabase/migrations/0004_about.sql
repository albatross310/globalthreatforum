-- Versioned About page. Each edit inserts a new row; the newest is "current"
-- and all older ones remain as a public archive.
-- Run in the SQL editor for project qcgjevnchsmticnrhafb.

create table if not exists public.about_versions (
  id         uuid primary key default gen_random_uuid(),
  content    jsonb not null,
  created_at timestamptz not null default date_trunc('hour', now())
);

create index if not exists about_versions_created_idx
  on public.about_versions (created_at desc);

alter table public.about_versions enable row level security;

grant select on public.about_versions to anon, authenticated;
grant insert on public.about_versions to authenticated;

-- Anyone can read the about page and its history.
create policy "About versions are public"
  on public.about_versions for select
  using (true);

-- Only admins can publish a new about version (old ones are never edited or
-- deleted, so the archive is append-only).
create policy "Admins can add about versions"
  on public.about_versions for insert
  with check (public.is_admin());
