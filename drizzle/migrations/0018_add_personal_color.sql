ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_color jsonb;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_personal_color_shape CHECK (
  personal_color IS NULL OR (
    jsonb_typeof(personal_color) = 'object'
    AND personal_color->>'season' IN ('spring_warm','summer_cool','autumn_warm','winter_cool')
    AND personal_color->>'source' IN ('ai_photo','manual')
  )
);
COMMENT ON COLUMN public.profiles.personal_color IS 'Owner-chosen personal color tone (main user only, never family profiles). source=ai_photo is a photo-based estimate, manual is user-selected.';

CREATE TABLE public.personal_color_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  analysis_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);
GRANT ALL ON public.personal_color_usage TO service_role;
ALTER TABLE public.personal_color_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.increment_personal_color_usage(_user_id uuid, _usage_date date)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.personal_color_usage (user_id, usage_date, analysis_count)
  VALUES (_user_id, _usage_date, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET analysis_count = public.personal_color_usage.analysis_count + 1, updated_at = now()
  RETURNING analysis_count;
$$;
REVOKE ALL ON FUNCTION public.increment_personal_color_usage(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_personal_color_usage(uuid, date) TO service_role;