-- Make generated-looks bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'generated-looks';