-- =====================================================
-- Security Fix: Restrict access to sensitive tables
-- =====================================================

-- 1. cafe24_tenants: Contains OAuth tokens - restrict to service role only
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Service role can manage tenants" ON public.cafe24_tenants;

-- Create restrictive policy: No direct SELECT access (service role bypasses RLS)
CREATE POLICY "No direct access to tenants"
ON public.cafe24_tenants
FOR SELECT
USING (false);

-- Service role operations (INSERT, UPDATE, DELETE) bypass RLS automatically
-- But we add explicit policies for documentation
CREATE POLICY "Service role can insert tenants"
ON public.cafe24_tenants
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Service role can update tenants"
ON public.cafe24_tenants
FOR UPDATE
USING (false);

CREATE POLICY "Service role can delete tenants"
ON public.cafe24_tenants
FOR DELETE
USING (false);


-- 2. email_verifications: Contains email addresses and verification codes
-- Enable RLS on email_verifications (if not already enabled)
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy: No direct SELECT access
-- Edge functions use service role which bypasses RLS
CREATE POLICY "No direct access to verifications"
ON public.email_verifications
FOR SELECT
USING (false);

CREATE POLICY "No direct insert to verifications"
ON public.email_verifications
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct update to verifications"
ON public.email_verifications
FOR UPDATE
USING (false);

CREATE POLICY "No direct delete to verifications"
ON public.email_verifications
FOR DELETE
USING (false);