-- Fix 1: referral_codes - Deny direct SELECT access to base table, use public view only
-- The referral_codes_public view already excludes user_id, so we just need to restrict base table access

-- Drop existing SELECT policies on referral_codes
DROP POLICY IF EXISTS "Anyone can view active codes via public view" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;

-- Create restrictive SELECT policy - only owner can see their own code
CREATE POLICY "Users can only view their own referral code"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Fix 2: pending_products - Restrict to admin only (currently has service role policy which runs with elevated privileges)
-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage pending products" ON public.pending_products;

-- Create admin-only policies
CREATE POLICY "Admins can view pending products"
  ON public.pending_products
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pending products"
  ON public.pending_products
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending products"
  ON public.pending_products
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pending products"
  ON public.pending_products
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));