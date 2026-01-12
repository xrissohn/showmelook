-- Phase 2: Category and Gender Normalization

-- 1. 성별 값 표준화 (여성 → female, 남성 → male)
UPDATE products_cache SET gender = 'female' WHERE gender IN ('여성', 'women', 'woman', 'Women', 'WOMEN');
UPDATE products_cache SET gender = 'male' WHERE gender IN ('남성', 'men', 'man', 'Men', 'MEN');
UPDATE products_cache SET gender = 'unisex' WHERE gender IN ('유니섹스', 'unisex', 'Unisex', '공용');

-- 2. 상의 카테고리 추론 (상품명 기반)
UPDATE products_cache 
SET category = '상의', sub_category = '니트/스웨터'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%니트%' OR name ILIKE '%sweater%' OR name ILIKE '%스웨터%' OR name ILIKE '%knit%');

UPDATE products_cache 
SET category = '상의', sub_category = '셔츠'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%셔츠%' OR name ILIKE '%shirt%' OR name ILIKE '%블라우스%' OR name ILIKE '%blouse%')
  AND name NOT ILIKE '%티셔츠%' AND name NOT ILIKE '%t-shirt%';

UPDATE products_cache 
SET category = '상의', sub_category = '티셔츠'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%티셔츠%' OR name ILIKE '%t-shirt%' OR name ILIKE '%tee%');

UPDATE products_cache 
SET category = '상의', sub_category = '맨투맨/후디'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%후드%' OR name ILIKE '%hoodie%' OR name ILIKE '%맨투맨%' OR name ILIKE '%sweatshirt%');

UPDATE products_cache 
SET category = '상의', sub_category = '카디건'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%카디건%' OR name ILIKE '%cardigan%');

-- 3. 하의 카테고리 추론
UPDATE products_cache 
SET category = '하의', sub_category = '청바지'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%진%' OR name ILIKE '%jeans%' OR name ILIKE '%데님%' OR name ILIKE '%denim%')
  AND name NOT ILIKE '%부츠컷진%'; -- 부츠컷진은 이미 처리됨

UPDATE products_cache 
SET category = '하의', sub_category = '슬랙스'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%슬랙스%' OR name ILIKE '%slacks%' OR name ILIKE '%트라우저%' OR name ILIKE '%trousers%');

UPDATE products_cache 
SET category = '하의', sub_category = '팬츠'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%팬츠%' OR name ILIKE '%pants%' OR name ILIKE '%바지%')
  AND name NOT ILIKE '%진%' AND name NOT ILIKE '%jeans%' AND name NOT ILIKE '%슬랙스%';

UPDATE products_cache 
SET category = '하의', sub_category = '스커트'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%스커트%' OR name ILIKE '%skirt%' OR name ILIKE '%치마%');

-- 4. 아우터 카테고리 추론
UPDATE products_cache 
SET category = '아우터', sub_category = '코트'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%코트%' OR name ILIKE '%coat%');

UPDATE products_cache 
SET category = '아우터', sub_category = '재킷/블레이저'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%재킷%' OR name ILIKE '%jacket%' OR name ILIKE '%블레이저%' OR name ILIKE '%blazer%');

UPDATE products_cache 
SET category = '아우터', sub_category = '패딩'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%패딩%' OR name ILIKE '%puffer%' OR name ILIKE '%다운%' OR name ILIKE '%down jacket%');

-- 5. 원피스 카테고리 추론
UPDATE products_cache 
SET category = '원피스', sub_category = '원피스'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%원피스%' OR name ILIKE '%dress%' OR name ILIKE '%드레스%');

-- 6. 신발 카테고리 추론
UPDATE products_cache 
SET category = '신발', sub_category = '스니커즈'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%스니커즈%' OR name ILIKE '%sneakers%' OR name ILIKE '%운동화%');

UPDATE products_cache 
SET category = '신발', sub_category = '부츠'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%부츠%' OR name ILIKE '%boots%')
  AND name NOT ILIKE '%부츠컷%'; -- 부츠컷 팬츠 제외

UPDATE products_cache 
SET category = '신발', sub_category = '로퍼'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%로퍼%' OR name ILIKE '%loafers%');

-- 7. 가방 카테고리 추론
UPDATE products_cache 
SET category = '가방', sub_category = '가방'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%가방%' OR name ILIKE '%bag%' OR name ILIKE '%백%' OR name ILIKE '%토트%' OR name ILIKE '%tote%');

-- 8. 액세서리 카테고리 추론
UPDATE products_cache 
SET category = '액세서리', sub_category = '액세서리'
WHERE category IN ('여성', '남성', '여성의류', '남성의류', 'women', 'men')
  AND (name ILIKE '%목걸이%' OR name ILIKE '%necklace%' OR name ILIKE '%귀걸이%' OR name ILIKE '%earring%' 
    OR name ILIKE '%반지%' OR name ILIKE '%ring%' OR name ILIKE '%팔찌%' OR name ILIKE '%bracelet%'
    OR name ILIKE '%시계%' OR name ILIKE '%watch%' OR name ILIKE '%모자%' OR name ILIKE '%hat%'
    OR name ILIKE '%스카프%' OR name ILIKE '%scarf%' OR name ILIKE '%벨트%' OR name ILIKE '%belt%');

-- 9. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_cache_dna ON products_cache(dna_text) WHERE dna_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_cache_category_gender ON products_cache(category, gender) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_cache_dna_generated ON products_cache(dna_generated_at) WHERE dna_generated_at IS NOT NULL;