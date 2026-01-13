import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sub_category: string | null;
  price: number;
  style_tags: string[] | null;
  gender: string | null;
  color: string | null;
}

interface DNAResult {
  id: string;
  dna_text: string;
  category?: string;
  sub_category?: string;
}

// 상품명에서 카테고리 추론
function inferCategory(name: string, currentCategory: string): { category: string; subCategory: string } {
  const nameLower = name.toLowerCase();
  const nameKr = name;
  
  // 상의 키워드
  const topKeywords = ['니트', '스웨터', '셔츠', '블라우스', '티셔츠', 't-shirt', 'tee', 'shirt', 'sweater', 'knit', 'top', '탑', '카디건', 'cardigan', '후드', 'hoodie', '맨투맨', 'sweatshirt', '폴로', 'polo', '베스트', 'vest', '조끼'];
  const bottomKeywords = ['팬츠', '바지', 'pants', 'trousers', 'jeans', '진', '청바지', '슬랙스', 'slacks', '쇼츠', 'shorts', '반바지', '스커트', 'skirt', '치마', '레깅스', 'leggings'];
  const outerKeywords = ['코트', 'coat', '재킷', 'jacket', '점퍼', 'jumper', '블레이저', 'blazer', '패딩', 'puffer', '다운', 'down', '파카', 'parka', '트렌치', 'trench', '가디건', 'cardigan', '후리스', 'fleece', '무스탕', '야상'];
  const shoeKeywords = ['신발', 'shoes', '스니커즈', 'sneakers', '부츠', 'boots', '로퍼', 'loafers', '샌들', 'sandals', '슬리퍼', 'slippers', '펌프스', 'pumps', '힐', 'heels', '플랫', 'flats', '더비', 'derby', '옥스포드', 'oxford', '슈즈'];
  const bagKeywords = ['가방', 'bag', '백', '토트', 'tote', '크로스백', 'crossbody', '숄더백', 'shoulder', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch'];
  const accessoryKeywords = ['액세서리', 'accessory', '목걸이', 'necklace', '귀걸이', 'earring', '반지', 'ring', '팔찌', 'bracelet', '시계', 'watch', '모자', 'hat', '캡', 'cap', '스카프', 'scarf', '벨트', 'belt', '선글라스', 'sunglasses', '안경'];
  const dressKeywords = ['원피스', 'dress', '드레스', '점프수트', 'jumpsuit', '롬퍼', 'romper'];
  
  // 카테고리 체크
  const checkKeywords = (keywords: string[]) => {
    return keywords.some(kw => nameLower.includes(kw) || nameKr.includes(kw));
  };
  
  let category = currentCategory;
  let subCategory = '';
  
  if (checkKeywords(topKeywords)) {
    category = '상의';
    if (nameLower.includes('니트') || nameLower.includes('sweater') || nameLower.includes('knit')) subCategory = '니트/스웨터';
    else if (nameLower.includes('셔츠') || nameLower.includes('shirt')) subCategory = '셔츠';
    else if (nameLower.includes('티셔츠') || nameLower.includes('t-shirt') || nameLower.includes('tee')) subCategory = '티셔츠';
    else if (nameLower.includes('카디건') || nameLower.includes('cardigan')) subCategory = '카디건';
    else if (nameLower.includes('후드') || nameLower.includes('hoodie') || nameLower.includes('맨투맨') || nameLower.includes('sweatshirt')) subCategory = '맨투맨/후디';
    else subCategory = '기타 상의';
  } else if (checkKeywords(dressKeywords)) {
    category = '원피스';
    subCategory = nameLower.includes('점프수트') || nameLower.includes('jumpsuit') ? '점프수트' : '원피스';
  } else if (checkKeywords(bottomKeywords)) {
    category = '하의';
    if (nameLower.includes('진') || nameLower.includes('jeans') || nameLower.includes('데님') || nameLower.includes('denim')) subCategory = '청바지';
    else if (nameLower.includes('슬랙스') || nameLower.includes('slacks')) subCategory = '슬랙스';
    else if (nameLower.includes('쇼츠') || nameLower.includes('shorts') || nameLower.includes('반바지')) subCategory = '반바지';
    else if (nameLower.includes('스커트') || nameLower.includes('skirt') || nameLower.includes('치마')) subCategory = '스커트';
    else subCategory = '기타 하의';
  } else if (checkKeywords(outerKeywords)) {
    category = '아우터';
    if (nameLower.includes('코트') || nameLower.includes('coat')) subCategory = '코트';
    else if (nameLower.includes('재킷') || nameLower.includes('jacket') || nameLower.includes('블레이저') || nameLower.includes('blazer')) subCategory = '재킷/블레이저';
    else if (nameLower.includes('패딩') || nameLower.includes('puffer') || nameLower.includes('다운') || nameLower.includes('down')) subCategory = '패딩';
    else subCategory = '기타 아우터';
  } else if (checkKeywords(shoeKeywords)) {
    category = '신발';
    if (nameLower.includes('스니커즈') || nameLower.includes('sneakers')) subCategory = '스니커즈';
    else if (nameLower.includes('부츠') || nameLower.includes('boots')) subCategory = '부츠';
    else if (nameLower.includes('로퍼') || nameLower.includes('loafers')) subCategory = '로퍼';
    else subCategory = '기타 신발';
  } else if (checkKeywords(bagKeywords)) {
    category = '가방';
    subCategory = '가방';
  } else if (checkKeywords(accessoryKeywords)) {
    category = '액세서리';
    subCategory = '액세서리';
  }
  
  return { category, subCategory };
}

// 성별 정규화
function normalizeGender(gender: string | null): string | null {
  if (!gender) return null;
  const g = gender.toLowerCase();
  if (['여성', 'women', 'woman', 'female', 'f', 'w'].includes(g)) return 'female';
  if (['남성', 'men', 'man', 'male', 'm'].includes(g)) return 'male';
  if (['unisex', '유니섹스', '공용'].includes(g)) return 'unisex';
  return gender;
}

// Generate DNA for a single product
async function generateDNA(product: Product, lovableApiKey: string | undefined, mode: string): Promise<DNAResult> {
  const { category: inferredCategory, subCategory } = inferCategory(product.name, product.category);
  
  let dnaText = '';
  
  if (lovableApiKey && mode === 'generate') {
    const prompt = `상품 정보를 분석하여 스타일 DNA를 생성해주세요.

상품명: ${product.name}
브랜드: ${product.brand || '알 수 없음'}
카테고리: ${inferredCategory}${subCategory ? ` > ${subCategory}` : ''}
가격: ${product.price.toLocaleString()}원
색상: ${product.color || '알 수 없음'}
기존 태그: ${product.style_tags?.join(', ') || '없음'}

다음 형식으로 DNA를 생성해주세요 (한 줄로):
[스타일태그1,스타일태그2,스타일태그3] | 특징: (간단한 특징 설명) | 코디팁: (어울리는 스타일링)`;

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: '당신은 패션 스타일 전문가입니다. 간결하고 정확한 DNA를 생성합니다.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        dnaText = aiData.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch (aiError) {
      console.error(`[dna-batch] AI error for ${product.id}:`, aiError);
    }
  }
  
  // Fallback: Generate basic DNA from existing data
  if (!dnaText) {
    const tags = product.style_tags?.slice(0, 3).join(',') || '베이직';
    const brandInfo = product.brand ? `${product.brand} 스타일` : '캐주얼';
    dnaText = `[${tags}] | 특징: ${brandInfo} ${subCategory || inferredCategory} | 코디팁: 다양한 스타일에 매치 가능`;
  }
  
  return {
    id: product.id,
    dna_text: dnaText,
    category: inferredCategory,
    sub_category: subCategory || undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 10, mode = 'generate' } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Limit batch size to prevent timeout (max 20 for parallel processing)
    const effectiveBatchSize = Math.min(batchSize, 20);
    
    console.log(`[dna-batch] Starting DNA batch generation, mode: ${mode}, batchSize: ${effectiveBatchSize}`);
    
    // Get products without DNA
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
      .is('dna_text', null)
      .eq('is_active', true)
      .limit(effectiveBatchSize);
    
    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }
    
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No products need DNA generation',
        processed: 0,
        remaining: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`[dna-batch] Found ${products.length} products without DNA`);
    
    // Get remaining count
    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('*', { count: 'exact', head: true })
      .is('dna_text', null)
      .eq('is_active', true);
    
    const errors: { id: string; error: string }[] = [];
    
    // Process products in parallel (5 at a time to avoid rate limiting)
    const CONCURRENT_LIMIT = 5;
    const results: DNAResult[] = [];
    
    for (let i = 0; i < products.length; i += CONCURRENT_LIMIT) {
      const batch = (products as Product[]).slice(i, i + CONCURRENT_LIMIT);
      const batchPromises = batch.map(product => 
        generateDNA(product, lovableApiKey, mode)
          .catch(err => {
            console.error(`[dna-batch] Error processing ${product.id}:`, err);
            errors.push({ id: product.id, error: err instanceof Error ? err.message : 'Unknown error' });
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is DNAResult => r !== null));
    }
    
    // Batch update products with DNA (parallel updates)
    let updatedCount = 0;
    const updatePromises = results.map(async (result) => {
      const updateData: Record<string, any> = {
        dna_text: result.dna_text,
        dna_generated_at: new Date().toISOString(),
      };
      
      if (result.category) {
        updateData.category = result.category;
      }
      if (result.sub_category) {
        updateData.sub_category = result.sub_category;
      }
      
      const { error: updateError } = await supabase
        .from('products_cache')
        .update(updateData)
        .eq('id', result.id);
      
      if (!updateError) {
        return true;
      } else {
        console.error(`[dna-batch] Failed to update ${result.id}:`, updateError);
        errors.push({ id: result.id, error: updateError.message });
        return false;
      }
    });
    
    const updateResults = await Promise.all(updatePromises);
    updatedCount = updateResults.filter(Boolean).length;
    
    console.log(`[dna-batch] Completed: ${updatedCount} updated, ${errors.length} errors, ${(remainingCount || 0) - products.length} remaining`);
    
    return new Response(JSON.stringify({
      success: true,
      processed: products.length,
      updated: updatedCount,
      errors: errors.length,
      remaining: Math.max(0, (remainingCount || 0) - products.length),
      errorDetails: errors.slice(0, 10),
      sampleDNA: results.slice(0, 3).map(r => ({ id: r.id, dna: r.dna_text })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('[dna-batch] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
