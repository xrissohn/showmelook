-- Add expires_at column to style_cache for TTL management
ALTER TABLE public.style_cache 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Add index for cache lookup
CREATE INDEX IF NOT EXISTS idx_style_cache_cache_key ON public.style_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_style_cache_expires_at ON public.style_cache(expires_at);