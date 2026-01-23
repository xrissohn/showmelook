
-- product_feedback 테이블에 스타일 컨텍스트 추가 및 새 액션 타입 지원
-- 기존 constraint 삭제 후 새 타입 추가 (view 포함)
ALTER TABLE public.product_feedback DROP CONSTRAINT IF EXISTS action_type_check;

ALTER TABLE public.product_feedback ADD CONSTRAINT action_type_check 
CHECK (action_type IN ('like', 'dislike', 'click', 'cart', 'purchase', 'remove', 'payment_notify_request', 'style_like', 'style_dislike', 'view'));

-- 상품별 피드백 점수를 캐싱하는 테이블 (스타일별 가중치 포함)
CREATE TABLE IF NOT EXISTS public.product_feedback_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  
  -- 전체 피드백 카운트
  like_count integer NOT NULL DEFAULT 0,
  dislike_count integer NOT NULL DEFAULT 0,
  cart_count integer NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  
  -- 스타일별 가중치 (JSONB: {"캐주얼": 0.8, "미니멀": 0.6, ...})
  style_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- 계산된 종합 점수 (0~1)
  overall_score numeric(4,3) NOT NULL DEFAULT 0.5,
  
  -- 타임스탬프
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_feedback_scores_product 
ON public.product_feedback_scores (product_id);

CREATE INDEX IF NOT EXISTS idx_product_feedback_scores_score 
ON public.product_feedback_scores (overall_score DESC);

-- RLS 정책
ALTER TABLE public.product_feedback_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product scores" 
ON public.product_feedback_scores 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage scores" 
ON public.product_feedback_scores 
FOR ALL 
USING (true);

-- recommendation_patterns 테이블에 스타일별 피드백 추가
ALTER TABLE public.recommendation_patterns 
ADD COLUMN IF NOT EXISTS style_feedback jsonb DEFAULT '{}'::jsonb;

-- 피드백 집계 함수 (트리거용)
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
  -- 제품 ID 결정
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;
  
  IF v_product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- 카운트 집계
  SELECT 
    COALESCE(SUM(CASE WHEN action_type = 'like' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type = 'dislike' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type = 'cart' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type = 'purchase' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN action_type IN ('click', 'view') THEN 1 ELSE 0 END), 0)
  INTO v_like_count, v_dislike_count, v_cart_count, v_purchase_count, v_click_count
  FROM public.product_feedback
  WHERE product_id = v_product_id;
  
  -- 종합 점수 계산 (가중치: 구매 > 장바구니 > 좋아요 > 클릭, 싫어요는 감점)
  -- 기본 0.5 + 긍정 피드백 - 부정 피드백
  v_score := 0.5 + 
    (v_purchase_count * 0.1) + 
    (v_cart_count * 0.05) + 
    (v_like_count * 0.03) + 
    (v_click_count * 0.005) - 
    (v_dislike_count * 0.08);
  
  -- 0~1 범위로 클램핑
  v_score := GREATEST(0.0, LEAST(1.0, v_score));
  
  -- 스타일별 가중치 집계 (context에서 추출)
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
      SUM(CASE WHEN action_type IN ('like', 'cart', 'purchase') THEN 1 ELSE 0 END) as positive_count,
      SUM(CASE WHEN action_type = 'dislike' THEN 1 ELSE 0 END) as negative_count
    FROM public.product_feedback
    WHERE product_id = v_product_id 
      AND context->>'style_concept' IS NOT NULL
    GROUP BY context->>'style_concept'
  ) subq
  WHERE style_concept IS NOT NULL;
  
  -- Upsert
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

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_product_feedback_score ON public.product_feedback;

CREATE TRIGGER trigger_update_product_feedback_score
AFTER INSERT OR UPDATE OR DELETE ON public.product_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_product_feedback_score();
