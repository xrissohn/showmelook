
-- Revoke EXECUTE from PUBLIC (which covers anon/authenticated implicitly)
REVOKE EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verifications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_admin_by_email() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code_for_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.skip_duplicate_pending_product() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_feedback_score() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_user_tier(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_model_profile_slots(integer) FROM PUBLIC;

-- Re-grant only to service_role for explicit invocation
GRANT EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_verifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_error_logs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) TO service_role;

-- Switch profiles_public to security invoker so it doesn't bypass RLS
ALTER VIEW public.profiles_public SET (security_invoker = on);
