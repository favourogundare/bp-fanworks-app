-- =============================================================================
-- Black Panther Fanworks — 0006 media storage
-- A public bucket for post images/video. Authenticated members can upload;
-- anyone can read (public CDN). Run in the Supabase SQL Editor.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Anyone may read objects (the bucket is public / CDN-served).
create policy "post-media public read"
  on storage.objects for select
  using (bucket_id = 'post-media');

-- Signed-in members may upload.
create policy "post-media authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media');

-- Uploaders may delete their own objects.
create policy "post-media owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and owner = auth.uid());
