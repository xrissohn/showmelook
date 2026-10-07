CREATE TABLE IF NOT EXISTS public.internal_cron_tokens (name text PRIMARY KEY, token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_cron_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.internal_cron_tokens TO service_role;
INSERT INTO public.internal_cron_tokens (name, token)
VALUES ('feedback-learning-report', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;
SELECT cron.unschedule('feedback-learning-report-daily');
SELECT cron.schedule('feedback-learning-report-daily', '0 18 * * *', $cron$
  select net.http_post(
    url := 'https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/feedback-learning-report',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select token from public.internal_cron_tokens where name = 'feedback-learning-report')),
    body := '{}'::jsonb
  );
$cron$);