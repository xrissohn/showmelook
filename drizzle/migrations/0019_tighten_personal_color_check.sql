ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_personal_color_shape;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_personal_color_shape CHECK (
  personal_color IS NULL OR COALESCE(
    jsonb_typeof(personal_color) = 'object'
    AND jsonb_typeof(personal_color->'season') = 'string'
    AND jsonb_typeof(personal_color->'source') = 'string'
    AND jsonb_typeof(personal_color->'palette') = 'array'
    AND personal_color->>'season' IN ('spring_warm','summer_cool','autumn_warm','winter_cool')
    AND personal_color->>'source' IN ('ai_photo','manual'),
    false
  )
);