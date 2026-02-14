-- Storage bucket for admin image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/delete
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'images');

-- Allow public read access
CREATE POLICY "Public read access for images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'images');
