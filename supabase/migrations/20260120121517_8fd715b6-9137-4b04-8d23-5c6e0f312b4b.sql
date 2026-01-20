-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- Drop the old policy that only allows viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Also allow admins to view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;

-- Allow admins to update any subscription
CREATE POLICY "Admins can update all subscriptions"
ON public.user_subscriptions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert subscriptions for any user
CREATE POLICY "Admins can insert subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);