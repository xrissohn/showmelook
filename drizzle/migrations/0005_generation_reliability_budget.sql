-- Server-side look saving support and stated-budget support (2026-10-07)

-- One atomic statement per generation (insert or +1), so parallel tabs can't lose a count.
CREATE OR REPLACE FUNCTION public.increment_daily_generation_usage(_user_id uuid, _usage_date date)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.daily_generation_usage (user_id, usage_date, generation_count)
  VALUES (_user_id, _usage_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET generation_count = COALESCE(public.daily_generation_usage.generation_count, 0) + 1,
                updated_at = now()
  RETURNING generation_count
$$;

REVOKE ALL ON FUNCTION public.increment_daily_generation_usage(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_daily_generation_usage(uuid, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_generation_usage(uuid, date) TO service_role;

-- Budget is now only the amount the user actually stated; no stated budget is NULL.
ALTER TABLE public.recommendation_history ALTER COLUMN budget DROP NOT NULL;