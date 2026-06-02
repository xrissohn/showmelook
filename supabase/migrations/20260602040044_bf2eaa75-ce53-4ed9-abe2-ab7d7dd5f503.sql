
-- 1) Admin SELECT policy for cafe24_webhook_logs
CREATE POLICY "Admins can view webhook logs"
  ON public.cafe24_webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Revoke EXECUTE from public/anon/authenticated for internal SECURITY DEFINER functions.
--    These are invoked by triggers or by service-role/cron only; nothing in the client calls them.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_admin_by_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code_for_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_feedback_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_duplicate_pending_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) FROM PUBLIC, anon, authenticated;
