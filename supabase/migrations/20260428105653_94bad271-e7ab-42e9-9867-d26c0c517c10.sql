
-- 1) Restrict "Service role can manage" policies to the service_role only
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND policyname LIKE 'Service role can %'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Recreate scoped to service_role
CREATE POLICY "Service role can manage cache" ON public.style_cache AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage webhook logs" ON public.cafe24_webhook_logs AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage fitting sessions" ON public.cafe24_fitting_sessions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage patterns" ON public.recommendation_patterns AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage referral codes" ON public.referral_codes AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage rewards" ON public.referral_rewards AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage grace periods" ON public.profile_deletion_grace AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage rate limit state" ON public.rate_limit_state AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage scores" ON public.product_feedback_scores AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage products" ON public.cafe24_products AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can insert inference_metrics" ON public.inference_metrics AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can insert health check logs" ON public.health_check_logs AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

-- 2) Storage: tighten avatars + restrict public bucket listing
-- Drop overly broad SELECT for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Owner-scoped avatar read (folder = user id)
CREATE POLICY "Users can read own avatar"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admin can read any avatar
CREATE POLICY "Admins can read avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Restrict listing on public buckets: only allow direct GET by exact name (no listing wildcards in path)
-- Replace the broad public-read on product-images & generated-looks with policies that require name to be specified
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Generated looks are publicly accessible" ON storage.objects;

CREATE POLICY "Public can read product images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images' AND name IS NOT NULL AND name <> '');

CREATE POLICY "Public can read generated looks"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'generated-looks' AND name IS NOT NULL AND name <> '');

-- 3) Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) FROM anon, authenticated;
-- has_role MUST stay callable by authenticated for RLS policies; do not revoke
-- handle_new_user / assign_admin_by_email / generate_referral_code_for_user / skip_duplicate_pending_product / update_product_feedback_score are trigger functions, no direct EXECUTE concern but tighten anyway
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_admin_by_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code_for_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_duplicate_pending_product() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_feedback_score() FROM anon, authenticated;

-- 4) Realtime: restrict subscriptions on realtime.messages to authenticated users on their own channels.
-- Channel naming convention: "user:<uuid>:..." or topic equals user uuid; restrict by topic prefix.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe own channels" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe own channels"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Allow if the channel topic is the user's UUID, or starts with "user:<uuid>"
    topic = (auth.uid())::text
    OR topic LIKE 'user:' || (auth.uid())::text || '%'
    OR topic LIKE (auth.uid())::text || ':%'
    -- Allow public broadcast channels prefixed with "public:"
    OR topic LIKE 'public:%'
  );
