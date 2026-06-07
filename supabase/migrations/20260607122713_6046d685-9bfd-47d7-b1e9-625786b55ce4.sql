
-- Remove user-facing UPDATE/INSERT on usage tables (only service_role manages counters)
DROP POLICY IF EXISTS "Users can update their own usage" ON public.daily_generation_usage;
DROP POLICY IF EXISTS "Users can create their own usage" ON public.daily_generation_usage;
DROP POLICY IF EXISTS "Users can update their own monthly usage" ON public.monthly_generation_usage;
DROP POLICY IF EXISTS "Users can insert their own monthly usage" ON public.monthly_generation_usage;

GRANT ALL ON public.daily_generation_usage TO service_role;
GRANT ALL ON public.monthly_generation_usage TO service_role;

-- Remove user-facing INSERT on user_subscriptions
DROP POLICY IF EXISTS "Users can create their own subscription" ON public.user_subscriptions;
GRANT ALL ON public.user_subscriptions TO service_role;
