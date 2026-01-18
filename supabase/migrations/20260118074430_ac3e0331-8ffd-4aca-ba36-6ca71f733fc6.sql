-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'product-images',
  'product-images', 
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  5242880
);

-- Public read access for product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow uploads via service role
CREATE POLICY "Service role upload for product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Allow updates via service role
CREATE POLICY "Service role update for product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Allow deletes via service role
CREATE POLICY "Service role delete for product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');