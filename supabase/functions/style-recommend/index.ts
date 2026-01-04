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
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'serpapi' | 'none';
}

// Generate cache key from request parameters (handles Unicode)
function generateCacheKey(gender: string, style: string, occasion: string, budget: number): string {
  const normalized = `${gender}|${style}|${occasion}|${Math.floor(budget / 50000) * 50000}`;
  // Use simple hash for Unicode-safe cache key
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
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
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    const LINKPRICE_AFFILIATE_ID = Deno.env.get('LINKPRICE_AFFILIATE_ID') || 'A100915488';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract style/occasion from user request for cache key
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
        // Update use count
        await supabase
          .from('style_cache')
          .update({ use_count: (cached.use_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('id', cached.id);

        // Fetch product details for cached product_ids
        let items: LookItem[] = [];
        if (cached.product_ids && cached.product_ids.length > 0) {
          const { data: cachedProducts } = await supabase
            .from('products_cache')
            .select('*')
            .in('id', cached.product_ids);

          if (cachedProducts) {
            items = await Promise.all(cachedProducts.map(async (product: CachedProduct) => ({
              category: product.category,
              product: product,
              affiliateUrl: await generateAffiliateUrl(product, [], LINKPRICE_AFFILIATE_ID),
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

    const merchantDomains = merchants?.map(m => m.base_url.replace('https://', '').replace('http://', '').replace('www.', '')) || [];
    const merchantNames = merchants?.map(m => m.name_ko) || [];

    // Step 3: Gemini Style Director
    let geminiCalls = 0;
    let serpApiCalls = 0;
    let styleGuide: GeminiStyleResponse | null = null;

    // Calculate per-item budget (total / expected items, with buffer)
    const expectedItems = 4;
    const maxItemBudget = Math.floor(budget / expectedItems * 1.2); // 20% buffer per item
    
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
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as GeminiStyleResponse;
            console.log(`[style-recommend] Gemini style guide:`, JSON.stringify(parsed, null, 2));
            
            // Validate budget constraint
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

    // Step 4: Search products_cache for each category
    const lookItems: LookItem[] = [];
    const missingCategories: StyleGuideItem[] = [];

    for (const item of styleGuide.items) {
      // Search in cache
      let query = supabase
        .from('products_cache')
        .select('*')
        .eq('is_active', true)
        .eq('category', item.category)
        .gte('price', item.priceRange.min)
        .lte('price', item.priceRange.max)
        .not('image_url', 'is', null);

      // Add gender filter if available
      if (gender) {
        query = query.or(`gender.eq.${gender},gender.is.null`);
      }

      const { data: cachedProducts } = await query.limit(10);

      if (cachedProducts && cachedProducts.length > 0) {
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
        console.log(`[style-recommend] ${item.category}: Found in cache - ${best.name}`);
      } else {
        missingCategories.push(item);
        lookItems.push({
          category: item.category,
          product: null,
          affiliateUrl: null,
          source: 'none'
        });
      }
    }

    // Step 5: SerpAPI for missing categories (if available)
    if (SERPAPI_API_KEY && missingCategories.length > 0) {
      console.log(`[style-recommend] Searching SerpAPI for ${missingCategories.length} missing categories`);

      for (const item of missingCategories) {
        // Try multiple merchants until we find a product
        let found = false;
        
        // Get category-specific keyword for better search accuracy
        const categoryKeyword = (item as any).categoryKeyword || getCategoryKeyword(item.category);
        
        for (const merchant of (merchants || []).slice(0, 3)) {
          if (found) break;
          
          // Build precise search query with category keyword
          const searchQuery = `${merchant.name_ko} ${gender} ${categoryKeyword} ${item.colorSuggestion || ''}`.trim();
          console.log(`[style-recommend] SerpAPI query: "${searchQuery}" for category: ${item.category}`);
          
          try {
            const serpUrl = new URL('https://serpapi.com/search.json');
            serpUrl.searchParams.set('q', searchQuery);
            serpUrl.searchParams.set('engine', 'google_shopping');
            serpUrl.searchParams.set('hl', 'ko');
            serpUrl.searchParams.set('gl', 'kr');
            serpUrl.searchParams.set('api_key', SERPAPI_API_KEY);
            serpUrl.searchParams.set('num', '20'); // Get more results for better filtering
            // Add price filter
            if (item.priceRange.max > 0) {
              serpUrl.searchParams.set('price_max', String(item.priceRange.max));
            }

            const serpResponse = await fetch(serpUrl.toString());
            serpApiCalls++;

            if (serpResponse.ok) {
              const serpData = await serpResponse.json();
              const results = serpData.shopping_results || [];
              console.log(`[style-recommend] SerpAPI returned ${results.length} results for ${item.category}`);

              if (results.length > 0) {
                // Find a valid result that matches the category
                const validResult = results.find((r: any) => {
                  if (!r.thumbnail || !r.title || !(r.price || r.extracted_price)) return false;
                  
                  const title = r.title.toLowerCase();
                  const price = r.extracted_price || parsePrice(r.price);
                  
                  // Check price is within budget
                  if (price > item.priceRange.max * 1.2) return false;
                  
                  // Validate category matches (prevent watch showing up for pants, etc.)
                  return validateCategoryMatch(title, item.category, categoryKeyword);
                });
                
                if (validResult) {
                  const productUrl = validResult.link || validResult.product_link || `${merchant.base_url}/search?q=${encodeURIComponent(validResult.title)}`;
                  const price = validResult.extracted_price || parsePrice(validResult.price);
                  
                  // Save to products_cache
                  const newProduct: CachedProduct = {
                    id: crypto.randomUUID(),
                    name: validResult.title,
                    brand: extractBrand(validResult.title),
                    price: price,
                    image_url: validResult.thumbnail,
                    product_url: productUrl,
                    category: item.category,
                    style_tags: item.styleTags,
                    merchant_id: merchant.id
                  };

                  console.log(`[style-recommend] Found product: ${newProduct.name} at ₩${newProduct.price}`);

                  // Insert to cache (ignore conflict)
                  try {
                    await supabase.from('products_cache').insert({
                      ...newProduct,
                      gender,
                      is_active: true,
                      is_in_stock: true,
                      collected_at: new Date().toISOString()
                    });
                  } catch (insertErr) {
                    console.log(`[style-recommend] Product already in cache or insert error`);
                  }

                  const affiliateUrl = await generateAffiliateUrl(newProduct, merchants || [], LINKPRICE_AFFILIATE_ID);

                  // Update lookItems
                  const idx = lookItems.findIndex(l => l.category === item.category);
                  if (idx !== -1) {
                    lookItems[idx] = {
                      category: item.category,
                      product: newProduct,
                      affiliateUrl,
                      source: 'serpapi'
                    };
                  }

                  console.log(`[style-recommend] ${item.category}: Found via SerpAPI - ${newProduct.name}`);
                  found = true;
                }
              }
            } else {
              const errText = await serpResponse.text();
              console.error(`[style-recommend] SerpAPI error: ${serpResponse.status} - ${errText}`);
            }
          } catch (e) {
            console.error(`[style-recommend] SerpAPI error for ${item.category}:`, e);
          }
        }
        
        if (!found) {
          console.log(`[style-recommend] No product found for ${item.category} after trying all merchants`);
        }
      }
    }

    // Step 6: Calculate total price and create response
    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const foundItems = lookItems.filter(l => l.product !== null);

    // Step 7: Save to style_cache if we have at least 2 items
    if (foundItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: foundItems.map(l => l.product!.id),
        image_url: foundItems[0].product!.image_url || '',
        use_count: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
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
        serpapi: serpApiCalls
      },
      stats: {
        requestedItems: styleGuide.items.length,
        foundInCache: lookItems.filter(l => l.source === 'cache').length,
        foundViaSerpapi: lookItems.filter(l => l.source === 'serpapi').length,
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
    const matches = product.style_tags.filter(t => guide.styleTags.includes(t)).length;
    score += matches * 20;
  }

  // Image availability bonus
  if (product.image_url) score += 30;

  // Price in sweet spot (middle of range)
  const midPrice = (guide.priceRange.min + guide.priceRange.max) / 2;
  const priceDiff = Math.abs(product.price - midPrice) / midPrice;
  score += Math.max(0, 20 - priceDiff * 40);

  // Random factor for variety
  score += Math.random() * 10;

  return score;
}

async function generateAffiliateUrl(product: CachedProduct, merchants: any[], affiliateId: string): Promise<string | null> {
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
  const merchant = merchants.find(m => product.merchant_id === m.id || 
    product.product_url.includes(m.base_url.replace('https://', '').replace('http://', '')));

  if (merchant?.deeplink_template) {
    return merchant.deeplink_template
      .replace('{affiliate_id}', affiliateId)
      .replace('{product_url}', encodeURIComponent(product.product_url));
  }

  // Final fallback: Return original URL (not affiliate, but at least works)
  console.log(`[style-recommend] No affiliate URL available, using original URL`);
  return product.product_url;
}

function extractBrand(title: string): string | null {
  const brands = ['나이키', 'Nike', '아디다스', 'Adidas', '자라', 'ZARA', 'H&M', '유니클로', 'UNIQLO'];
  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  
  // Extract first word as potential brand
  const firstWord = title.split(/[\s\[\]]/)[0];
  if (firstWord && firstWord.length > 1 && firstWord.length < 20) {
    return firstWord;
  }
  
  return null;
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const numStr = priceStr.replace(/[^0-9]/g, '');
  return parseInt(numStr) || 0;
}

// Get category-specific keyword for search
function getCategoryKeyword(category: string): string {
  const keywords: Record<string, string> = {
    '상의': '블라우스 셔츠 티셔츠 니트',
    '하의': '팬츠 청바지 스커트 바지',
    '아우터': '자켓 코트 점퍼 가디건',
    '신발': '구두 스니커즈 부츠 힐',
    '가방': '백 가방 토트백 숄더백'
  };
  return keywords[category] || category;
}

// Validate that search result matches the intended category
function validateCategoryMatch(title: string, category: string, categoryKeyword: string): boolean {
  // Exclusion list - items that should NOT appear in certain categories
  const exclusions: Record<string, string[]> = {
    '상의': ['바지', '팬츠', '스커트', '신발', '구두', '스니커즈', '가방', '백', '시계', '목걸이', '팔찌', '귀걸이', '반지'],
    '하의': ['셔츠', '블라우스', '니트', '티셔츠', '신발', '구두', '스니커즈', '가방', '백', '시계', '목걸이', '귀걸이', '자켓', '코트'],
    '아우터': ['바지', '팬츠', '스커트', '신발', '구두', '스니커즈', '가방', '백', '시계', '목걸이', '귀걸이'],
    '신발': ['바지', '팬츠', '셔츠', '블라우스', '가방', '백', '시계', '목걸이', '귀걸이', '자켓', '코트'],
    '가방': ['바지', '팬츠', '셔츠', '블라우스', '신발', '구두', '스니커즈', '시계', '목걸이', '귀걸이', '자켓', '코트']
  };
  
  // Check for exclusions
  const excluded = exclusions[category] || [];
  for (const word of excluded) {
    if (title.includes(word)) {
      return false;
    }
  }
  
  // Inclusion list - at least one keyword should match
  const inclusions: Record<string, string[]> = {
    '상의': ['셔츠', '블라우스', '티셔츠', '니트', '탑', '상의', '맨투맨', '스웨터', '후드', '가디건'],
    '하의': ['바지', '팬츠', '청바지', '스커트', '하의', '데님', '슬랙스', '진', '레깅스'],
    '아우터': ['자켓', '코트', '점퍼', '가디건', '아우터', '재킷', '패딩', '무스탕', '트렌치'],
    '신발': ['신발', '구두', '스니커즈', '부츠', '힐', '샌들', '로퍼', '플랫', '슬리퍼', '운동화'],
    '가방': ['가방', '백', '토트', '숄더', '크로스', '클러치', '파우치', '핸드백']
  };
  
  const included = inclusions[category] || [];
  for (const word of included) {
    if (title.includes(word)) {
      return true;
    }
  }
  
  // Also check categoryKeyword from Gemini
  if (categoryKeyword && title.includes(categoryKeyword)) {
    return true;
  }
  
  return false;
}
