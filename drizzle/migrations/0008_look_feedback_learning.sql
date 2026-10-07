-- Look feedback (thumbs up / neutral / thumbs down + free-text comment), moderation hold for
-- sensitive comments, learning insights and admin reports (2026-10-07).
-- Writes to look_feedback go through the submit-look-feedback edge function (service role);
-- users can only read their own rows, admins can read all and decide on flagged comments.

CREATE TABLE IF NOT EXISTS public.look_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  look_id uuid NOT NULL REFERENCES public.generated_looks(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating IN (-1, 0, 1)),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  prompt_used text,
  style_concept text,
  product_ids text[] NOT NULL DEFAULT '{}',
  applied_gender text,
  -- none: no comment · clean: passed moderation · flagged: held for an admin decision
  -- approved/rejected: admin decision on a flagged comment
  moderation_status text NOT NULL DEFAULT 'none' CHECK (moderation_status IN ('none', 'clean', 'flagged', 'approved', 'rejected')),
  moderation_categories text[] NOT NULL DEFAULT '{}',
  decided_by uuid,
  decided_at timestamptz,
  used_in_learning boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, look_id)
);

CREATE INDEX IF NOT EXISTS idx_look_feedback_created ON public.look_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_look_feedback_user ON public.look_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_look_feedback_flagged ON public.look_feedback (created_at DESC) WHERE moderation_status = 'flagged';

ALTER TABLE public.look_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.look_feedback FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.look_feedback TO authenticated;
GRANT UPDATE (moderation_status, decided_by, decided_at) ON TABLE public.look_feedback TO authenticated;
GRANT ALL ON TABLE public.look_feedback TO service_role;

DROP POLICY IF EXISTS "Users can view their own look feedback" ON public.look_feedback;
CREATE POLICY "Users can view their own look feedback" ON public.look_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all look feedback" ON public.look_feedback;
CREATE POLICY "Admins can view all look feedback" ON public.look_feedback
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can decide on flagged look feedback" ON public.look_feedback;
CREATE POLICY "Admins can decide on flagged look feedback" ON public.look_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recommendation guidelines learned from feedback. Active rows are appended to the stage-2
-- recommendation prompt by style-recommend; admins can disable any row.
CREATE TABLE IF NOT EXISTS public.recommendation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary text NOT NULL,
  insight_lines text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_feedback_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_insights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recommendation_insights FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.recommendation_insights TO authenticated;
GRANT UPDATE (status, decided_by, decided_at) ON TABLE public.recommendation_insights TO authenticated;
GRANT ALL ON TABLE public.recommendation_insights TO service_role;

DROP POLICY IF EXISTS "Admins can view recommendation insights" ON public.recommendation_insights;
CREATE POLICY "Admins can view recommendation insights" ON public.recommendation_insights
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can enable or disable recommendation insights" ON public.recommendation_insights;
CREATE POLICY "Admins can enable or disable recommendation insights" ON public.recommendation_insights
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- One report per learning run (also emailed to the admins).
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  flagged_count integer NOT NULL DEFAULT 0,
  flagged_by_category jsonb NOT NULL DEFAULT '{}'::jsonb,
  insight_id uuid REFERENCES public.recommendation_insights(id) ON DELETE SET NULL,
  email_recipients text[] NOT NULL DEFAULT '{}',
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON public.feedback_reports (created_at DESC);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feedback_reports FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.feedback_reports TO authenticated;
GRANT ALL ON TABLE public.feedback_reports TO service_role;

DROP POLICY IF EXISTS "Admins can view feedback reports" ON public.feedback_reports;
CREATE POLICY "Admins can view feedback reports" ON public.feedback_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The product score trigger only counted 'like'/'dislike'. Look-level thumbs are stored as
-- 'style_like'/'style_dislike' (record-feedback and submit-look-feedback), so count them too.
CREATE OR REPLACE FUNCTION public.update_product_feedback_score()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id uuid;
  v_like_count integer;
  v_dislike_count integer;
  v_cart_count integer;
  v_purchase_count integer;
  v_click_count integer;
  v_score numeric(4,3);
  v_style_weights jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN action_type IN ('like', 'style_like') THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type IN ('dislike', 'style_dislike') THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type = 'cart' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type = 'purchase' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type IN ('click', 'view') THEN 1 ELSE 0 END), 0)
  INTO v_like_count, v_dislike_count, v_cart_count, v_purchase_count, v_click_count
  FROM public.product_feedback
  WHERE product_id = v_product_id;

  v_score := 0.5 +
    (v_purchase_count * 0.1) +
    (v_cart_count * 0.05) +
    (v_like_count * 0.03) +
    (v_click_count * 0.005) -
    (v_dislike_count * 0.08);

  v_score := GREATEST(0.0, LEAST(1.0, v_score));

  SELECT COALESCE(
    jsonb_object_agg(
      style_concept,
      ROUND((positive_count - negative_count + 5)::numeric / 10.0, 2)
    ),
    '{}'::jsonb
  )
  INTO v_style_weights
  FROM (
    SELECT
      context->>'style_concept' as style_concept,
      SUM(CASE WHEN action_type IN ('like', 'style_like', 'cart', 'purchase') THEN 1 ELSE 0 END) as positive_count,
      SUM(CASE WHEN action_type IN ('dislike', 'style_dislike') THEN 1 ELSE 0 END) as negative_count
    FROM public.product_feedback
    WHERE product_id = v_product_id
      AND context->>'style_concept' IS NOT NULL
    GROUP BY context->>'style_concept'
  ) subq
  WHERE style_concept IS NOT NULL;

  INSERT INTO public.product_feedback_scores (
    product_id, like_count, dislike_count, cart_count, purchase_count, click_count,
    overall_score, style_weights, updated_at
  ) VALUES (
    v_product_id, v_like_count, v_dislike_count, v_cart_count, v_purchase_count, v_click_count,
    v_score, v_style_weights, now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    like_count = EXCLUDED.like_count,
    dislike_count = EXCLUDED.dislike_count,
    cart_count = EXCLUDED.cart_count,
    purchase_count = EXCLUDED.purchase_count,
    click_count = EXCLUDED.click_count,
    overall_score = EXCLUDED.overall_score,
    style_weights = EXCLUDED.style_weights,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
