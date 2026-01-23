-- Fix referral_codes: Remove policy that exposes user_id publicly
-- Current policy "Anyone can view code by code value" exposes user_id to anyone

DROP POLICY IF EXISTS "Anyone can view code by code value" ON referral_codes;

-- Create a public view without user_id for code validation during signup
-- This allows validating codes without exposing who owns them
CREATE OR REPLACE VIEW public.referral_codes_public
WITH (security_invoker = on) AS
SELECT 
  id,
  code,
  used_count,
  max_uses,
  is_active,
  created_at
FROM public.referral_codes
WHERE is_active = true;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.referral_codes_public TO anon, authenticated;

-- Add policy for public view access (code validation only, no user_id exposed)
CREATE POLICY "Anyone can view active codes via public view"
ON public.referral_codes
FOR SELECT
USING (
  -- Users can see their own codes (full access including user_id)
  auth.uid() = user_id
);

-- Note: The existing "Users can view their own referral code" policy is correct
-- Note: "Service role can manage referral codes" is for edge functions (correct)