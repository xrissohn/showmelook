REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_user_liked_look(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_look_like_count(uuid) FROM PUBLIC, anon;