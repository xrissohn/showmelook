DROP POLICY IF EXISTS "Authenticated users can view style cache" ON public.style_cache;
REVOKE SELECT ON public.style_cache FROM authenticated, anon;
CREATE POLICY "Admins can view style cache" ON public.style_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.style_cache TO authenticated;
GRANT ALL ON public.style_cache TO service_role;