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
}

interface RAGStyleResponse {
  lookName: string;
  styleConcept: string;
  styleReasoning: string;
  selectedProductIds: string[];
  stylingTips: string;
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

    // Step 1: Check style_cache (skip for now to always use RAG)
    // TODO: Implement smarter caching later

    // Step 2: Get merchants list
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    // Step 3: RAG - First, fetch ALL relevant products from products_cache
    console.log(`[style-recommend] Step 1: Fetching products from DB for RAG context...`);
    
    const categories = ['상의', '하의', '아우터', '신발', '가방', '원피스', '액세서리'];
    const allProducts: CachedProduct[] = [];
    
    for (const category of categories) {
      let query = supabase
        .from('products_cache')
        .select('*')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .not('image_url', 'is', null)
        .lte('price', budget * 0.6); // 각 아이템이 예산의 60% 이하
      
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
      
      const { data } = await query.order('collected_at', { ascending: false }).limit(15);
      
      if (data && data.length > 0) {
        allProducts.push(...data);
      }
    }
    
    // Remove duplicates
    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());
    console.log(`[style-recommend] Found ${uniqueProducts.length} products for RAG context`);

    if (uniqueProducts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '추천할 수 있는 상품이 없습니다. 상품 데이터가 수집되면 다시 시도해주세요.',
        look: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Create product context for AI (RAG)
    const productContext = uniqueProducts.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      sub_category: p.sub_category,
      color: p.color,
      style_tags: p.style_tags,
    }));

    console.log(`[style-recommend] Step 2: Sending ${productContext.length} products to AI for selection...`);

    // Step 5: RAG - Ask AI to select products AND generate description
    let ragResponse: RAGStyleResponse | null = null;
    let geminiCalls = 0;
    
    if (LOVABLE_API_KEY) {
      const systemPrompt = `너는 최고의 패션 스타일리스트야. 
고객의 요청에 맞는 코디를 제공된 상품 목록에서만 선택해야 해.

중요 규칙:
1. 반드시 제공된 상품 목록의 ID 중에서만 선택해
2. 상의, 하의(또는 원피스), 신발을 기본으로 포함하고, 예산에 따라 가방이나 아우터 추가
3. 선택한 상품들의 가격 합계가 총 예산을 넘지 않아야 해
4. styleConcept은 선택한 실제 상품들을 기반으로 작성해야 해 (상품명, 브랜드, 특징 언급)
5. styleReasoning은 왜 이 상품들이 요청에 적합한지 설명해
6. 반드시 유효한 JSON만 응답해`;

      const userPrompt = `사용자 요청: "${userRequest}"
성별: ${gender}
총 예산: ${budget}원

아래는 현재 구매 가능한 상품 목록이야. 이 중에서만 선택해서 코디를 구성해줘:

${JSON.stringify(productContext, null, 2)}

다음 JSON 형식으로만 응답해:
{
  "lookName": "코디 이름 (예: 봄 데이트를 위한 로맨틱 룩)",
  "styleConcept": "🎨 [성별] [요청] - [스타일 포인트]\n선택한 상품들을 기반으로 한 구체적인 스타일 설명. 실제 상품명과 브랜드를 언급하며 왜 이 조합이 좋은지 설명. 2-3문장.",
  "styleReasoning": "이 코디가 사용자 요청에 적합한 이유와 스타일링 팁. 선택한 각 아이템이 어떻게 조화를 이루는지 설명.",
  "selectedProductIds": ["product-id-1", "product-id-2", "product-id-3"],
  "stylingTips": "추가 스타일링 팁이나 액세서리 제안"
}

선택한 상품 가격의 합이 ${budget}원을 넘지 않도록 해.
반드시 selectedProductIds에는 위 목록에 있는 실제 id만 포함해야 해.`;

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

    // Fallback if AI fails
    if (!ragResponse) {
      console.log(`[style-recommend] AI failed, using fallback selection`);
      
      // Simple fallback: pick one from each category within budget
      const selectedIds: string[] = [];
      let remainingBudget = budget;
      const categoryOrder = ['상의', '하의', '신발', '가방', '아우터'];
      
      for (const cat of categoryOrder) {
        const catProducts = uniqueProducts.filter(p => 
          p.category.toLowerCase().includes(cat.toLowerCase()) &&
          p.price <= remainingBudget
        );
        
        if (catProducts.length > 0) {
          const selected = catProducts[0];
          selectedIds.push(selected.id);
          remainingBudget -= selected.price;
        }
        
        if (selectedIds.length >= 4) break;
      }
      
      ragResponse = {
        lookName: `${occasion} 추천 룩`,
        styleConcept: `🎨 ${gender} ${occasion} 스타일\n예산에 맞춘 기본 코디 추천입니다.`,
        styleReasoning: '각 카테고리에서 예산에 맞는 아이템을 선택했습니다.',
        selectedProductIds: selectedIds,
        stylingTips: '자신만의 스타일로 연출해보세요.'
      };
    }

    // Step 6: Get selected products
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    const lookItems: LookItem[] = [];
    
    if (selectedProducts) {
      for (const product of selectedProducts) {
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        lookItems.push({
          category: product.category,
          product: product,
          affiliateUrl,
          source: 'cache'
        });
      }
    }

    // Step 7: Calculate total price and create response
    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);

    // Step 8: Save to style_cache if we have items
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
        stylingTips: ragResponse.stylingTips,
      },
      apiCalls: {
        gemini: geminiCalls,
        serpapi: 0
      },
      stats: {
        productsInContext: uniqueProducts.length,
        selectedProducts: lookItems.length,
      }
    };

    console.log(`[style-recommend] RAG Complete. Selected ${lookItems.length} products, Total: ₩${totalPrice}`);

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

// Category mapping
const categoryMap: Record<string, string[]> = {
  '상의': ['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'Shirts', 'Polo Shirts'],
  '하의': ['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'Trousers'],
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
