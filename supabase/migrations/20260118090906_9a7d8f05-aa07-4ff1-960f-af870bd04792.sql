-- Update product-images bucket to allow GIF files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
WHERE id = 'product-images';