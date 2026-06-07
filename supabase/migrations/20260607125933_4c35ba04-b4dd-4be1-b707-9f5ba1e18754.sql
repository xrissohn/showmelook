CREATE OR REPLACE FUNCTION public.sync_generated_looks_public_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    ) VALUES (
      NEW.id, NEW.image_url, NEW.like_count, NEW.view_count, NEW.caption, NEW.tags, NEW.created_at,
      NEW.prompt_used, NEW.product_ids, NEW.style_reasoning, NEW.tag_positions, NEW.memo,
      md5(NEW.user_id::text),
      'Stylist ' || upper(substring(md5(NEW.user_id::text) from 1 for 6)),
      NULL
    )
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
      user_avatar = NULL;
  ELSE
    DELETE FROM public.generated_looks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.generated_looks_public
SET
  user_name = 'Stylist ' || upper(substring(gallery_user_key from 1 for 6)),
  user_avatar = NULL;

REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM anon;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_generated_looks_public_cache() FROM service_role;
GRANT EXECUTE ON FUNCTION public.sync_generated_looks_public_cache() TO service_role;