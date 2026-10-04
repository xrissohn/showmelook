CREATE TABLE public.shomi_meta (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shomi_meta TO service_role;
ALTER TABLE public.shomi_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read shomi meta" ON public.shomi_meta FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.shomi_meta TO authenticated;