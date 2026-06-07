
-- 1) profiles에 수신거부 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;

-- 2) 설문 메일 발송 이력 테이블
CREATE TABLE IF NOT EXISTS public.survey_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  survey_key text NOT NULL DEFAULT 'shomi_ab_v1',
  status text NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, survey_key)
);

GRANT SELECT ON public.survey_email_sends TO authenticated;
GRANT ALL ON public.survey_email_sends TO service_role;

ALTER TABLE public.survey_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view survey email sends"
  ON public.survey_email_sends FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages survey email sends"
  ON public.survey_email_sends FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_survey_email_sends_survey_key ON public.survey_email_sends(survey_key);
