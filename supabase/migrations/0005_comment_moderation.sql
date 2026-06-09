-- Comment moderation: comments now require admin approval before they appear.
-- Each statement is on its own line (paste-safe). Run in the SQL editor.

alter table public.comments add column if not exists status text not null default 'pending_review' check (status in ('pending_review','published','rejected'));
alter table public.comments add column if not exists review_note text;
update public.comments set status = 'published' where status = 'pending_review';
create index if not exists comments_status_idx on public.comments (status);
grant update on public.comments to authenticated;
drop policy if exists "Comments on published posts are readable" on public.comments;
create policy "Readable comments" on public.comments for select using ((status = 'published' and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')) or author_id = auth.uid() or public.is_admin());
drop policy if exists "Signed-in users can comment on published posts" on public.comments;
create policy "Members submit comments for review" on public.comments for insert with check (author_id = auth.uid() and status = 'pending_review' and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "Admins moderate comments" on public.comments for update using (public.is_admin()) with check (public.is_admin());
