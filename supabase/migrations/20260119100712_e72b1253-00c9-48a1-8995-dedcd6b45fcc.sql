-- 1. user_subscriptions 테이블에 새 컬럼 추가
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS gallery_limit INTEGER NOT NULL DEFAULT 10;

ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS max_profiles INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';

ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- 2. 역할 ENUM 생성
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. user_roles 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 4. RLS 활성화
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. 역할 확인 함수 (SECURITY DEFINER로 재귀 RLS 방지)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. user_roles RLS 정책
DROP POLICY IF EXISTS "Users can view own roles or admins can view all" ON public.user_roles;
CREATE POLICY "Users can view own roles or admins can view all"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7. family_profiles 테이블 생성 (Premium 전용)
CREATE TABLE IF NOT EXISTS public.family_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    relationship TEXT,
    avatar_url TEXT,
    height INTEGER,
    weight INTEGER,
    body_type TEXT,
    gender TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. family_profiles RLS 활성화
ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;

-- 9. family_profiles RLS 정책
DROP POLICY IF EXISTS "Users can view own family profiles" ON public.family_profiles;
CREATE POLICY "Users can view own family profiles"
ON public.family_profiles FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own family profiles" ON public.family_profiles;
CREATE POLICY "Users can insert own family profiles"
ON public.family_profiles FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own family profiles" ON public.family_profiles;
CREATE POLICY "Users can update own family profiles"
ON public.family_profiles FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own family profiles" ON public.family_profiles;
CREATE POLICY "Users can delete own family profiles"
ON public.family_profiles FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());

-- 10. family_profiles updated_at 트리거
DROP TRIGGER IF EXISTS update_family_profiles_updated_at ON public.family_profiles;
CREATE TRIGGER update_family_profiles_updated_at
BEFORE UPDATE ON public.family_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 11. 관리자 자동 지정 함수
CREATE OR REPLACE FUNCTION public.assign_admin_by_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'xrissohn@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 12. 기존 관리자 지정 (xrissohn@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'xrissohn@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;