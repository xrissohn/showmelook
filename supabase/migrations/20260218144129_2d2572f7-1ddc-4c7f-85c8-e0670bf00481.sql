
-- Create a public view exposing only safe profile fields
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT user_id, full_name, avatar_url
FROM public.profiles;

-- Grant read access to anon and authenticated roles
GRANT SELECT ON public.profiles_public TO anon, authenticated;
