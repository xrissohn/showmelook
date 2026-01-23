-- Phase 1: 에러 로깅 테이블 생성
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  user_id UUID,
  request_payload JSONB,
  response_payload JSONB,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 성능을 위한 인덱스
CREATE INDEX idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_function ON public.error_logs(function_name, created_at DESC);
CREATE INDEX idx_error_logs_user ON public.error_logs(user_id, created_at DESC);

-- 에러 로그는 서비스 계정에서만 기록 가능 (Edge Function에서 service_role로 접근)
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 읽기는 인증된 사용자 본인 로그만 허용
CREATE POLICY "Users can view their own error logs"
ON public.error_logs
FOR SELECT
USING (auth.uid() = user_id);

-- 30일 지난 로그 자동 정리를 위한 함수
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.error_logs
  WHERE created_at < now() - interval '30 days';
END;
$$;

COMMENT ON TABLE public.error_logs IS 'Edge Function 에러 로깅 테이블 - 디버깅 및 모니터링용';