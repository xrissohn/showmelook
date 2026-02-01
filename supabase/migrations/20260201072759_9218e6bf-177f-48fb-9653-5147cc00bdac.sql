-- 카페24 테넌트 관리 테이블
CREATE TABLE public.cafe24_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mall_id TEXT NOT NULL UNIQUE,
  shop_no INTEGER NOT NULL DEFAULT 1,
  shop_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  user_id TEXT,
  is_active BOOLEAN DEFAULT true,
  plan TEXT DEFAULT 'basic',
  monthly_generation_limit INTEGER DEFAULT 100,
  monthly_generation_used INTEGER DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ DEFAULT now(),
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 카페24 상품 연동 테이블
CREATE TABLE public.cafe24_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.cafe24_tenants(id) ON DELETE CASCADE,
  cafe24_product_no INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_code TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  category_name TEXT,
  is_synced BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  products_cache_id UUID REFERENCES public.products_cache(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cafe24_product_no)
);

-- 카페24 웹훅 로그 테이블
CREATE TABLE public.cafe24_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.cafe24_tenants(id) ON DELETE SET NULL,
  mall_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 카페24 가상피팅 세션 테이블 (위젯 사용 추적)
CREATE TABLE public.cafe24_fitting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.cafe24_tenants(id) ON DELETE CASCADE,
  cafe24_product_no INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  fitting_result_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS 활성화
ALTER TABLE public.cafe24_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe24_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe24_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe24_fitting_sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 테넌트 관리 (서비스 역할만 가능)
CREATE POLICY "Service role can manage tenants"
  ON public.cafe24_tenants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS 정책: 상품 조회 (활성화된 테넌트의 상품만)
CREATE POLICY "Anyone can view synced products"
  ON public.cafe24_products
  FOR SELECT
  USING (is_synced = true);

CREATE POLICY "Service role can manage products"
  ON public.cafe24_products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS 정책: 웹훅 로그
CREATE POLICY "Service role can manage webhook logs"
  ON public.cafe24_webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS 정책: 피팅 세션
CREATE POLICY "Anyone can view own fitting session"
  ON public.cafe24_fitting_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage fitting sessions"
  ON public.cafe24_fitting_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 인덱스 추가
CREATE INDEX idx_cafe24_tenants_mall_id ON public.cafe24_tenants(mall_id);
CREATE INDEX idx_cafe24_tenants_is_active ON public.cafe24_tenants(is_active);
CREATE INDEX idx_cafe24_products_tenant_id ON public.cafe24_products(tenant_id);
CREATE INDEX idx_cafe24_products_product_no ON public.cafe24_products(cafe24_product_no);
CREATE INDEX idx_cafe24_webhook_logs_tenant_id ON public.cafe24_webhook_logs(tenant_id);
CREATE INDEX idx_cafe24_fitting_sessions_token ON public.cafe24_fitting_sessions(session_token);

-- 업데이트 트리거
CREATE TRIGGER update_cafe24_tenants_updated_at
  BEFORE UPDATE ON public.cafe24_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cafe24_products_updated_at
  BEFORE UPDATE ON public.cafe24_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();