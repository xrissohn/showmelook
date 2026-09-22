-- product_feedback_scores: aggregate stats only used by admin UI and service-role edge functions
DROP POLICY IF EXISTS "Anyone can view product scores" ON public.product_feedback_scores;
CREATE POLICY "Admins can view product scores"
ON public.product_feedback_scores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- dna_classification_config: only managed/read via admin panel; edge functions use service role
DROP POLICY IF EXISTS "Anyone can read dna_classification_config" ON public.dna_classification_config;
CREATE POLICY "Admins can read dna_classification_config"
ON public.dna_classification_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- model_config: only read by admin inference metrics panel; edge functions use service role
DROP POLICY IF EXISTS "Authenticated users can read model_config" ON public.model_config;
CREATE POLICY "Admins can read model_config"
ON public.model_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));