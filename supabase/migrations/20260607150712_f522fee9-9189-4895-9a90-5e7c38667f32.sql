DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.user_subscriptions;

CREATE POLICY "Users can create free subscription or admins insert any"
ON public.user_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auth.uid() = user_id
    AND plan = 'free'
    AND daily_limit = 5
    AND COALESCE(monthly_limit, 25) = 25
    AND gallery_limit = 10
    AND max_profiles = 1
    AND COALESCE(billing_cycle, 'monthly') = 'monthly'
    AND current_period_end IS NULL
    AND expires_at IS NULL
  )
);