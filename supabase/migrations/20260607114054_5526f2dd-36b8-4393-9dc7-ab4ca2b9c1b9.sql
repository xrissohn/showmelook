CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  survey_key text NOT NULL DEFAULT 'shomi_ab_v1',
  choice text NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT survey_responses_choice_check CHECK (choice IN ('A','B')),
  CONSTRAINT survey_responses_feedback_len CHECK (feedback IS NULL OR length(feedback) <= 1000)
);

GRANT SELECT, INSERT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own survey response"
ON public.survey_responses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own survey response or admin views all"
ON public.survey_responses FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
