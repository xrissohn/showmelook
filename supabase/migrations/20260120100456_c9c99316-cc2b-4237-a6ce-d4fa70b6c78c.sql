-- Add style_reasoning column to generated_looks table
ALTER TABLE generated_looks 
ADD COLUMN style_reasoning text;

COMMENT ON COLUMN generated_looks.style_reasoning IS 'AI 스타일리스트의 추천 설명 및 스타일링 팁';