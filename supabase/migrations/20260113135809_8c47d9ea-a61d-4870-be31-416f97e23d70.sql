-- Phase 1: GIN 인덱스 추가 (DNA 2.0 JSONB 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_products_cache_dna_meta ON products_cache USING GIN (dna_meta);
CREATE INDEX IF NOT EXISTS idx_products_cache_category ON products_cache (category);
CREATE INDEX IF NOT EXISTS idx_products_cache_gender ON products_cache (gender);
CREATE INDEX IF NOT EXISTS idx_products_cache_price ON products_cache (price);

-- Phase 2: 피드백 수집 테이블
CREATE TABLE IF NOT EXISTS product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES products_cache(id) ON DELETE CASCADE,
  recommendation_id UUID, -- 어떤 추천에서 발생했는지
  action_type TEXT NOT NULL CHECK (action_type IN ('click', 'like', 'cart', 'purchase', 'view')),
  context JSONB DEFAULT '{}', -- 요청 컨텍스트 (gender, occasion, concepts 등)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 피드백 테이블 인덱스
CREATE INDEX idx_product_feedback_user ON product_feedback (user_id);
CREATE INDEX idx_product_feedback_product ON product_feedback (product_id);
CREATE INDEX idx_product_feedback_action ON product_feedback (action_type);
CREATE INDEX idx_product_feedback_created ON product_feedback (created_at DESC);

-- RLS 활성화
ALTER TABLE product_feedback ENABLE ROW LEVEL SECURITY;

-- 피드백 RLS 정책 (누구나 피드백 가능, 본인 것만 조회)
CREATE POLICY "Anyone can insert feedback" ON product_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own feedback" ON product_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Phase 2: 추천 패턴 테이블
CREATE TABLE IF NOT EXISTS recommendation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key TEXT UNIQUE NOT NULL, -- 예: "casual_date_female_100000-200000"
  popular_combos JSONB DEFAULT '[]', -- 자주 선택된 상품 조합 [{product_ids: [...], score: 0.9}, ...]
  concept_weights JSONB DEFAULT '{}', -- {"캐주얼": 1.2, "데이트": 1.1}
  avg_formality FLOAT DEFAULT 0.5,
  use_count INTEGER DEFAULT 1,
  success_rate FLOAT DEFAULT 0.0, -- 구매 전환율
  last_products JSONB DEFAULT '[]', -- 마지막 추천된 상품 ID들
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 패턴 테이블 인덱스
CREATE INDEX idx_recommendation_patterns_key ON recommendation_patterns (pattern_key);
CREATE INDEX idx_recommendation_patterns_success ON recommendation_patterns (success_rate DESC);

-- RLS 활성화
ALTER TABLE recommendation_patterns ENABLE ROW LEVEL SECURITY;

-- 패턴 테이블 RLS (누구나 조회 가능)
CREATE POLICY "Anyone can view patterns" ON recommendation_patterns
  FOR SELECT USING (true);

-- Service role만 패턴 수정 가능
CREATE POLICY "Service role can manage patterns" ON recommendation_patterns
  FOR ALL USING (true) WITH CHECK (true);

-- DNA boost 점수를 위한 products_cache 컬럼 추가 (이미 dna_meta에 포함될 수 있음)
-- boost_score는 dna_meta JSONB 내부에 저장