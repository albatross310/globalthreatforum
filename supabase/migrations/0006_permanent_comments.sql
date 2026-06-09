-- Make published comments permanent: authors may delete only their own
-- not-yet-published comments; admins may remove any (for moderation/legal).
-- Mirrors the posts delete policy. Two single-line statements (paste-safe).

drop policy if exists "Comment authors and admins can delete comments" on public.comments;
create policy "Authors delete unpublished comments, admins any" on public.comments for delete using ((author_id = auth.uid() and status <> 'published') or public.is_admin());
