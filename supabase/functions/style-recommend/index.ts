import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  merchant_id: string | null;
  color: string | null;
  gender: string | null;
  sub_category: string | null;
  dna_text: string | null;
  dna_generated_at: string | null;
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'none';
  isAutoSelected: boolean;
}

interface RAGStyleResponse {
  lookName: string;
  styleConcept: string;
  styleReasoning: string;
  selectedProductIds: string[];
  stylingTips: string;
  productDNAs?: { id: string; dna: string }[];
}

// Category priority for auto-selection (one per category)
const CATEGORY_PRIORITY = ['상의', '하의', '아우터', '신발', '가방'];

// Generate cache key from request parameters
function generateCacheKey(gender: string, style: string, occasion: string, budget: number): string {
  const normalized = `${gender}|${style}|${occasion}|${Math.floor(budget / 50000) * 50000}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `style_${Math.abs(hash).toString(36)}`;
}

// Map product category to priority category
function mapToPriorityCategory(category: string): string {
  const cat = category.toLowerCase();
  
  // 상의
  if (['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'shirts', 'polo shirts'].some(v => cat.includes(v.toLowerCase()))) {
    return '상의';
  }
  
  // 하의 (원피스 포함)
  if (['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress', 'dresses', '드레스'].some(v => cat.includes(v.toLowerCase()))) {
    return '하의';
  }
  
  // 아우터
  if (['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'jackets', 'coats'].some(v => cat.includes(v.toLowerCase()))) {
    return '아우터';
  }
  
  // 신발
  if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'trainers', 'loafers'].some(v => cat.includes(v.toLowerCase()))) {
    return '신발';
  }
  
  // 가방
  if (['가방', 'bag', 'bags', '백', '클러치', 'clutch', 'tote', '토트백', 'holdalls', 'backpacks'].some(v => cat.includes(v.toLowerCase()))) {
    return '가방';
  }
  
  // 액세서리
  if (['액세서리', 'accessory', 'accessories', '스카프', 'scarf', '모자', 'hat', '벨트', 'belt', 'ties', 'scarves', 'hats', 'gloves', '목걸이', '반지', '귀걸이', '팔찌', '시계', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring'].some(v => cat.includes(v.toLowerCase()))) {
    return '액세서리';
  }
  
  return '액세서리';
}

// Get specific sub-category for display
function getDisplayCategory(category: string): string {
  const cat = category.toLowerCase();
  
  if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'trainers', 'loafers'].some(v => cat.includes(v.toLowerCase()))) {
    return '신발';
  }
  if (['가방', 'bag', 'bags', '백', '클러치', 'clutch', 'tote', '토트백', 'holdalls', 'backpacks'].some(v => cat.includes(v.toLowerCase()))) {
    return '가방';
  }
  
  return mapToPriorityCategory(category);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false, age } = await req.json();

    if (!userRequest) {
      return new Response(JSON.stringify({ error: 'userRequest is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const LINKPRICE_AFFILIATE_ID = Deno.env.get('LINKPRICE_AFFILIATE_ID') || 'A100915488';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const occasion = extractOccasion(userRequest);
    const cacheKey = generateCacheKey(gender, userRequest.substring(0, 20), occasion, budget);

    const isKids = age !== undefined && age <= 12;
    const targetGender = isKids ? 'kids' : gender;
    
    console.log(`[style-recommend] RAG Request: "${userRequest}", Gender: ${gender}, Budget: ${budget}, Age: ${age || 'N/A'}`);

    // Step 1: Get merchants list
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    // Step 2: Fetch products - one from each category
    console.log(`[style-recommend] Fetching products by category...`);
    
    const productsByPriority: Record<string, CachedProduct[]> = {};
    for (const cat of CATEGORY_PRIORITY) {
      productsByPriority[cat] = [];
    }
    productsByPriority['액세서리'] = [];
    
    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? '봄' 
      : currentMonth >= 6 && currentMonth <= 8 ? '여름'
      : currentMonth >= 9 && currentMonth <= 11 ? '가을' : '겨울';
    const requestedSeason = detectSeason(userRequest) || currentSeason;
    
    const allCategories = ['상의', '하의', '아우터', '신발', '가방', '원피스', '액세서리', '니트', '셔츠', '블라우스', '코트', '자켓'];
    const allProducts: CachedProduct[] = [];
    
    const seasonExcludeKeywords: Record<string, string[]> = {
      '겨울': ['shorts', '반바지', '샌들', 'sandal', '민소매', 'sleeveless', 'crop', '크롭', '린넨', 'linen', '슬리퍼', 'slipper', '플립플롭', 'flip'],
      '여름': ['패딩', 'padding', 'puffer', '퍼퍼', '코트', 'coat', '기모', '털', 'fur', '울', 'wool', '캐시미어', 'cashmere', '다운', 'down'],
      '봄': ['패딩', 'padding', 'puffer', '퍼퍼', '기모', '털', 'fur'],
      '가을': ['샌들', 'sandal', '슬리퍼', 'slipper', '플립플롭', 'flip', '반바지', 'shorts'],
    };
    
    const excludeKeywords = seasonExcludeKeywords[requestedSeason] || [];
    
    console.log(`[style-recommend] Season: ${requestedSeason}, excluding: ${excludeKeywords.join(', ')}`);
    
    for (const category of allCategories) {
      let query = supabase
        .from('products_cache')
        .select('*, dna_text, dna_generated_at')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .not('image_url', 'is', null);
      
      const categoryVariants = getCategoryVariants(category);
      const categoryFilter = categoryVariants.map(v => `category.ilike.%${v}%`).join(',');
      query = query.or(categoryFilter);
      
      if (isKids) {
        query = query.or(`gender.eq.kids,gender.eq.키즈,gender.is.null`);
      } else if (gender === '유니섹스' || gender === 'unisex') {
        query = query.or(`gender.eq.unisex,gender.eq.유니섹스,gender.is.null`);
      } else {
        const genderEn = gender === '남성' ? 'male' : 'female';
        const genderKo = gender === '남성' ? '남성' : '여성';
        query = query.or(`gender.eq.${genderEn},gender.eq.${genderKo},gender.eq.unisex,gender.eq.유니섹스,gender.is.null`);
      }
      
      const { data } = await query.order('price', { ascending: true }).limit(30);
      
      if (data && data.length > 0) {
        const filteredData = data.filter(product => {
          const productName = (product.name || '').toLowerCase();
          const productCategory = (product.category || '').toLowerCase();
          const subCategory = (product.sub_category || '').toLowerCase();
          const productGender = (product.gender || '').toLowerCase();
          const combined = `${productName} ${productCategory} ${subCategory}`;
          
          if (!isKids && gender !== '유니섹스' && gender !== 'unisex') {
            const oppositeGenderEn = gender === '남성' ? 'female' : 'male';
            const oppositeGenderKo = gender === '남성' ? '여성' : '남성';
            if (productGender === oppositeGenderEn || productGender === oppositeGenderKo) {
              return false;
            }
          }
          
          const isExcluded = excludeKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
          return !isExcluded;
        });
        
        allProducts.push(...filteredData);
      }
    }
    
    // Remove duplicates and categorize
    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());
    
    for (const product of uniqueProducts) {
      const priorityCat = mapToPriorityCategory(product.category);
      if (productsByPriority[priorityCat]) {
        productsByPriority[priorityCat].push(product);
      }
    }
    
    // Sort each category by price
    for (const cat of [...CATEGORY_PRIORITY, '액세서리']) {
      if (productsByPriority[cat]) {
        productsByPriority[cat].sort((a, b) => a.price - b.price);
      }
    }
    
    console.log(`[style-recommend] Products: 상의=${productsByPriority['상의']?.length || 0}, 하의=${productsByPriority['하의']?.length || 0}, 아우터=${productsByPriority['아우터']?.length || 0}, 신발=${productsByPriority['신발']?.length || 0}, 가방=${productsByPriority['가방']?.length || 0}`);

    if (uniqueProducts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '추천할 수 있는 상품이 없습니다.',
        look: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Create product context with existing DNA if available
    const productContext = uniqueProducts.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      priorityCategory: mapToPriorityCategory(p.category),
      sub_category: p.sub_category,
      color: p.color,
      style_tags: p.style_tags,
      dna: p.dna_text || null, // Include existing DNA for faster reasoning
    }));

    // Split products with/without DNA
    const productsWithDNA = productContext.filter(p => p.dna);
    const productsWithoutDNA = productContext.filter(p => !p.dna);
    
    console.log(`[style-recommend] Products with DNA: ${productsWithDNA.length}, without DNA: ${productsWithoutDNA.length}`);

    // Step 4: RAG with GPT-5
    let ragResponse: RAGStyleResponse | null = null;
    let geminiCalls = 0;
    
    if (LOVABLE_API_KEY) {
      const seasonClothingGuide = getSeasonClothingGuide(requestedSeason);
      
      // Build smarter prompt using DNA if available
      const dnaContext = productsWithDNA.length > 0 
        ? `\n\n📊 이미 분석된 상품 DNA (빠른 참고용):\n${productsWithDNA.slice(0, 10).map(p => `- ${p.name}: ${p.dna}`).join('\n')}`
        : '';
      
      const systemPrompt = `너는 서울 청담동 15년 경력 셀럽 전담 스타일리스트야.

🎯 핵심 미션:
고객 요청을 분석하고, 제공된 상품에서 완벽한 1개 룩을 큐레이션해.

⚠️ 절대 규칙:
1. 제공된 상품 ID 중에서만 선택
2. ⭐ 카테고리당 1개씩만 선택: 상의 1개, 하의 1개, 아우터 1개(선택), 신발 1개, 가방 1개(선택) = 총 3~5개
3. 계절감 필수: ${requestedSeason}
4. 성별 구분 명확히: ${gender}

📋 DNA 생성 요청:
선택한 상품 중 dna가 없는 상품은 아래 형식으로 DNA를 생성해줘:
"[스타일태그1,스타일태그2] | 장점: ... | 코디팁: ..."

${seasonClothingGuide}`;

      const userPrompt = `🗓️ 현재: ${new Date().toLocaleDateString('ko-KR')} (${currentSeason})
👤 고객: ${gender}${age ? `, ${age}세` : ''}
💰 예산: ${budget.toLocaleString()}원
📍 요청: "${userRequest}"
${dnaContext}

📦 구매 가능한 상품 (카테고리당 1개씩만 선택해야 함):
${JSON.stringify(productContext.slice(0, 50), null, 1)}

다음 JSON 형식으로만 응답해:
{
  "lookName": "[상황/계절 반영 코디명]",
  "styleConcept": "🎨 [성별] [스타일]\n\n[3-4문장 스타일 설명]",
  "styleReasoning": "[5-6문장 전문가 분석]",
  "selectedProductIds": ["상품ID-1", "상품ID-2", "상품ID-3"],
  "stylingTips": "[착용 팁 2-3문장]",
  "productDNAs": [
    {"id": "dna가 없던 상품ID", "dna": "[스타일태그] | 장점: ... | 코디팁: ..."}
  ]
}

⚠️ 중요:
- 상의는 반드시 1개만!
- 하의도 반드시 1개만!
- 아우터는 ${requestedSeason === '겨울' ? '필수' : '선택'}
- productDNAs: dna가 null이었던 선택 상품만 DNA 생성`;

      try {
        console.log('[style-recommend] Using GPT-5 for style reasoning...');
        
        const gptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
          }),
        });

        geminiCalls++;

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          const content = gptData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            ragResponse = JSON.parse(jsonMatch[0]) as RAGStyleResponse;
            console.log(`[style-recommend] GPT-5 selected ${ragResponse.selectedProductIds.length} products`);
            
            // Save generated DNAs to database (async, don't wait)
            if (ragResponse.productDNAs && ragResponse.productDNAs.length > 0) {
              console.log(`[style-recommend] Saving ${ragResponse.productDNAs.length} new product DNAs...`);
              
              for (const dnaItem of ragResponse.productDNAs) {
                supabase
                  .from('products_cache')
                  .update({ 
                    dna_text: dnaItem.dna,
                    dna_generated_at: new Date().toISOString()
                  })
                  .eq('id', dnaItem.id)
                  .then(({ error }) => {
                    if (error) {
                      console.error(`[style-recommend] Failed to save DNA for ${dnaItem.id}:`, error);
                    } else {
                      console.log(`[style-recommend] Saved DNA for product ${dnaItem.id}`);
                    }
                  });
              }
            }
          }
        } else {
          const errorText = await gptResponse.text();
          console.error('[style-recommend] GPT-5 API error:', gptResponse.status, errorText);
        }
      } catch (e) {
        console.error('[style-recommend] GPT-5 parsing error:', e);
      }
    }

    // Fallback if AI fails
    if (!ragResponse) {
      console.log(`[style-recommend] AI failed, using fallback selection`);
      
      const selectedIds: string[] = [];
      let remainingBudget = budget;
      
      // Select ONE from each priority category
      for (const cat of CATEGORY_PRIORITY) {
        const catProducts = productsByPriority[cat]?.filter(p => p.price <= remainingBudget) || [];
        
        if (catProducts.length > 0) {
          const selected = catProducts[0];
          selectedIds.push(selected.id);
          remainingBudget -= selected.price;
        }
      }
      
      ragResponse = {
        lookName: `${gender} ${occasion} 추천 룩`,
        styleConcept: `🎨 ${gender} ${occasion} 스타일\n\n요청하신 "${userRequest}"에 맞춰 기본 코디를 구성했습니다.`,
        styleReasoning: `${gender}의 ${occasion} 상황에 적합한 아이템들을 선택했습니다. 상의, 하의, 아우터, 신발, 가방 순서로 예산 범위 내에서 조화로운 조합을 찾았습니다.`,
        selectedProductIds: selectedIds,
        stylingTips: '자신만의 개성을 더해 스타일링해보세요.'
      };
    }

    // Step 5: Enforce one per category for selected products
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    const lookItems: LookItem[] = [];
    let runningTotal = 0;
    const usedCategories = new Set<string>();
    
    if (selectedProducts) {
      // Sort by priority
      const sortedProducts = selectedProducts.sort((a, b) => {
        const aPriority = CATEGORY_PRIORITY.indexOf(mapToPriorityCategory(a.category));
        const bPriority = CATEGORY_PRIORITY.indexOf(mapToPriorityCategory(b.category));
        return aPriority - bPriority;
      });
      
      for (const product of sortedProducts) {
        const displayCat = getDisplayCategory(product.category);
        const priorityCat = mapToPriorityCategory(product.category);
        
        // Skip if we already have one from this priority category
        if (usedCategories.has(priorityCat)) {
          console.log(`[style-recommend] Skipping duplicate ${priorityCat}: ${product.name}`);
          continue;
        }
        
        usedCategories.add(priorityCat);
        
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        
        const wouldBeWithinBudget = runningTotal + product.price <= budget;
        const isAutoSelected = wouldBeWithinBudget;
        
        if (isAutoSelected) {
          runningTotal += product.price;
        }
        
        lookItems.push({
          category: displayCat,
          product: product,
          affiliateUrl,
          source: 'cache',
          isAutoSelected
        });
      }
    }

    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedTotal = lookItems.filter(i => i.isAutoSelected).reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedCount = lookItems.filter(i => i.isAutoSelected).length;

    // Save to cache
    if (lookItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: lookItems.map(l => l.product!.id),
        image_url: lookItems[0].product!.image_url || '',
        use_count: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('style_cache').upsert(lookData, { onConflict: 'cache_key' });
    }

    const response = {
      success: true,
      cacheHit: false,
      look: {
        name: ragResponse.lookName,
        styleConcept: ragResponse.styleConcept,
        styleReasoning: ragResponse.styleReasoning,
        items: lookItems,
        totalPrice,
        autoSelectedTotal,
        autoSelectedCount,
        budget,
        stylingTips: ragResponse.stylingTips,
      },
      apiCalls: { gemini: geminiCalls, serpapi: 0 },
      stats: {
        productsInContext: uniqueProducts.length,
        selectedProducts: lookItems.length,
        autoSelectedProducts: autoSelectedCount,
        dnaGenerated: ragResponse.productDNAs?.length || 0,
      }
    };

    console.log(`[style-recommend] Complete. ${lookItems.length} items (1 per category), Total: ₩${totalPrice}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[style-recommend] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function extractOccasion(request: string): string {
  const occasions = ['데이트', '출근', '비즈니스', '캐주얼', '파티', '여행', '운동', '결혼식', '활동', '야외', '등산', '소풍'];
  for (const occ of occasions) {
    if (request.includes(occ)) return occ;
  }
  return '캐주얼';
}

function detectSeason(request: string): string | null {
  const seasonKeywords: Record<string, string[]> = {
    '봄': ['봄', '봄철', '3월', '4월', '5월', '벚꽃', '나들이', '산뜻'],
    '여름': ['여름', '여름철', '6월', '7월', '8월', '더운', '시원한', '바캉스', '휴가', '해변'],
    '가을': ['가을', '가을철', '9월', '10월', '11월', '단풍', '선선한'],
    '겨울': ['겨울', '겨울철', '12월', '1월', '2월', '추운', '따뜻한', '크리스마스', '눈', '스키'],
  };
  
  for (const [season, keywords] of Object.entries(seasonKeywords)) {
    if (keywords.some(kw => request.includes(kw))) {
      return season;
    }
  }
  return null;
}

function getSeasonClothingGuide(season: string): string {
  const guides: Record<string, string> = {
    '봄': `🌸 봄: 가디건, 가벼운 자켓, 니트, 블라우스, 청바지, 로퍼, 스니커즈`,
    '여름': `☀️ 여름: 반팔, 린넨, 반바지, 샌들, 가벼운 원피스`,
    '가을': `🍂 가을: 가디건, 자켓, 트렌치, 니트, 긴 바지, 앵클부츠`,
    '겨울': `❄️ 겨울: 코트, 패딩, 두꺼운 니트, 긴 바지, 부츠 (반바지/샌들 금지!)`,
  };
  return guides[season] || guides['봄'];
}

const categoryMap: Record<string, string[]> = {
  '상의': ['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'Shirts', 'Polo Shirts'],
  '하의': ['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'Trousers', '원피스', 'dress', 'dresses'],
  '아우터': ['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'Jackets', 'Coats'],
  '신발': ['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'Trainers', 'Loafers'],
  '가방': ['가방', 'bag', 'bags', 'accessory', '백', '클러치', 'clutch', 'tote', '토트백', 'Holdalls', 'Backpacks'],
  '원피스': ['원피스', 'dress', 'dresses', '드레스'],
  '액세서리': ['액세서리', 'accessory', 'accessories', '스카프', 'scarf', '모자', 'hat', '벨트', 'belt', 'Ties', 'Scarves', 'Hats', 'Gloves', '목걸이', '반지', '귀걸이', '팔찌', '시계'],
};

function getCategoryVariants(category: string): string[] {
  const lowerCat = category.toLowerCase();
  for (const [key, variants] of Object.entries(categoryMap)) {
    if (key === category || variants.some(v => v.toLowerCase() === lowerCat)) {
      return [...new Set([key, ...variants])];
    }
  }
  return [category, category.toLowerCase()];
}

async function generateAffiliateUrl(
  product: CachedProduct, 
  merchants: any[], 
  affiliateId: string
): Promise<string | null> {
  if (!product.product_url) return null;

  try {
    const encodedUrl = encodeURIComponent(product.product_url);
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${affiliateId}&url=${encodedUrl}&mode=json`;
    
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const responseText = await response.text();
      try {
        const linkPriceData = JSON.parse(responseText);
        if (linkPriceData.result === 'S' && linkPriceData.url) {
          return linkPriceData.url;
        }
      } catch (e) {
        console.log(`[style-recommend] LinkPrice parse error:`, e);
      }
    }
  } catch (e) {
    console.log(`[style-recommend] LinkPrice API error:`, e);
  }

  const merchant = merchants.find(m => product.merchant_id === m.id || 
    product.product_url.includes(m.base_url.replace('https://', '').replace('http://', '')));

  if (merchant?.deeplink_template) {
    const encodedProductUrl = encodeURIComponent(product.product_url);
    const affiliateUrl = merchant.deeplink_template
      .replace('{affiliate_id}', affiliateId)
      .replace('{encoded_url}', encodedProductUrl)
      .replace('{product_url}', encodedProductUrl);
    return affiliateUrl;
  }

  return product.product_url;
}
