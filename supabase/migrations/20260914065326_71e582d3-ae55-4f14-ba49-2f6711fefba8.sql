DROP FUNCTION public.sync_look_like_count(uuid);

CREATE OR REPLACE FUNCTION public.update_look_like_count_from_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _look_id uuid;
BEGIN
  _look_id := COALESCE(NEW.look_id, OLD.look_id);

  UPDATE public.generated_looks
     SET like_count = (
       SELECT COUNT(*)::integer
         FROM public.look_likes
        WHERE look_id = _look_id
     )
   WHERE id = _look_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.update_look_like_count_from_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_look_like_count_from_rows() FROM anon;
REVOKE ALL ON FUNCTION public.update_look_like_count_from_rows() FROM authenticated;

DROP TRIGGER IF EXISTS sync_generated_look_like_count ON public.look_likes;
CREATE TRIGGER sync_generated_look_like_count
AFTER INSERT OR DELETE ON public.look_likes
FOR EACH ROW EXECUTE FUNCTION public.update_look_like_count_from_rows();