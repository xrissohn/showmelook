CREATE OR REPLACE FUNCTION public.admin_flagged_look_feedback(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, rating smallint, comment text, moderation_categories text[], prompt_used text, look_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.rating, f.comment, f.moderation_categories, f.prompt_used, f.look_id, f.created_at
  FROM public.look_feedback f
  WHERE public.has_role(auth.uid(), 'admin') AND f.moderation_status = 'flagged'
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
REVOKE ALL ON FUNCTION public.admin_flagged_look_feedback(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_flagged_look_feedback(integer) TO authenticated;