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

        return new Response(JSON.stringify({
          success: true,
          cacheHit: true,
          look: cached,
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

    if (LOVABLE_API_KEY) {
      const stylePrompt = `당신은 한국 패션 스타일리스트입니다.
사용자 요청: "${userRequest}"
성별: ${gender}
예산: ${budget}원 (총합)

다음 한국 온라인 쇼핑몰들의 트렌드를 참고하여 코디를 구성해주세요:
${merchantNames.join(', ')}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "lookName": "코디 이름",
  "items": [
    {
      "category": "상의",
      "searchKeywords": "검색 키워드 (예: 여성 화이트 블라우스 캐주얼)",
      "styleTags": ["캐주얼", "로맨틱"],
      "priceRange": { "min": 30000, "max": 80000 },
      "colorSuggestion": "추천 색상"
    }
  ],
  "stylingTips": "스타일링 팁"
}

카테고리는 상의, 하의, 아우터, 신발, 가방 중에서 선택하세요. 최소 3개, 최대 5개 아이템을 추천하세요.`;

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
              { role: 'system', content: 'You are a Korean fashion stylist. Always respond in valid JSON format only.' },
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
            styleGuide = JSON.parse(jsonMatch[0]);
            console.log(`[style-recommend] Gemini style guide:`, JSON.stringify(styleGuide, null, 2));
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
        const affiliateUrl = generateAffiliateUrl(best, merchants || [], LINKPRICE_AFFILIATE_ID);

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
        
        for (const merchant of (merchants || []).slice(0, 3)) {
          if (found) break;
          
          // Use merchant Korean name for better search results (not site: prefix)
          const searchQuery = `${merchant.name_ko} ${item.searchKeywords}`;
          console.log(`[style-recommend] SerpAPI query: "${searchQuery}"`);
          
          try {
            const serpUrl = new URL('https://serpapi.com/search.json');
            serpUrl.searchParams.set('q', searchQuery);
            serpUrl.searchParams.set('engine', 'google_shopping');
            serpUrl.searchParams.set('hl', 'ko');
            serpUrl.searchParams.set('gl', 'kr');
            serpUrl.searchParams.set('api_key', SERPAPI_API_KEY);
            serpUrl.searchParams.set('num', '10');

            const serpResponse = await fetch(serpUrl.toString());
            serpApiCalls++;

            if (serpResponse.ok) {
              const serpData = await serpResponse.json();
              const results = serpData.shopping_results || [];
              console.log(`[style-recommend] SerpAPI returned ${results.length} results for ${item.category}`);

              if (results.length > 0) {
                // Get first valid result with image and price
                const validResult = results.find((r: any) => r.thumbnail && r.title && (r.price || r.extracted_price));
                
                if (validResult) {
                  const productUrl = validResult.link || validResult.product_link || `${merchant.base_url}/search?q=${encodeURIComponent(validResult.title)}`;
                  
                  // Save to products_cache
                  const newProduct: CachedProduct = {
                    id: crypto.randomUUID(),
                    name: validResult.title,
                    brand: extractBrand(validResult.title),
                    price: validResult.extracted_price || parsePrice(validResult.price),
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

                  const affiliateUrl = generateAffiliateUrl(newProduct, merchants || [], LINKPRICE_AFFILIATE_ID);

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

function generateAffiliateUrl(product: CachedProduct, merchants: any[], affiliateId: string): string | null {
  if (!product.product_url) return null;

  const merchant = merchants.find(m => product.merchant_id === m.id || 
    product.product_url.includes(m.base_url.replace('https://', '').replace('http://', '')));

  if (merchant?.deeplink_template) {
    return merchant.deeplink_template
      .replace('{affiliate_id}', affiliateId)
      .replace('{product_url}', encodeURIComponent(product.product_url));
  }

  // Fallback: LinkPrice generic template
  return `https://click.linkprice.com/click.php?m=default&a=${affiliateId}&l=0&lc=1&url=${encodeURIComponent(product.product_url)}`;
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
