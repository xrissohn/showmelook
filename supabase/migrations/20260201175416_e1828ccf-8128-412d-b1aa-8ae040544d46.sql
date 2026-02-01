-- Fix style_cache: Restrict public SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view style cache" ON public.style_cache;

CREATE POLICY "Authenticated users can view style cache"
ON public.style_cache FOR SELECT
TO authenticated
USING (true);

-- Note: "Service role can manage cache" policy remains for backend operations