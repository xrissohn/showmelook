-- =============================================
-- 구매 기반 등급 시스템 마이그레이션
-- =============================================

-- 1. purchase_intents 테이블 (구매 추적)
CREATE TABLE public.purchase_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products_cache(id) ON DELETE SET NULL,
  merchant_id text,
  product_url text,
  product_name text,
  product_price integer DEFAULT 0,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'cancelled', 'expired')),
  purchased_at timestamptz,
  order_id text,
  actual_amount integer,
  commission numeric(10, 2),
  tier_applied_at timestamptz,
  confirmation_status text DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'pending_confirmation', 'confirmed', 'rolled_back')),
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_purchase_intents_user_id ON public.purchase_intents(user_id);
CREATE INDEX idx_purchase_intents_tracking_id ON public.purchase_intents(tracking_id);
CREATE INDEX idx_purchase_intents_status ON public.purchase_intents(status);
CREATE INDEX idx_purchase_intents_confirmation ON public.purchase_intents(confirmation_status) WHERE confirmation_status = 'pending_confirmation';

-- RLS 활성화
ALTER TABLE public.purchase_intents ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자 본인 조회만 가능
CREATE POLICY "Users can view their own purchase intents"
  ON public.purchase_intents FOR SELECT
  USING (auth.uid() = user_id);

-- 2. user_purchase_stats 테이블 (누적 구매 통계)
CREATE TABLE public.user_purchase_stats (
  user_id uuid NOT NULL PRIMARY KEY,
  total_purchased_amount integer NOT NULL DEFAULT 0,
  total_purchases integer NOT NULL DEFAULT 0,
  first_purchase_at timestamptz,
  current_tier text NOT NULL DEFAULT 'free' CHECK (current_tier IN ('free', 'bronze', 'silver', 'gold', 'platinum')),
  model_profile_slots integer NOT NULL DEFAULT 0,
  pending_amount integer NOT NULL DEFAULT 0,
  last_tier_change_at timestamptz,
  tier_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.user_purchase_stats ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자 본인 조회만 가능
CREATE POLICY "Users can view their own purchase stats"
  ON public.user_purchase_stats FOR SELECT
  USING (auth.uid() = user_id);

-- 3. tier_change_history 테이블 (등급 변동 이력)
CREATE TABLE public.tier_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  previous_tier text NOT NULL,
  new_tier text NOT NULL,
  change_reason text NOT NULL CHECK (change_reason IN ('purchase', 'refund', 'admin', 'signup')),
  amount_change integer NOT NULL DEFAULT 0,
  related_order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_tier_change_history_user_id ON public.tier_change_history(user_id);
CREATE INDEX idx_tier_change_history_created_at ON public.tier_change_history(created_at DESC);

-- RLS 활성화
ALTER TABLE public.tier_change_history ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자 본인 조회만 가능
CREATE POLICY "Users can view their own tier history"
  ON public.tier_change_history FOR SELECT
  USING (auth.uid() = user_id);

-- 4. monthly_generation_usage 테이블 (월간 생성 사용량)
CREATE TABLE public.monthly_generation_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  generation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

-- 인덱스
CREATE INDEX idx_monthly_generation_user_period ON public.monthly_generation_usage(user_id, period_start DESC);

-- RLS 활성화
ALTER TABLE public.monthly_generation_usage ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view their own monthly usage"
  ON public.monthly_generation_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly usage"
  ON public.monthly_generation_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly usage"
  ON public.monthly_generation_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. user_subscriptions 테이블 수정 (plan CHECK 업데이트)
-- 기존 CHECK 제약 삭제 후 새로 추가
ALTER TABLE public.user_subscriptions 
  DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;

ALTER TABLE public.user_subscriptions 
  ADD CONSTRAINT user_subscriptions_plan_check 
  CHECK (plan IN ('free', 'pro', 'premium', 'bronze', 'silver', 'gold', 'platinum'));

-- 새 컬럼 추가
ALTER TABLE public.user_subscriptions 
  ADD COLUMN IF NOT EXISTS monthly_limit integer DEFAULT 25,
  ADD COLUMN IF NOT EXISTS signup_day integer;

-- 6. DB 함수: calculate_user_tier (등급 계산)
CREATE OR REPLACE FUNCTION public.calculate_user_tier(p_total_amount INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_total_amount >= 1000000 THEN
    RETURN 'platinum';
  ELSIF p_total_amount >= 300000 THEN
    RETURN 'gold';
  ELSIF p_total_amount >= 100000 THEN
    RETURN 'silver';
  ELSIF p_total_amount >= 1 THEN
    RETURN 'bronze';
  ELSE
    RETURN 'free';
  END IF;
END;
$$;

-- 7. DB 함수: calculate_model_profile_slots (모델 프로필 슬롯 계산)
CREATE OR REPLACE FUNCTION public.calculate_model_profile_slots(p_total_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- 플래티넘(100만원 이상)만 슬롯 제공, 100만원당 1개
  IF p_total_amount >= 1000000 THEN
    RETURN FLOOR(p_total_amount / 1000000);
  ELSE
    RETURN 0;
  END IF;
END;
$$;

-- 8. updated_at 트리거 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 트리거 생성
CREATE TRIGGER update_purchase_intents_updated_at
  BEFORE UPDATE ON public.purchase_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_purchase_stats_updated_at
  BEFORE UPDATE ON public.user_purchase_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_generation_usage_updated_at
  BEFORE UPDATE ON public.monthly_generation_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();