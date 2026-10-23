-- products_cache: 가장 많이 실행되는 쿼리(활성+이미지+DNA 있는 상품을 collected_at 순 정렬)가
-- 매번 전체 테이블을 읽고 정렬(Seq Scan + Sort)하고 있어 부분 인덱스로 해결
CREATE INDEX IF NOT EXISTS idx_products_cache_active_dna_collected
  ON public.products_cache (collected_at DESC)
  WHERE is_active = true AND image_url IS NOT NULL AND dna_meta IS NOT NULL;

-- generated_looks_public: 기본 키 외 인덱스가 없어 좋아요순/최신순 정렬이 매번 전체 정렬 발생
CREATE INDEX IF NOT EXISTS idx_generated_looks_public_popular
  ON public.generated_looks_public (like_count DESC);

CREATE INDEX IF NOT EXISTS idx_generated_looks_public_latest
  ON public.generated_looks_public (created_at DESC, id DESC);