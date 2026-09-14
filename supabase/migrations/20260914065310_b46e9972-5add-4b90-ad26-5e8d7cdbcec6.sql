CREATE OR REPLACE FUNCTION public.sync_look_like_count(_look_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COUNT(*)::integer
    INTO _count
    FROM public.look_likes
   WHERE look_id = _look_id;

  UPDATE public.generated_looks
     SET like_count = _count
   WHERE id = _look_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Look not found';
  END IF;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_look_like_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_look_like_count(uuid) TO authenticated;