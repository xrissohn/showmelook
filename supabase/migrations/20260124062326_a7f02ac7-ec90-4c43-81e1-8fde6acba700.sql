-- 추론 성능 메트릭 테이블
CREATE TABLE IF NOT EXISTS public.inference_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  
  -- 모델 정보
  stage1_model TEXT NOT NULL,
  stage2_model TEXT NOT NULL,
  
  -- 성능 메트릭 (ms)
  stage1_time_ms INTEGER,
  stage2_time_ms INTEGER,
  total_time_ms INTEGER,
  
  -- 결과
  stage1_success BOOLEAN DEFAULT true,
  stage2_success BOOLEAN DEFAULT true,
  used_fallback BOOLEAN DEFAULT false,
  fallback_reason TEXT,
  
  -- 컨텍스트
  occasion TEXT,
  concepts TEXT[],
  product_count INTEGER
);

-- 인덱스
CREATE INDEX idx_inference_metrics_created ON public.inference_metrics(created_at DESC);
CREATE INDEX idx_inference_metrics_models ON public.inference_metrics(stage1_model, stage2_model);
CREATE INDEX idx_inference_metrics_success ON public.inference_metrics(stage1_success, stage2_success);

-- RLS 활성화
ALTER TABLE public.inference_metrics ENABLE ROW LEVEL SECURITY;

-- Admin만 조회 가능
CREATE POLICY "Admin can read inference_metrics"
  ON public.inference_metrics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 시스템(service role)만 삽입 가능
CREATE POLICY "Service role can insert inference_metrics"
  ON public.inference_metrics FOR INSERT
  WITH CHECK (true);

-- 모델 설정 테이블
CREATE TABLE IF NOT EXISTS public.model_config (
  id TEXT PRIMARY KEY,  -- 'stage1', 'stage2', 'stage1_backup', 'stage2_backup'
  model_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS 활성화
ALTER TABLE public.model_config ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 조회 가능 (Edge Function에서 사용)
CREATE POLICY "Anyone can read model_config"
  ON public.model_config FOR SELECT
  USING (true);

-- Admin만 수정 가능
CREATE POLICY "Admin can update model_config"
  ON public.model_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert model_config"
  ON public.model_config FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 기본값 삽입
INSERT INTO public.model_config (id, model_name, priority) VALUES 
  ('stage1', 'openai/gpt-5-mini', 1),
  ('stage1_backup', 'google/gemini-2.5-flash', 2),
  ('stage2', 'google/gemini-2.5-flash', 1),
  ('stage2_backup', 'openai/gpt-5-mini', 2)
ON CONFLICT (id) DO NOTHING;

-- 30일 이상 된 메트릭 자동 삭제 함수
CREATE OR REPLACE FUNCTION public.cleanup_old_inference_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.inference_metrics
  WHERE created_at < now() - interval '30 days';
END;
$$;