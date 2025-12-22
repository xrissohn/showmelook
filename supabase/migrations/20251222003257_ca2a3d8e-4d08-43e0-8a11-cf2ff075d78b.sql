-- 사용자 프로필 테이블
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  height INTEGER, -- cm
  weight INTEGER, -- kg
  style_preferences TEXT[], -- 선호하는 스타일 태그들
  body_type TEXT, -- 체형
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 프로필 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 스타일 트렌드 테이블 (관리자가 추가)
CREATE TABLE public.style_trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 트렌드 RLS - 모두가 볼 수 있음
ALTER TABLE public.style_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active trends"
  ON public.style_trends FOR SELECT
  USING (is_active = true);

-- 상품 테이블
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- top, bottom, shoes, accessory 등
  price INTEGER NOT NULL, -- 원 단위
  image_url TEXT,
  brand TEXT,
  external_url TEXT, -- 외부 구매 링크
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 상품 RLS - 모두가 볼 수 있음
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (is_active = true);

-- 생성된 이미지 저장 테이블
CREATE TABLE public.generated_looks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt_used TEXT,
  style_trend_id UUID REFERENCES public.style_trends(id),
  product_ids UUID[],
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 생성된 이미지 RLS
ALTER TABLE public.generated_looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own looks"
  ON public.generated_looks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own looks"
  ON public.generated_looks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own looks"
  ON public.generated_looks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own looks"
  ON public.generated_looks FOR DELETE
  USING (auth.uid() = user_id);

-- 장바구니 테이블
CREATE TABLE public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  generated_look_id UUID REFERENCES public.generated_looks(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- 장바구니 RLS
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cart"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own cart"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own cart"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 프로필 업데이트 트리거
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 새 사용자 프로필 자동 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 새 사용자 생성 시 프로필 자동 생성 트리거
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 샘플 스타일 트렌드 데이터
INSERT INTO public.style_trends (name, name_ko, description, image_url, tags) VALUES
  ('Minimalist', '미니멀리스트', '깔끔하고 심플한 라인의 현대적인 스타일', NULL, ARRAY['minimal', 'clean', 'modern']),
  ('Street Style', '스트릿 스타일', '도시적이고 캐주얼한 힙합 감성', NULL, ARRAY['street', 'urban', 'casual']),
  ('Classic Elegance', '클래식 엘레강스', '시간을 초월한 우아함과 품격', NULL, ARRAY['classic', 'elegant', 'formal']),
  ('Athleisure', '애슬레저', '스포티하면서도 일상에 어울리는 활동적인 스타일', NULL, ARRAY['sporty', 'active', 'comfortable']),
  ('Bohemian', '보헤미안', '자유롭고 예술적인 빈티지 감성', NULL, ARRAY['boho', 'vintage', 'artistic']);

-- 샘플 상품 데이터
INSERT INTO public.products (name, name_ko, description, category, price, brand, tags) VALUES
  ('Classic White Tee', '클래식 화이트 티셔츠', '기본에 충실한 순면 티셔츠', 'top', 39000, 'SHOWMELOOK', ARRAY['basic', 'white', 'tshirt']),
  ('Slim Fit Jeans', '슬림핏 청바지', '편안하면서도 깔끔한 라인', 'bottom', 89000, 'SHOWMELOOK', ARRAY['denim', 'slim', 'casual']),
  ('Leather Sneakers', '레더 스니커즈', '고급스러운 가죽 소재의 스니커즈', 'shoes', 159000, 'SHOWMELOOK', ARRAY['sneakers', 'leather', 'white']),
  ('Wool Blend Coat', '울 블렌드 코트', '겨울 필수 아이템 클래식 코트', 'outerwear', 289000, 'SHOWMELOOK', ARRAY['coat', 'winter', 'classic']),
  ('Minimal Watch', '미니멀 워치', '심플한 디자인의 손목시계', 'accessory', 189000, 'SHOWMELOOK', ARRAY['watch', 'minimal', 'accessory']);