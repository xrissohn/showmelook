-- Add style_preferences column to family_profiles table
ALTER TABLE public.family_profiles 
ADD COLUMN IF NOT EXISTS style_preferences text[] DEFAULT NULL;