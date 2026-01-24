-- Phase 1: Normalize target values in dna_meta
-- adult_female → female
UPDATE products_cache 
SET dna_meta = jsonb_set(dna_meta, '{target}', '"female"'),
    updated_at = now()
WHERE dna_meta->>'target' = 'adult_female';

-- adult_male → male  
UPDATE products_cache 
SET dna_meta = jsonb_set(dna_meta, '{target}', '"male"'),
    updated_at = now()
WHERE dna_meta->>'target' = 'adult_male';

-- kids_unisex, kids_male, kids_female → kids
UPDATE products_cache 
SET dna_meta = jsonb_set(dna_meta, '{target}', '"kids"'),
    updated_at = now()
WHERE dna_meta->>'target' IN ('kids_unisex', 'kids_male', 'kids_female');

-- adult_unisex → unisex
UPDATE products_cache 
SET dna_meta = jsonb_set(dna_meta, '{target}', '"unisex"'),
    updated_at = now()
WHERE dna_meta->>'target' = 'adult_unisex';

-- Phase 2: Normalize gender column as well
UPDATE products_cache SET gender = 'female', updated_at = now()
WHERE LOWER(gender) IN ('women', 'woman', '여성', 'ladies', 'lady', 'f', 'w');

UPDATE products_cache SET gender = 'male', updated_at = now()
WHERE LOWER(gender) IN ('men', 'man', '남성', 'gentleman', 'm');

UPDATE products_cache SET gender = 'kids', updated_at = now()
WHERE LOWER(gender) IN ('키즈', 'children', '아동', '유아', 'junior', 'baby', '베이비', '남아', '여아', 'boy', 'girl');

UPDATE products_cache SET gender = 'unisex', updated_at = now()
WHERE gender IN ('BAG', 'WATCH', 'EXCLUSIVE', 'ACC', 'JEWELRY') 
   OR gender IS NULL 
   OR LOWER(gender) IN ('unisex', '유니섹스', '공용');

-- Phase 3: Reset color_family to trigger re-inference
-- We'll set color_family to null so dna-batch will regenerate with improved logic
UPDATE products_cache 
SET dna_meta = dna_meta - 'color_family',
    dna_generated_at = null,
    updated_at = now()
WHERE dna_meta->>'color_family' IN ('neutral', 'cool', 'warm', 'pastel');