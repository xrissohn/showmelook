REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM anon;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM service_role;