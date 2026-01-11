-- Add age field to profiles table for kids clothing support
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age integer;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.age IS 'User age for kids clothing recommendations (12 and under shows kids items)';