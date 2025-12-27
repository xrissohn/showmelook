-- merchants 테이블: 제휴 머천트 정보
CREATE TABLE public.merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  base_url TEXT NOT NULL,
  commission_rate DECIMAL(4,2),
  deeplink_template TEXT NOT NULL,
  scrape_type TEXT DEFAULT 'next_data',
  scrape_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- merchants RLS
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active merchants"
ON public.merchants
FOR SELECT
USING (is_active = true);

-- products_cache 테이블: 자동 수집된 상품 정보
CREATE TABLE public.products_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL UNIQUE,
  external_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  price INTEGER NOT NULL,
  original_price INTEGER,
  image_url TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  sizes JSONB,
  is_in_stock BOOLEAN DEFAULT true,
  style_tags TEXT[],
  gender TEXT,
  color TEXT,
  collected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- products_cache 인덱스
CREATE INDEX idx_products_cache_merchant ON public.products_cache(merchant_id);
CREATE INDEX idx_products_cache_category ON public.products_cache(category);
CREATE INDEX idx_products_cache_style_tags ON public.products_cache USING GIN(style_tags);
CREATE INDEX idx_products_cache_gender ON public.products_cache(gender);
CREATE INDEX idx_products_cache_active_stock ON public.products_cache(is_active, is_in_stock);

-- products_cache RLS
ALTER TABLE public.products_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products in cache"
ON public.products_cache
FOR SELECT
USING (is_active = true);

-- updated_at 트리거
CREATE TRIGGER update_products_cache_updated_at
BEFORE UPDATE ON public.products_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();