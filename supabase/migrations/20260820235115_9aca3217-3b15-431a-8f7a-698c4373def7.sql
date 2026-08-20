DROP POLICY IF EXISTS "Anyone can view synced products" ON public.cafe24_products;

REVOKE SELECT ON public.cafe24_products FROM anon;
GRANT SELECT ON public.cafe24_products TO authenticated;
GRANT ALL ON public.cafe24_products TO service_role;

CREATE POLICY "Admins can view cafe24 products"
  ON public.cafe24_products
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));