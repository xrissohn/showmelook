-- Add public read policy for shared looks
-- This allows anyone to view looks via shared links while keeping other operations protected

CREATE POLICY "Anyone can view looks for sharing"
ON public.generated_looks
FOR SELECT
USING (true);