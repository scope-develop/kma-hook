/*
# Embed Images Storage Bucket

## Summary
Creates a public storage bucket for user-uploaded images (embed images, thumbnails, avatars).
Users can upload images and get a public URL to use in Discord embeds.

## Storage
- Bucket: `embed-images` (public, 10MB file size limit, images only)
- Path pattern: `{user_id}/{uuid}.{ext}`

## Security
- INSERT: authenticated users can upload to their own folder
- SELECT: public (bucket is public, anyone can read)
- UPDATE/DELETE: owners can update/delete their own files
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'embed-images',
  'embed-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Storage policies (these operate on storage.objects)
DROP POLICY IF EXISTS "authed_upload_embed_images" ON storage.objects;
CREATE POLICY "authed_upload_embed_images" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'embed-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "public_read_embed_images" ON storage.objects;
CREATE POLICY "public_read_embed_images" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'embed-images');

DROP POLICY IF EXISTS "owner_update_embed_images" ON storage.objects;
CREATE POLICY "owner_update_embed_images" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'embed-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'embed-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "owner_delete_embed_images" ON storage.objects;
CREATE POLICY "owner_delete_embed_images" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'embed-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
