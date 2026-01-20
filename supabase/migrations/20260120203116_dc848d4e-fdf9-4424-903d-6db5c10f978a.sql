-- products_cache 테이블에 external_id unique 제약 조건 추가
ALTER TABLE public.products_cache 
ADD CONSTRAINT products_cache_external_id_key UNIQUE (external_id);