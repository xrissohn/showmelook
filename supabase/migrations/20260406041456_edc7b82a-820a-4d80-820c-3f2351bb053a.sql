CREATE OR REPLACE FUNCTION public.get_products_without_sub_style(batch_limit integer DEFAULT 500)
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  category text,
  sub_category text,
  price integer,
  style_tags text[],
  gender text,
  color text,
  dna_meta jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pc.id, pc.name, pc.brand, pc.category, pc.sub_category, 
    pc.price, pc.style_tags, pc.gender, pc.color, pc.dna_meta
  FROM public.products_cache pc
  WHERE pc.is_active = true
    AND pc.dna_meta IS NOT NULL
    AND (pc.dna_meta->>'sub_style') IS NULL
  LIMIT batch_limit;
$$;