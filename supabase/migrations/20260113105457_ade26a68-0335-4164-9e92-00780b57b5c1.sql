-- Add memo and tags columns to generated_looks table
ALTER TABLE public.generated_looks 
ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL;