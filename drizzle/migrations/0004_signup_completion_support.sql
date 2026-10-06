ALTER TABLE public.email_verifications ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;