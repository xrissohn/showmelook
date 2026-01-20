-- Admin만 products_cache를 삭제/수정할 수 있도록 RLS 정책 추가
CREATE POLICY "Admins can delete products" 
ON public.products_cache 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update products" 
ON public.products_cache 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert products" 
ON public.products_cache 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));