-- Add dna_meta JSONB column to products_cache for structured DNA data
ALTER TABLE public.products_cache 
ADD COLUMN IF NOT EXISTS dna_meta JSONB;

-- Add index for efficient querying on dna_meta fields
CREATE INDEX IF NOT EXISTS idx_products_cache_dna_meta_target 
ON public.products_cache USING btree ((dna_meta->>'target'));

CREATE INDEX IF NOT EXISTS idx_products_cache_dna_meta_item_slot 
ON public.products_cache USING btree ((dna_meta->>'item_slot'));

-- Add GIN index for array fields (concepts, occasions)
CREATE INDEX IF NOT EXISTS idx_products_cache_dna_meta_gin 
ON public.products_cache USING gin (dna_meta jsonb_path_ops);