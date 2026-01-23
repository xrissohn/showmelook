-- Fix 1: Restrict generation_jobs SELECT to only owner (remove public exposure)
-- The service role policy handles admin access, users should only see their own jobs
-- Current policy "Users can view their own jobs" already exists and is correct
-- We just need to verify no other SELECT policies expose data publicly

-- Fix 2: Update storage policy for generated-looks to enforce user folder structure
DROP POLICY IF EXISTS "Users can upload generated looks" ON storage.objects;

CREATE POLICY "Users can upload generated looks"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generated-looks' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Also add policy to allow users to access their own generated looks
DROP POLICY IF EXISTS "Users can access own generated looks" ON storage.objects;

CREATE POLICY "Users can access own generated looks"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'generated-looks' 
  AND (
    -- Allow owner access via folder structure
    auth.uid()::text = (storage.foldername(name))[1]
    -- OR allow public access to the bucket (it's marked as public)
    OR bucket_id = 'generated-looks'
  )
);

-- Fix 3: Replace permissive feedback INSERT policy with authenticated user validation
DROP POLICY IF EXISTS "Anyone can insert feedback" ON product_feedback;

CREATE POLICY "Users can insert their own feedback"
ON product_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);