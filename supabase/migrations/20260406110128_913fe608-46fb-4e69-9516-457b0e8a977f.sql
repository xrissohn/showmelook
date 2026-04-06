
CREATE TABLE public.dna_classification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL,
  item_slot text,
  value text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(config_type, item_slot, value)
);

ALTER TABLE public.dna_classification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dna_classification_config"
  ON public.dna_classification_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert dna_classification_config"
  ON public.dna_classification_config FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update dna_classification_config"
  ON public.dna_classification_config FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete dna_classification_config"
  ON public.dna_classification_config FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_dna_classification_config_updated_at
  BEFORE UPDATE ON public.dna_classification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
