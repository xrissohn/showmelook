-- Fix storage delete policy for generated-looks - require ownership via path
DROP POLICY IF EXISTS "Users can delete their generated looks" ON storage.objects;
CREATE POLICY "Users can delete their generated looks"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-looks'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix cafe24_fitting_sessions: restrict SELECT to session_token holders / service role
DROP POLICY IF EXISTS "Anyone can view own fitting session" ON public.cafe24_fitting_sessions;
-- No public select; access only via service role / edge function with token verification
-- Admins can still view
CREATE POLICY "Admins can view fitting sessions"
ON public.cafe24_fitting_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix look_likes: restrict SELECT to authenticated users only, and only show counts via aggregation
-- Keep ability for users to see their own likes; counts can be done via security definer fn
DROP POLICY IF EXISTS "Anyone can view likes" ON public.look_likes;
CREATE POLICY "Users can view their own likes"
ON public.look_likes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Provide a security-definer function for like counts (no PII exposed)
CREATE OR REPLACE FUNCTION public.get_look_like_count(_look_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.look_likes WHERE look_id = _look_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_look_like_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_look_like_count(uuid) TO authenticated, anon;

-- Function to check if current user liked a look
CREATE OR REPLACE FUNCTION public.has_user_liked_look(_look_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.look_likes WHERE look_id = _look_id AND user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.has_user_liked_look(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_user_liked_look(uuid) TO authenticated;

-- Fix rate_limit_state: restrict to service role only
DROP POLICY IF EXISTS "Anyone can view rate limit state" ON public.rate_limit_state;
CREATE POLICY "Admins can view rate limit state"
ON public.rate_limit_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Lock down SECURITY DEFINER functions from anon/public execution
REVOKE EXECUTE ON FUNCTION public.calculate_user_tier(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_model_profile_slots(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_error_logs() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_verifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) TO service_role;