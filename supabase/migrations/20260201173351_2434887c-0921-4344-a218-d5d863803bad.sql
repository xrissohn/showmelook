-- Fix generated_looks public exposure by adding is_public column and updating RLS policies

-- 1. Add is_public column with default false (privacy by default)
ALTER TABLE public.generated_looks 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 2. Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view looks for sharing" ON public.generated_looks;

-- 3. Create new policy: only public looks OR looks owned by user can be viewed
-- This allows sharing while protecting private looks
CREATE POLICY "Public can view shared looks or own looks"
ON public.generated_looks
FOR SELECT
USING (
  is_public = true 
  OR auth.uid() = user_id
);

-- 4. Update existing shared looks to be public (opt-in migration)
-- All previously "shared" looks were implicitly public, so mark them as such
-- We set is_public = true for looks that have been created before this change
UPDATE public.generated_looks 
SET is_public = true 
WHERE is_public IS NULL OR is_public = false;

-- 5. Add index for better performance on public looks queries
CREATE INDEX IF NOT EXISTS idx_generated_looks_is_public ON public.generated_looks(is_public) WHERE is_public = true;