-- Phase 3: 비동기 생성 큐 시스템
CREATE TABLE public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, generating_style, generating_image, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  priority INTEGER DEFAULT 5, -- 1(highest) - 10(lowest)
  
  -- 요청 데이터
  request_payload JSONB NOT NULL,
  
  -- 결과 데이터
  result_url TEXT,
  result_payload JSONB,
  error_message TEXT,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- 재시도 관련
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- 인덱스
CREATE INDEX idx_generation_jobs_user ON public.generation_jobs(user_id, created_at DESC);
CREATE INDEX idx_generation_jobs_status ON public.generation_jobs(status, priority, created_at);
CREATE INDEX idx_generation_jobs_pending ON public.generation_jobs(status, created_at) WHERE status IN ('queued', 'processing');

-- RLS 활성화
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 작업만 조회 가능
CREATE POLICY "Users can view their own jobs"
ON public.generation_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 작업만 생성 가능
CREATE POLICY "Users can create their own jobs"
ON public.generation_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 서비스 역할은 모든 작업 관리 가능 (Edge Function에서 사용)
CREATE POLICY "Service role can manage all jobs"
ON public.generation_jobs
FOR ALL
USING (true)
WITH CHECK (true);

-- Realtime 활성화 (상태 업데이트 실시간 수신)
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;

COMMENT ON TABLE public.generation_jobs IS '비동기 스타일 생성 작업 큐 - Realtime으로 상태 업데이트 수신';
COMMENT ON COLUMN public.generation_jobs.status IS 'queued: 대기중, processing: 처리중, generating_style: 스타일 추천중, generating_image: 이미지 생성중, completed: 완료, failed: 실패';
COMMENT ON COLUMN public.generation_jobs.priority IS '1(최우선) ~ 10(최저). 프리미엄 사용자는 낮은 숫자 부여';