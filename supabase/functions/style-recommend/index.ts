import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StyleGuideItem {
  category: string;
  searchKeywords: string;
  styleTags: string[];
  priceRange: { min: number; max: number };
  colorSuggestion: string;
}

interface GeminiStyleResponse {
  lookName: string;
  items: StyleGuideItem[];
  stylingTips: string;
}

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
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'none';
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false } = await req.json();

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

    console.log(`[style-recommend] Request: "${userRequest}", Gender: ${gender}, Budget: ${budget}`);
    console.log(`[style-recommend] Cache key: ${cacheKey}`);

    // Step 1: Check style_cache
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('style_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(`[style-recommend] Cache HIT`);
        await supabase
          .from('style_cache')
          .update({ use_count: (cached.use_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('id', cached.id);

        let items: LookItem[] = [];
        if (cached.product_ids && cached.product_ids.length > 0) {
          const { data: merchants } = await supabase
            .from('merchants')
            .select('*')
            .eq('is_active', true);
            
          const { data: cachedProducts } = await supabase
            .from('products_cache')
            .select('*')
            .in('id', cached.product_ids);

          if (cachedProducts) {
            items = await Promise.all(cachedProducts.map(async (product: CachedProduct) => ({
              category: product.category,
              product: product,
              affiliateUrl: await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID),
              source: 'cache' as const
            })));
          }
        }

        return new Response(JSON.stringify({
          success: true,
          cacheHit: true,
          look: { ...cached, items },
          apiCalls: { gemini: 0, serpapi: 0 }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[style-recommend] Cache MISS, proceeding with Gemini`);

    // Step 2: Get merchants list
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    const merchantNames = merchants?.map(m => m.name_ko) || [];

    // Step 3: Gemini Style Director
    let geminiCalls = 0;
    let styleGuide: GeminiStyleResponse | null = null;

    const expectedItems = 4;
    const maxItemBudget = Math.floor(budget / expectedItems * 1.2);
    
    if (LOVABLE_API_KEY) {
      const systemPrompt = `너는 이 지구상 최고의 패션 MD이자 스타일리스트야. 
수십 년간 패션 업계에서 일하며 W컨셉, 한섬, 무신사 등 한국 최고의 패션 플랫폼에서 MD로 활동해왔어.
트렌드를 읽는 눈과 고객의 니즈를 정확히 파악하는 능력이 탁월해.

중요 규칙:
1. 카테고리와 상품이 반드시 일치해야 해 (상의=탑/블라우스/셔츠/니트, 하의=팬츠/스커트/청바지, 신발=구두/스니커즈/부츠, 가방=백/클러치, 아우터=자켓/코트/점퍼)
2. 검색 키워드에 반드시 해당 카테고리 한글명을 포함해 (예: "여성 화이트 블라우스 상의 캐주얼")
3. 총 예산을 절대 초과하면 안 돼. 각 아이템 가격의 합이 총 예산 이하가 되도록 설정해
4. 반드시 유효한 JSON만 응답해`;

      const stylePrompt = `사용자 요청: "${userRequest}"
성별: ${gender}
총 예산: ${budget}원 (모든 아이템 가격 합계가 이 금액 이하여야 함)
아이템당 최대 예산: ${maxItemBudget}원

참고 쇼핑몰: ${merchantNames.join(', ')}

다음 JSON 형식으로만 응답해:
{
  "lookName": "코디 이름",
  "items": [
    {
      "category": "상의",
      "categoryKeyword": "블라우스",
      "searchKeywords": "여성 화이트 블라우스 상의 캐주얼",
      "styleTags": ["캐주얼", "로맨틱"],
      "priceRange": { "min": 20000, "max": 50000 },
      "colorSuggestion": "화이트"
    },
    {
      "category": "하의",
      "categoryKeyword": "청바지",
      "searchKeywords": "여성 하이웨이스트 청바지 하의",
      "styleTags": ["캐주얼"],
      "priceRange": { "min": 30000, "max": 60000 },
      "colorSuggestion": "블루"
    }
  ],
  "stylingTips": "스타일링 팁"
}

카테고리는 상의, 하의, 아우터, 신발, 가방 중에서만 선택하고, categoryKeyword에 구체적인 품목명을 넣어.
3~5개 아이템을 추천하되, 각 아이템 priceRange.max 합계가 ${budget}원을 넘지 않도록 해.`;

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
              { role: 'user', content: stylePrompt }
            ],
          }),
        });

        geminiCalls++;

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const content = geminiData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as GeminiStyleResponse;
            console.log(`[style-recommend] Gemini style guide:`, JSON.stringify(parsed, null, 2));
            
            const totalMaxPrice = parsed.items.reduce((sum: number, item: StyleGuideItem) => sum + item.priceRange.max, 0);
            if (totalMaxPrice > budget * 1.5) {
              console.log(`[style-recommend] Budget exceeded, adjusting price ranges`);
              const scaleFactor = budget / totalMaxPrice;
              parsed.items.forEach((item: StyleGuideItem) => {
                item.priceRange.min = Math.floor(item.priceRange.min * scaleFactor);
                item.priceRange.max = Math.floor(item.priceRange.max * scaleFactor);
              });
            }
            styleGuide = parsed;
          }
        } else {
          console.error('[style-recommend] Gemini API error:', await geminiResponse.text());
        }
      } catch (e) {
        console.error('[style-recommend] Gemini parsing error:', e);
      }
    }

    // Fallback style guide if Gemini fails
    if (!styleGuide) {
      styleGuide = {
        lookName: `${occasion} 추천 룩`,
        items: [
          { category: '상의', searchKeywords: `${gender} ${occasion} 상의`, styleTags: ['캐주얼'], priceRange: { min: 20000, max: budget * 0.3 }, colorSuggestion: '화이트' },
          { category: '하의', searchKeywords: `${gender} ${occasion} 하의`, styleTags: ['캐주얼'], priceRange: { min: 30000, max: budget * 0.4 }, colorSuggestion: '블랙' },
          { category: '신발', searchKeywords: `${gender} ${occasion} 신발`, styleTags: ['캐주얼'], priceRange: { min: 30000, max: budget * 0.3 }, colorSuggestion: '화이트' },
        ],
        stylingTips: '편안하면서도 세련된 스타일을 연출해보세요.'
      };
    }

    // Step 4: Search products_cache ONLY for each category
    const lookItems: LookItem[] = [];

    // Category mapping (Korean <-> English) - comprehensive list
    const categoryMap: Record<string, string[]> = {
      '상의': ['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'Shirts', 'Polo Shirts'],
      '하의': ['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'Trousers'],
      '아우터': ['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'Jackets', 'Coats'],
      '신발': ['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'Trainers', 'Loafers'],
      '가방': ['가방', 'bag', 'bags', 'accessory', '백', '클러치', 'clutch', 'tote', '토트백', 'Holdalls', 'Backpacks'],
      '원피스': ['원피스', 'dress', 'dresses', '드레스'],
      '액세서리': ['액세서리', 'accessory', 'accessories', '스카프', 'scarf', '모자', 'hat', '벨트', 'belt', 'Ties', 'Scarves', 'Hats', 'Gloves'],
    };
    
    const getCategoryVariants = (category: string): string[] => {
      const lowerCat = category.toLowerCase();
      for (const [key, variants] of Object.entries(categoryMap)) {
        if (key === category || variants.some(v => v.toLowerCase() === lowerCat)) {
          return [...new Set([key, ...variants])];
        }
      }
      return [category, category.toLowerCase()];
    };

    for (const item of styleGuide.items) {
      const categoryVariants = getCategoryVariants(item.category);
      console.log(`[style-recommend] Searching for category: ${item.category}, variants: ${categoryVariants.join(', ')}`);
      
      let cachedProducts: CachedProduct[] = [];
      
      // 1. 가격 범위 내에서 검색
      for (const catVariant of categoryVariants) {
        if (cachedProducts.length > 0) break;
        
        let query = supabase
          .from('products_cache')
          .select('*')
          .eq('is_active', true)
          .ilike('category', `%${catVariant}%`)
          .gte('price', item.priceRange.min * 0.5) // 좀 더 유연한 가격 범위
          .lte('price', item.priceRange.max * 1.5)
          .not('image_url', 'is', null);

        // Add gender filter
        const genderKo = gender === '남성' ? 'male' : 'female';
        query = query.or(`gender.eq.${genderKo},gender.is.null`);

        const { data } = await query.limit(20);
        if (data && data.length > 0) {
          cachedProducts = data;
        }
      }

      // 2. 가격 범위 없이 카테고리만으로 검색 (폴백)
      if (cachedProducts.length === 0) {
        for (const catVariant of categoryVariants) {
          if (cachedProducts.length > 0) break;
          
          let query = supabase
            .from('products_cache')
            .select('*')
            .eq('is_active', true)
            .ilike('category', `%${catVariant}%`)
            .not('image_url', 'is', null);

          const genderKo = gender === '남성' ? 'male' : 'female';
          query = query.or(`gender.eq.${genderKo},gender.is.null`);

          const { data } = await query.limit(20);
          if (data && data.length > 0) {
            cachedProducts = data;
          }
        }
      }

      if (cachedProducts.length > 0) {
        // Score and select best match
        const scored = cachedProducts.map(p => ({
          product: p,
          score: calculateMatchScore(p, item)
        })).sort((a, b) => b.score - a.score);

        const best = scored[0].product;
        const affiliateUrl = await generateAffiliateUrl(best, merchants || [], LINKPRICE_AFFILIATE_ID);

        lookItems.push({
          category: item.category,
          product: best,
          affiliateUrl,
          source: 'cache'
        });
        console.log(`[style-recommend] ${item.category}: Found in cache - ${best.name} (₩${best.price})`);
      } else {
        lookItems.push({
          category: item.category,
          product: null,
          affiliateUrl: null,
          source: 'none'
        });
        console.log(`[style-recommend] ${item.category}: Not found in products_cache`);
      }
    }

    // Step 5: Calculate total price and create response
    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const foundItems = lookItems.filter(l => l.product !== null);

    // Step 6: Save to style_cache if we have at least 2 items
    if (foundItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: foundItems.map(l => l.product!.id),
        image_url: foundItems[0].product!.image_url || '',
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
        name: styleGuide.lookName,
        items: lookItems,
        totalPrice,
        stylingTips: styleGuide.stylingTips,
        styleTags: [...new Set(styleGuide.items.flatMap(i => i.styleTags))]
      },
      apiCalls: {
        gemini: geminiCalls,
        serpapi: 0 // No longer using SerpAPI
      },
      stats: {
        requestedItems: styleGuide.items.length,
        foundInCache: foundItems.length,
        notFound: lookItems.filter(l => l.source === 'none').length
      }
    };

    console.log(`[style-recommend] Complete. Stats:`, response.stats);

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
  const occasions = ['데이트', '출근', '비즈니스', '캐주얼', '파티', '여행', '운동', '결혼식'];
  for (const occ of occasions) {
    if (request.includes(occ)) return occ;
  }
  return '캐주얼';
}

function calculateMatchScore(product: CachedProduct, guide: StyleGuideItem): number {
  let score = 0;
  
  // Style tag matching
  if (product.style_tags && guide.styleTags) {
    const matches = product.style_tags.filter(tag => 
      guide.styleTags.some(gt => gt.toLowerCase() === tag.toLowerCase())
    );
    score += matches.length * 20;
  }
  
  // Color matching
  if (product.color && guide.colorSuggestion) {
    if (product.color.toLowerCase().includes(guide.colorSuggestion.toLowerCase()) ||
        guide.colorSuggestion.toLowerCase().includes(product.color.toLowerCase())) {
      score += 15;
    }
  }
  
  // Price preference (closer to mid-range = higher score)
  const midPrice = (guide.priceRange.min + guide.priceRange.max) / 2;
  const priceDiff = Math.abs(product.price - midPrice);
  const priceScore = Math.max(0, 10 - (priceDiff / midPrice) * 10);
  score += priceScore;
  
  // Image availability bonus
  if (product.image_url) score += 10;
  
  // Brand bonus
  if (product.brand) score += 5;
  
  // Small random factor for variety
  score += Math.random() * 5;
  
  return score;
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
          console.log(`[style-recommend] LinkPrice deeplink success for: ${product.name}`);
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
  console.log(`[style-recommend] LinkPrice failed for ${product.name}, trying fallback`);
  
  const merchant = merchants.find(m => product.merchant_id === m.id || 
    product.product_url.includes(m.base_url.replace('https://', '').replace('http://', '')));

  if (merchant?.deeplink_template) {
    const encodedProductUrl = encodeURIComponent(product.product_url);
    const affiliateUrl = merchant.deeplink_template
      .replace('{affiliate_id}', affiliateId)
      .replace('{encoded_url}', encodedProductUrl)
      .replace('{product_url}', encodedProductUrl);
    console.log(`[style-recommend] Using fallback template for ${product.name}`);
    return affiliateUrl;
  }

  // Return original URL if no affiliate link can be generated
  return product.product_url;
}
