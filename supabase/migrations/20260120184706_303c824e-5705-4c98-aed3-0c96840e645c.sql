-- 이메일 인증코드 테이블
CREATE TABLE public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup', -- 'signup' | 'password_reset'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX idx_email_verifications_expires ON public.email_verifications(expires_at);
CREATE INDEX idx_email_verifications_purpose ON public.email_verifications(purpose);

-- RLS 활성화 (Edge Function에서 service_role로 접근하므로 정책 불필요)
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- 24시간 이상 된 인증코드 자동 삭제를 위한 함수
CREATE OR REPLACE FUNCTION public.cleanup_old_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verifications
  WHERE created_at < now() - interval '24 hours';
END;
$$;