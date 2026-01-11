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
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'none';
  isAutoSelected: boolean; // 예산 내 자동 선택 여부
}

interface RAGStyleResponse {
  lookName: string;
  styleConcept: string;
  styleReasoning: string;
  selectedProductIds: string[];
  stylingTips: string;
}

// Category priority for auto-selection (top priority first)
const CATEGORY_PRIORITY = ['상의', '하의', '아우터', '액세서리'];

// Generate cache key from request parameters (handles Unicode)
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
  
  // 액세서리 (신발, 가방, 기타 액세서리 포함)
  if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'trainers', 'loafers',
       '가방', 'bag', 'bags', '백', '클러치', 'clutch', 'tote', '토트백', 'holdalls', 'backpacks',
       '액세서리', 'accessory', 'accessories', '스카프', 'scarf', '모자', 'hat', '벨트', 'belt', 'ties', 'scarves', 'hats', 'gloves', '목걸이', '반지', '귀걸이', '팔찌', '시계', '워치', 'watch', 'jewelry', 'necklace', 'bracelet', 'ring'].some(v => cat.includes(v.toLowerCase()))) {
    return '액세서리';
  }
  
  return '액세서리'; // Default to accessory if unknown
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

    // Determine target gender for product filtering
    const isKids = age !== undefined && age <= 12;
    const targetGender = isKids ? 'kids' : gender;
    
    console.log(`[style-recommend] RAG Request: "${userRequest}", Gender: ${gender}, Budget: ${budget}, Age: ${age || 'N/A'}, Target: ${targetGender}`);

    // Step 1: Get merchants list
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    // Step 2: Fetch ALL relevant products from products_cache for each priority category
    console.log(`[style-recommend] Step 1: Fetching products by priority categories...`);
    
    const productsByPriority: Record<string, CachedProduct[]> = {
      '상의': [],
      '하의': [],
      '아우터': [],
      '액세서리': [],
    };
    
    const allCategories = ['상의', '하의', '아우터', '신발', '가방', '원피스', '액세서리', '니트', '셔츠', '블라우스', '코트', '자켓'];
    const allProducts: CachedProduct[] = [];
    
    for (const category of allCategories) {
      let query = supabase
        .from('products_cache')
        .select('*')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .not('image_url', 'is', null);
      
      // Category filter using ILIKE for flexible matching
      const categoryVariants = getCategoryVariants(category);
      const categoryFilter = categoryVariants.map(v => `category.ilike.%${v}%`).join(',');
      query = query.or(categoryFilter);
      
      // Gender filter
      if (isKids) {
        query = query.or(`gender.eq.kids,gender.eq.키즈,gender.is.null`);
      } else {
        const genderEn = gender === '남성' ? 'male' : 'female';
        query = query.or(`gender.eq.${genderEn},gender.eq.${gender},gender.is.null`);
      }
      
      const { data } = await query.order('price', { ascending: true }).limit(20);
      
      if (data && data.length > 0) {
        allProducts.push(...data);
      }
    }
    
    // Remove duplicates and categorize by priority
    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());
    
    for (const product of uniqueProducts) {
      const priorityCat = mapToPriorityCategory(product.category);
      if (productsByPriority[priorityCat]) {
        productsByPriority[priorityCat].push(product);
      }
    }
    
    // Sort each category by price (ascending)
    for (const cat of CATEGORY_PRIORITY) {
      productsByPriority[cat].sort((a, b) => a.price - b.price);
    }
    
    console.log(`[style-recommend] Products by category: 상의=${productsByPriority['상의'].length}, 하의=${productsByPriority['하의'].length}, 아우터=${productsByPriority['아우터'].length}, 액세서리=${productsByPriority['액세서리'].length}`);

    if (uniqueProducts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '추천할 수 있는 상품이 없습니다. 상품 데이터가 수집되면 다시 시도해주세요.',
        look: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Create product context for AI (RAG) - include all products
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
    }));

    console.log(`[style-recommend] Step 2: Sending ${productContext.length} products to AI for selection...`);

    // Step 4: RAG - Ask AI to select products AND generate description
    let ragResponse: RAGStyleResponse | null = null;
    let geminiCalls = 0;
    
    if (LOVABLE_API_KEY) {
      // 현재 계절 계산
      const currentMonth = new Date().getMonth() + 1;
      const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? '봄' 
        : currentMonth >= 6 && currentMonth <= 8 ? '여름'
        : currentMonth >= 9 && currentMonth <= 11 ? '가을' : '겨울';
      
      // 사용자 요청에서 계절 감지
      const requestedSeason = detectSeason(userRequest) || currentSeason;
      const seasonClothingGuide = getSeasonClothingGuide(requestedSeason);
      
      const systemPrompt = `너는 서울 청담동에서 15년 경력의 셀럽 전담 스타일리스트야. 
패션위크 런웨이 분석, 트렌드 예측, 체형별 스타일링이 전문이고 수많은 연예인과 인플루언서의 룩을 담당해왔어.

🎯 핵심 미션:
고객의 요청을 깊이 분석하고, 제공된 상품 목록에서 완벽한 코디를 큐레이션해야 해.

⚠️ 절대 규칙:
1. 반드시 제공된 상품 목록의 ID 중에서만 선택
2. 필수 구성: 상의 + 하의 + 아우터 + 액세서리(신발/가방 등) = 최소 4개 이상
3. 계절감 필수 준수: 
   - 봄/가을: 가디건, 가벼운 자켓, 니트, 긴 바지
   - 여름: 반팔, 린넨, 면 소재, 샌들, 통기성 좋은 옷
   - 겨울: 코트, 패딩, 긴 바지, 두꺼운 니트, 부츠 (반바지/샌들 절대 금지!)
4. 성별에 맞는 스타일링 (남성/여성 구분 명확히)
5. TPO(Time, Place, Occasion) 완벽 분석

📝 스타일 설명 작성 가이드:
- styleConcept: 3-4문장으로 전체 룩의 컨셉과 분위기를 감성적으로 설명
- styleReasoning: 5-6문장으로 각 아이템 선택 이유, 컬러 조화, 실루엣 밸런스를 전문가답게 분석
- 실제 선택한 상품명과 브랜드를 반드시 언급
- 어떤 상황에서 빛날지, 어떤 인상을 줄지 구체적으로 서술

${seasonClothingGuide}`;

      const userPrompt = `🗓️ 현재 시점: ${new Date().toLocaleDateString('ko-KR')} (${currentSeason})
👤 고객 정보: ${gender}, ${age ? `${age}세` : '성인'}
💰 예산: ${budget.toLocaleString()}원
📍 요청 분석 필요: "${userRequest}"

먼저 고객의 요청을 분석해줘:
- 어떤 계절/날씨를 위한 옷인가? ${requestedSeason ? `(감지됨: ${requestedSeason})` : '(분석 필요)'}
- 어떤 상황/장소를 위한 옷인가? (데이트, 출근, 운동, 여행 등)
- 어떤 스타일/분위기를 원하는가? (캐주얼, 포멀, 스포티 등)

아래는 현재 구매 가능한 상품 목록이야. 고객 요청에 가장 적합한 4개 이상의 아이템으로 완벽한 코디를 구성해줘:

${JSON.stringify(productContext, null, 2)}

다음 JSON 형식으로만 응답해:
{
  "lookName": "[상황/계절을 반영한 매력적인 코디 이름]",
  "styleConcept": "🎨 [성별] [핵심 스타일 키워드]\n\n[3-4문장의 감성적인 스타일 설명. 전체 룩의 분위기, 컨셉, 어떤 느낌을 연출하는지 상세히. 선택한 브랜드와 상품명을 자연스럽게 녹여서 설명. 이 룩을 입으면 어떤 인상을 줄 수 있는지까지 포함.]",
  "styleReasoning": "[5-6문장의 전문가 분석. 각 아이템을 왜 선택했는지, 컬러 팔레트가 어떻게 조화를 이루는지, 실루엣 밸런스는 어떤지, 계절감과 TPO에 어떻게 부합하는지 전문 스타일리스트 관점에서 상세 분석.]",
  "selectedProductIds": ["상품ID-1", "상품ID-2", "상품ID-3", "상품ID-4"],
  "stylingTips": "[실제 착용 시 팁: 어떻게 연출하면 좋을지, 추가하면 좋을 아이템, 헤어/메이크업 제안 등 2-3문장]"
}

⚠️ 중요:
- selectedProductIds에는 위 목록에 있는 실제 id만 포함
- 계절이 ${requestedSeason}이므로 ${requestedSeason === '겨울' ? '반바지, 샌들, 민소매 등 여름 아이템 절대 금지!' : requestedSeason === '여름' ? '두꺼운 코트, 패딩, 목도리 등 겨울 아이템 금지!' : '계절에 맞는 레이어링 고려'}
- ${gender}에 맞는 스타일링 필수`;

      try {
        const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
          }),
        });

        geminiCalls++;

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const content = geminiData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            ragResponse = JSON.parse(jsonMatch[0]) as RAGStyleResponse;
            console.log(`[style-recommend] AI selected ${ragResponse.selectedProductIds.length} products`);
          }
        } else {
          console.error('[style-recommend] Gemini API error:', await geminiResponse.text());
        }
      } catch (e) {
        console.error('[style-recommend] Gemini parsing error:', e);
      }
    }

    // Fallback if AI fails - use priority-based selection with season awareness
    if (!ragResponse) {
      console.log(`[style-recommend] AI failed, using priority-based fallback selection`);
      
      const selectedIds: string[] = [];
      let remainingBudget = budget;
      
      // Select one from each priority category
      for (const cat of CATEGORY_PRIORITY) {
        const catProducts = productsByPriority[cat].filter(p => p.price <= remainingBudget);
        
        if (catProducts.length > 0) {
          const selected = catProducts[0];
          selectedIds.push(selected.id);
          remainingBudget -= selected.price;
        } else if (productsByPriority[cat].length > 0) {
          selectedIds.push(productsByPriority[cat][0].id);
        }
      }
      
      ragResponse = {
        lookName: `${gender} ${occasion} 추천 룩`,
        styleConcept: `🎨 ${gender} ${occasion} 스타일\n\n요청하신 "${userRequest}"에 맞춰 예산 내에서 기본 코디를 구성했습니다. 상의, 하의, 아우터, 액세서리를 조화롭게 매칭하여 실용적이면서도 스타일리시한 룩을 완성했습니다.`,
        styleReasoning: `${gender}의 ${occasion} 상황에 적합한 아이템들을 선택했습니다. 상의부터 시작해 하의, 아우터, 액세서리 순서로 예산 범위 내에서 가장 조화로운 조합을 찾았습니다. 각 아이템은 서로 색상과 스타일이 자연스럽게 어울리도록 배치했으며, 전체적인 실루엣 밸런스를 고려했습니다.`,
        selectedProductIds: selectedIds,
        stylingTips: '자신만의 개성을 더해 스타일링해보세요. 액세서리나 작은 소품으로 포인트를 주면 더욱 세련된 룩을 완성할 수 있습니다.'
      };
    }

    // Step 5: Get selected products
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    // Create look items with auto-selection info
    const lookItems: LookItem[] = [];
    let runningTotal = 0;
    
    if (selectedProducts) {
      // Sort products by priority category order
      const sortedProducts = selectedProducts.sort((a, b) => {
        const aPriority = CATEGORY_PRIORITY.indexOf(mapToPriorityCategory(a.category));
        const bPriority = CATEGORY_PRIORITY.indexOf(mapToPriorityCategory(b.category));
        return aPriority - bPriority;
      });
      
      for (const product of sortedProducts) {
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        
        // Auto-select if within budget (by priority order)
        const wouldBeWithinBudget = runningTotal + product.price <= budget;
        const isAutoSelected = wouldBeWithinBudget;
        
        if (isAutoSelected) {
          runningTotal += product.price;
        }
        
        lookItems.push({
          category: getDisplayCategory(product.category),
          product: product,
          affiliateUrl,
          source: 'cache',
          isAutoSelected
        });
      }
    }

    // Step 6: Calculate total price and auto-selected total
    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedTotal = lookItems.filter(i => i.isAutoSelected).reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedCount = lookItems.filter(i => i.isAutoSelected).length;

    // Step 7: Save to style_cache if we have items
    if (lookItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: lookItems.map(l => l.product!.id),
        image_url: lookItems[0].product!.image_url || '',
        use_count: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('style_cache').upsert(lookData, { onConflict: 'cache_key' });
      console.log(`[style-recommend] Saved to style_cache`);
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
      apiCalls: {
        gemini: geminiCalls,
        serpapi: 0
      },
      stats: {
        productsInContext: uniqueProducts.length,
        selectedProducts: lookItems.length,
        autoSelectedProducts: autoSelectedCount,
      }
    };

    console.log(`[style-recommend] RAG Complete. Selected ${lookItems.length} products (${autoSelectedCount} auto-selected), Total: ₩${totalPrice}, Auto-selected Total: ₩${autoSelectedTotal}`);

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

// 계절 감지 함수
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

// 계절별 의류 가이드
function getSeasonClothingGuide(season: string): string {
  const guides: Record<string, string> = {
    '봄': `🌸 봄 스타일링 가이드:
- 추천: 가디건, 가벼운 자켓, 트렌치코트, 니트, 블라우스, 청바지, 면바지, 로퍼, 스니커즈
- 피해야 할 것: 두꺼운 패딩, 털 코트, 두꺼운 기모 제품`,

    '여름': `☀️ 여름 스타일링 가이드:
- 추천: 반팔 티셔츠, 린넨 셔츠, 반바지, 면바지, 샌들, 가벼운 스니커즈, 밀짚 모자
- 피해야 할 것: 두꺼운 코트, 패딩, 니트, 부츠, 기모 제품`,

    '가을': `🍂 가을 스타일링 가이드:
- 추천: 가디건, 자켓, 트렌치코트, 니트, 긴 바지, 앵클부츠, 로퍼
- 피해야 할 것: 샌들, 반바지, 민소매, 여름용 얇은 옷`,

    '겨울': `❄️ 겨울 스타일링 가이드 (필수 준수!):
- 필수 추천: 코트, 패딩, 두꺼운 니트, 기모 제품, 긴 바지, 부츠, 목도리, 장갑
- 절대 금지: 반바지, 샌들, 민소매, 얇은 여름 옷, 크롭탑
- 레이어링 필수: 이너 + 미드레이어 + 아우터 구성`,
  };
  
  return guides[season] || guides['봄'];
}

// Category mapping
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
    // Call LinkPrice API to get actual deeplink
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

  // Fallback: Use merchant deeplink template if available
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

  // Return original URL if no affiliate link can be generated
  return product.product_url;
}