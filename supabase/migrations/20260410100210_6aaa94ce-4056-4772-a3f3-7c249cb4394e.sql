CREATE TABLE public.health_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'batch',
  checked_count integer NOT NULL DEFAULT 0,
  deleted_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view health check logs"
ON public.health_check_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert health check logs"
ON public.health_check_logs FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_health_check_logs_created_at ON public.health_check_logs (created_at DESC);