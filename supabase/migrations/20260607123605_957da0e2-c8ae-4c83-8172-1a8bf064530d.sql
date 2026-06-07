CREATE OR REPLACE VIEW public.generated_looks_public AS
SELECT
  gl.id,
  gl.image_url,
  gl.like_count,
  gl.view_count,
  gl.caption,
  gl.tags,
  gl.created_at,
  gl.prompt_used,
  gl.product_ids,
  gl.style_reasoning,
  gl.tag_positions,
  gl.memo,
  md5(gl.user_id::text) AS gallery_user_key,
  p.full_name AS user_name,
  p.avatar_url AS user_avatar
FROM public.generated_looks gl
LEFT JOIN public.profiles p ON p.user_id = gl.user_id
WHERE gl.is_public = true;

GRANT SELECT ON public.generated_looks_public TO anon;
GRANT SELECT ON public.generated_looks_public TO authenticated;
GRANT SELECT ON public.generated_looks_public TO service_role;

DROP POLICY IF EXISTS "Public can view shared looks or own looks" ON public.generated_looks;
DROP POLICY IF EXISTS "Users can view their own looks" ON public.generated_looks;

CREATE POLICY "Authenticated users can view public looks and their own looks"
ON public.generated_looks
FOR SELECT
TO authenticated
USING (is_public = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can view all looks"
ON public.generated_looks
FOR SELECT
TO service_role
USING (true);