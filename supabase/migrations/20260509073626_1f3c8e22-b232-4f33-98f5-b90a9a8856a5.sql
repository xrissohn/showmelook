
-- 1. merchants: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view active merchants" ON public.merchants;
CREATE POLICY "Authenticated users can view active merchants"
ON public.merchants FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. model_config: restrict to authenticated
DROP POLICY IF EXISTS "Anyone can read model_config" ON public.model_config;
CREATE POLICY "Authenticated users can read model_config"
ON public.model_config FOR SELECT
TO authenticated
USING (true);

-- 3. recommendation_patterns: restrict to admins only
DROP POLICY IF EXISTS "Anyone can view patterns" ON public.recommendation_patterns;
CREATE POLICY "Admins can view recommendation patterns"
ON public.recommendation_patterns FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. pending_products: remove from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.pending_products;
