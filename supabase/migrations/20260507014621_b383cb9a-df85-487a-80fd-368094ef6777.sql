
-- Fix 1: Restrict product-images storage policies to admin only
DROP POLICY IF EXISTS "Service role delete for product images" ON storage.objects;
DROP POLICY IF EXISTS "Service role update for product images" ON storage.objects;
DROP POLICY IF EXISTS "Service role upload for product images" ON storage.objects;

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Remove tautological OR on generated-looks SELECT policy
DROP POLICY IF EXISTS "Users can access own generated looks" ON storage.objects;
CREATE POLICY "Users can access own generated looks"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'generated-looks'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix 3: Revoke anon EXECUTE on SECURITY DEFINER functions that should not be public
REVOKE EXECUTE ON FUNCTION public.get_products_without_sub_style(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_duplicate_pending_products() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_inference_metrics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_verifications() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM anon, public;
