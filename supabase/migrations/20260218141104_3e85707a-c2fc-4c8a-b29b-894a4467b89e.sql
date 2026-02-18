
-- 1. look_likes 테이블 생성
CREATE TABLE public.look_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  look_id uuid NOT NULL REFERENCES public.generated_looks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, look_id)
);

-- 2. generated_looks에 컬럼 추가
ALTER TABLE public.generated_looks
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS caption text;

-- 3. look_likes RLS 활성화 + 정책
ALTER TABLE public.look_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON public.look_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert own likes"
  ON public.look_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON public.look_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 4. 인덱스 추가
CREATE INDEX idx_look_likes_look_id ON public.look_likes(look_id);
CREATE INDEX idx_look_likes_user_id ON public.look_likes(user_id);
CREATE INDEX idx_generated_looks_public_popular ON public.generated_looks(like_count DESC) WHERE is_public = true;
CREATE INDEX idx_generated_looks_public_latest ON public.generated_looks(created_at DESC) WHERE is_public = true;
