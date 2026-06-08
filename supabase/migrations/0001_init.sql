-- Global Threat Forum — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push` with the CLI).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.post_status as enum ('draft', 'pending_review', 'published', 'rejected');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique,
  content jsonb not null,
  excerpt text not null default '',
  status public.post_status not null default 'draft',
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index posts_status_published_at_idx on public.posts (status, published_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- Functions & triggers
-- ---------------------------------------------------------------------------

-- Keep posts.updated_at fresh
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a user signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1));
begin
  begin
    insert into public.profiles (id, username) values (new.id, base);
  exception when unique_violation or check_violation then
    -- username taken or too short/long: fall back to a unique suffix
    insert into public.profiles (id, username)
    values (new.id, left(base, 25) || '-' || left(new.id::text, 6));
  end;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by RLS policies. SECURITY DEFINER so it can read profiles
-- without recursing through profiles' own RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

-- Table-level grants. RLS filters *rows*, but the roles still need a GRANT to
-- touch the table at all. (Supabase does not always add these automatically.)
grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select on public.posts to anon;
grant select, insert, delete on public.comments to authenticated;
grant select on public.comments to anon;

-- profiles -------------------------------------------------------------------
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Column-level lock: users may change their username but never their role.
revoke update on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

-- posts ----------------------------------------------------------------------
create policy "Published posts are public; authors/admins see unpublished"
  on public.posts for select
  using (status = 'published' or author_id = auth.uid() or public.is_admin());

create policy "Authors can create drafts and submissions"
  on public.posts for insert
  with check (author_id = auth.uid() and status in ('draft', 'pending_review'));

create policy "Authors can edit and resubmit their unpublished posts"
  on public.posts for update
  using (author_id = auth.uid() and status in ('draft', 'pending_review', 'rejected'))
  with check (author_id = auth.uid() and status in ('draft', 'pending_review'));

create policy "Admins can moderate any post"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authors can delete unpublished posts, admins any"
  on public.posts for delete
  using ((author_id = auth.uid() and status <> 'published') or public.is_admin());

-- comments -------------------------------------------------------------------
create policy "Comments on published posts are readable"
  on public.comments for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and (p.status = 'published' or public.is_admin())
    )
  );

create policy "Signed-in users can comment on published posts"
  on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "Comment authors and admins can delete comments"
  on public.comments for delete
  using (author_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: public bucket for post images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true);

-- Each user uploads into a folder named after their user id.
create policy "Authenticated users can upload post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
