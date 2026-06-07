DROP VIEW IF EXISTS public.generated_looks_public;

CREATE TABLE IF NOT EXISTS public.generated_looks_public (
  id uuid PRIMARY KEY,
  image_url text NOT NULL,
  like_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  caption text,
  tags text[],
  created_at timestamptz NOT NULL,
  prompt_used text,
  product_ids uuid[],
  style_reasoning text,
  tag_positions jsonb,
  memo text,
  gallery_user_key text NOT NULL,
  user_name text,
  user_avatar text
);

GRANT SELECT ON public.generated_looks_public TO anon;
GRANT SELECT ON public.generated_looks_public TO authenticated;
GRANT ALL ON public.generated_looks_public TO service_role;

ALTER TABLE public.generated_looks_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public look cache" ON public.generated_looks_public;
CREATE POLICY "Anyone can view public look cache"
ON public.generated_looks_public
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service role manages public look cache" ON public.generated_looks_public;
CREATE POLICY "Service role manages public look cache"
ON public.generated_looks_public
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_generated_looks_public_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.generated_looks_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_public = true THEN
    INSERT INTO public.generated_looks_public (
      id, image_url, like_count, view_count, caption, tags, created_at,
      prompt_used, product_ids, style_reasoning, tag_positions, memo,
      gallery_user_key, user_name, user_avatar
    )
    SELECT
      NEW.id, NEW.image_url, NEW.like_count, NEW.view_count, NEW.caption, NEW.tags, NEW.created_at,
      NEW.prompt_used, NEW.product_ids, NEW.style_reasoning, NEW.tag_positions, NEW.memo,
      md5(NEW.user_id::text), p.full_name, p.avatar_url
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    UNION ALL
    SELECT
      NEW.id, NEW.image_url, NEW.like_count, NEW.view_count, NEW.caption, NEW.tags, NEW.created_at,
      NEW.prompt_used, NEW.product_ids, NEW.style_reasoning, NEW.tag_positions, NEW.memo,
      md5(NEW.user_id::text), null, null
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.user_id)
    ON CONFLICT (id) DO UPDATE SET
      image_url = EXCLUDED.image_url,
      like_count = EXCLUDED.like_count,
      view_count = EXCLUDED.view_count,
      caption = EXCLUDED.caption,
      tags = EXCLUDED.tags,
      created_at = EXCLUDED.created_at,
      prompt_used = EXCLUDED.prompt_used,
      product_ids = EXCLUDED.product_ids,
      style_reasoning = EXCLUDED.style_reasoning,
      tag_positions = EXCLUDED.tag_positions,
      memo = EXCLUDED.memo,
      gallery_user_key = EXCLUDED.gallery_user_key,
      user_name = EXCLUDED.user_name,
      user_avatar = EXCLUDED.user_avatar;
  ELSE
    DELETE FROM public.generated_looks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_generated_looks_public_cache() TO service_role;

DROP TRIGGER IF EXISTS sync_generated_looks_public_cache_trigger ON public.generated_looks;
CREATE TRIGGER sync_generated_looks_public_cache_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.generated_looks
FOR EACH ROW EXECUTE FUNCTION public.sync_generated_looks_public_cache();

TRUNCATE public.generated_looks_public;
INSERT INTO public.generated_looks_public (
  id, image_url, like_count, view_count, caption, tags, created_at,
  prompt_used, product_ids, style_reasoning, tag_positions, memo,
  gallery_user_key, user_name, user_avatar
)
SELECT
  gl.id, gl.image_url, gl.like_count, gl.view_count, gl.caption, gl.tags, gl.created_at,
  gl.prompt_used, gl.product_ids, gl.style_reasoning, gl.tag_positions, gl.memo,
  md5(gl.user_id::text), p.full_name, p.avatar_url
FROM public.generated_looks gl
LEFT JOIN public.profiles p ON p.user_id = gl.user_id
WHERE gl.is_public = true;