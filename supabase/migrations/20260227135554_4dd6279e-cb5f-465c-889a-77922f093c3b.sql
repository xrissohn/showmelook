
-- generated_looks 테이블에 AI 태그 위치 캐시 컬럼 추가
ALTER TABLE public.generated_looks 
ADD COLUMN IF NOT EXISTS tag_positions jsonb DEFAULT NULL;

-- 코멘트 추가
COMMENT ON COLUMN public.generated_looks.tag_positions IS 'Cached AI-analyzed product tag positions [{category, x, y, confidence}]';
