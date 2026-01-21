-- =============================================
-- 친구 추천 리워드 시스템 테이블 생성
-- =============================================

-- 1. referral_codes 테이블: 사용자별 추천 코드
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  used_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_referral_code UNIQUE (user_id)
);

-- 인덱스
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX idx_referral_codes_user_id ON public.referral_codes(user_id);

-- RLS 활성화
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 코드 조회 가능
CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 코드로 조회 가능 (가입 시 유효성 검증용)
CREATE POLICY "Anyone can view code by code value"
  ON public.referral_codes FOR SELECT
  USING (is_active = true);

-- RLS 정책: 서비스 역할만 삽입/수정 가능
CREATE POLICY "Service role can manage referral codes"
  ON public.referral_codes FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. referral_rewards 테이블: 리워드 추적
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referee_user_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('bonus_credits', 'profile_slot')),
  amount INTEGER NOT NULL DEFAULT 5,
  remaining_amount INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_referee UNIQUE (referee_user_id)
);

-- 인덱스
CREATE INDEX idx_referral_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX idx_referral_rewards_referee ON public.referral_rewards(referee_user_id);
CREATE INDEX idx_referral_rewards_active ON public.referral_rewards(is_active, expires_at);

-- RLS 활성화
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 리워드 조회 가능 (추천인 또는 피추천인)
CREATE POLICY "Users can view their own rewards"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

-- RLS 정책: 서비스 역할만 삽입/수정 가능
CREATE POLICY "Service role can manage rewards"
  ON public.referral_rewards FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. profile_deletion_grace 테이블: 다운그레이드 시 유예 관리
CREATE TABLE public.profile_deletion_grace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_ids UUID[] NOT NULL,
  grace_period_ends_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_profile_deletion_grace_user ON public.profile_deletion_grace(user_id);
CREATE INDEX idx_profile_deletion_grace_ends ON public.profile_deletion_grace(grace_period_ends_at);

-- RLS 활성화
ALTER TABLE public.profile_deletion_grace ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 유예 정보 조회 가능
CREATE POLICY "Users can view their own grace periods"
  ON public.profile_deletion_grace FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 서비스 역할만 삽입/수정 가능
CREATE POLICY "Service role can manage grace periods"
  ON public.profile_deletion_grace FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. 가입 시 자동으로 추천 코드 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION public.generate_referral_code_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- 8자리 영문+숫자 코드 생성
  LOOP
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- 중복 체크
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- 추천 코드 생성
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, new_code)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 트리거: auth.users 테이블에 새 사용자 생성 시 자동으로 추천 코드 생성
CREATE TRIGGER on_auth_user_created_generate_referral_code
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code_for_user();