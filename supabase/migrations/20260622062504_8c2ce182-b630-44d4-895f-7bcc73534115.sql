
CREATE TABLE IF NOT EXISTS public.channel_email_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  campaign_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, campaign_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_email_sends TO authenticated;
GRANT ALL ON public.channel_email_sends TO service_role;
ALTER TABLE public.channel_email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage channel email sends"
  ON public.channel_email_sends FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
