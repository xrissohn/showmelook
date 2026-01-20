-- style_cache 테이블에 GPT 생성 내용 저장용 컬럼 추가
ALTER TABLE public.style_cache
ADD COLUMN IF NOT EXISTS style_reasoning TEXT,
ADD COLUMN IF NOT EXISTS style_concept TEXT,
ADD COLUMN IF NOT EXISTS look_name TEXT;