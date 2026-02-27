
-- Create tag_corrections table for tracking manual tag position corrections
CREATE TABLE public.tag_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  look_id uuid NOT NULL REFERENCES public.generated_looks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category text NOT NULL,
  ai_x numeric NOT NULL,
  ai_y numeric NOT NULL,
  manual_x numeric NOT NULL,
  manual_y numeric NOT NULL,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tag_corrections ENABLE ROW LEVEL SECURITY;

-- Users can insert their own corrections
CREATE POLICY "Users can insert own corrections"
  ON public.tag_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own corrections
CREATE POLICY "Users can view own corrections"
  ON public.tag_corrections FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all corrections (for AI learning)
CREATE POLICY "Admins can view all corrections"
  ON public.tag_corrections FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can read all (for edge functions)
CREATE POLICY "Service role can read all corrections"
  ON public.tag_corrections FOR SELECT
  USING (true);

-- Index for efficient category-based lookups
CREATE INDEX idx_tag_corrections_category ON public.tag_corrections(category);
CREATE INDEX idx_tag_corrections_look_id ON public.tag_corrections(look_id);
