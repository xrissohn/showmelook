-- Token Bucket 상태 저장 테이블
CREATE TABLE public.rate_limit_state (
  id TEXT PRIMARY KEY DEFAULT 'global',
  tokens DECIMAL(10,2) NOT NULL DEFAULT 30,
  max_tokens INTEGER NOT NULL DEFAULT 30,
  refill_rate DECIMAL(5,2) NOT NULL DEFAULT 10,
  last_refill_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  backoff_until TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  total_requests_today INTEGER NOT NULL DEFAULT 0,
  total_rate_limits_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 초기 상태 삽입
INSERT INTO public.rate_limit_state (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- RLS 활성화
ALTER TABLE public.rate_limit_state ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능 (모니터링용)
CREATE POLICY "Anyone can view rate limit state"
ON public.rate_limit_state FOR SELECT
USING (true);

-- Service role만 수정 가능
CREATE POLICY "Service role can manage rate limit state"
ON public.rate_limit_state FOR ALL
USING (true)
WITH CHECK (true);