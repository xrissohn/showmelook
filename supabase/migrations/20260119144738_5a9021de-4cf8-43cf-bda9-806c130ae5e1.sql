-- Add age_group column to profiles table for storing age group selection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_group text;

-- Add age_group column to family_profiles table as well
ALTER TABLE public.family_profiles ADD COLUMN IF NOT EXISTS age_group text;