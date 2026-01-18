-- Create pending_products table for failed registrations
CREATE TABLE public.pending_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,  -- 'brightdata', 'excel', 'manual'
  raw_data JSONB NOT NULL,  -- Original product data
  error_type TEXT NOT NULL,  -- 'image_failed', 'dna_failed', 'both_failed'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT  -- 'auto_retry', 'manual', 'deleted'
);

-- Enable RLS
ALTER TABLE public.pending_products ENABLE ROW LEVEL SECURITY;

-- RLS policies - only service role can manage pending products
CREATE POLICY "Service role can manage pending products"
ON public.pending_products
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_pending_products_source ON public.pending_products(source);
CREATE INDEX idx_pending_products_error_type ON public.pending_products(error_type);
CREATE INDEX idx_pending_products_resolved_at ON public.pending_products(resolved_at) WHERE resolved_at IS NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_pending_products_updated_at
BEFORE UPDATE ON public.pending_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();