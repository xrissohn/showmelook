
-- 1. Function to cleanup existing duplicate pending_products
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_pending_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.pending_products pp
  WHERE pp.resolved_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.products_cache pc
      WHERE pc.product_url = (pp.raw_data->>'product_url')
        AND pc.is_active = true
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 2. Trigger function: BEFORE INSERT, skip if product_url already in products_cache
CREATE OR REPLACE FUNCTION public.skip_duplicate_pending_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.products_cache
    WHERE product_url = (NEW.raw_data->>'product_url')
      AND is_active = true
  ) THEN
    RAISE NOTICE 'Skipping duplicate pending product: %', NEW.raw_data->>'product_url';
    RETURN NULL; -- skip the insert
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS trg_skip_duplicate_pending ON public.pending_products;
CREATE TRIGGER trg_skip_duplicate_pending
  BEFORE INSERT ON public.pending_products
  FOR EACH ROW
  EXECUTE FUNCTION public.skip_duplicate_pending_product();
