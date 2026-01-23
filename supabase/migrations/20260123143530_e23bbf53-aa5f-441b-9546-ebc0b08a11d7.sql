-- Fix generation_jobs: Replace overly permissive service role policy
-- The current policy has USING (true) which could expose data
-- Service role should use service key validation, not be open to all

DROP POLICY IF EXISTS "Service role can manage all jobs" ON generation_jobs;

-- Service role operations should be done via edge functions with service_role key
-- No need for a public "all" policy - service role bypasses RLS automatically
-- The existing user policies are sufficient for client-side access