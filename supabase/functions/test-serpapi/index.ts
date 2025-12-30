import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SerpAPIProduct {
  title: string;
  thumbnail: string;
  link: string;
  price?: string;
  extracted_price?: number;
  source?: string;
}

interface SerpAPIResponse {
  shopping_results?: SerpAPIProduct[];
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SERPAPI_API_KEY) {
      console.error('SERPAPI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SERPAPI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { query, merchant = 'wconcept', saveToCache = false, filterByMerchantDomain = true } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load registered merchants from DB
    const { data: merchantsData, error: merchantsError } = await supabase
      .from('merchants')
      .select('id, name, name_ko, base_url')
      .eq('is_active', true);

    if (merchantsError) {
      console.error('[SerpAPI] Error loading merchants:', merchantsError);
    }

    // Build merchant domain map from DB
    const registeredDomains: string[] = [];
    const merchantSearchTerms: Record<string, { name: string; domain: string }> = {};
    
    if (merchantsData) {
      for (const m of merchantsData) {
        try {
          const url = new URL(m.base_url);
          const domain = url.hostname.replace('www.', '');
          registeredDomains.push(domain);
          merchantSearchTerms[m.id] = { name: m.name_ko || m.name, domain };
        } catch {
          console.warn(`[SerpAPI] Invalid base_url for merchant ${m.id}: ${m.base_url}`);
        }
      }
    }

    console.log(`[SerpAPI] Registered domains: ${registeredDomains.join(', ')}`);

    const merchantInfo = merchantSearchTerms[merchant] || { name: merchant, domain: '' };
    // Search with Korean brand name for better results in Korean market
    const searchQuery = `${merchantInfo.name} ${query}`;

    console.log(`[SerpAPI] Searching: "${searchQuery}" (filtering for domain: ${merchantInfo.domain})`);
    const startTime = Date.now();

    // Build SerpAPI URL
    const serpApiUrl = new URL('https://serpapi.com/search.json');
    serpApiUrl.searchParams.set('engine', 'google_shopping');
    serpApiUrl.searchParams.set('q', searchQuery);
    serpApiUrl.searchParams.set('location', 'South Korea');
    serpApiUrl.searchParams.set('hl', 'ko');
    serpApiUrl.searchParams.set('gl', 'kr');
    serpApiUrl.searchParams.set('api_key', SERPAPI_API_KEY);

    const response = await fetch(serpApiUrl.toString());
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SerpAPI] API error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SerpAPI error: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: SerpAPIResponse = await response.json();
    console.log(`[SerpAPI] Response received in ${responseTime}ms`);

    if (data.error) {
      console.error(`[SerpAPI] API returned error:`, data.error);
      return new Response(
        JSON.stringify({ success: false, error: data.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract products from shopping_results
    const allProducts = (data.shopping_results || []).map((item) => ({
      title: item.title || 'Unknown',
      thumbnail: item.thumbnail || '',
      link: item.link || '',
      price: item.extracted_price || null,
      priceText: item.price || '',
      source: item.source || merchantInfo.name,
    }));

    console.log(`[SerpAPI] Found ${allProducts.length} total products`);

    // Filter by registered merchant domains if enabled
    let products = allProducts;
    let filteredCount = 0;
    
    if (filterByMerchantDomain && registeredDomains.length > 0) {
      products = allProducts.filter((p) => {
        if (!p.link) return false;
        try {
          const productDomain = new URL(p.link).hostname.replace('www.', '');
          return registeredDomains.some(d => productDomain.includes(d) || d.includes(productDomain));
        } catch {
          return false;
        }
      });
      filteredCount = allProducts.length - products.length;
      console.log(`[SerpAPI] Filtered to ${products.length} products from registered merchants (excluded ${filteredCount})`);
    }

    // Log sample product for debugging
    if (products.length > 0) {
      console.log(`[SerpAPI] Sample product:`, JSON.stringify(products[0]));
    }

    // Save to products_cache if requested
    let savedCount = 0;
    if (saveToCache && products.length > 0) {
      // Filter products with valid thumbnails and prepare for insert
      const productsToSave = products
        .filter((p) => p.thumbnail && p.title !== 'Unknown')
        .slice(0, 20) // Limit to 20 products per search
        .map((p) => {
          // Detect merchant_id from product link
          let detectedMerchantId = merchant;
          if (p.link) {
            try {
              const productDomain = new URL(p.link).hostname.replace('www.', '');
              for (const [mId, mInfo] of Object.entries(merchantSearchTerms)) {
                if (productDomain.includes(mInfo.domain) || mInfo.domain.includes(productDomain)) {
                  detectedMerchantId = mId;
                  break;
                }
              }
            } catch { /* use default */ }
          }

          return {
            name: p.title,
            image_url: p.thumbnail,
            product_url: p.link || `https://www.google.com/search?q=${encodeURIComponent(p.title)}`,
            price: p.price || 0,
            category: detectCategory(query),
            merchant_id: detectedMerchantId,
            brand: extractBrand(p.title, p.source),
            is_active: true,
            is_in_stock: true,
            collected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            style_tags: classifyStyleTags(p.title),
          };
        });

      if (productsToSave.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('products_cache')
          .upsert(productsToSave, { 
            onConflict: 'product_url',
            ignoreDuplicates: false 
          })
          .select();

        if (insertError) {
          console.error(`[SerpAPI] Error saving to cache:`, insertError);
        } else {
          savedCount = insertedData?.length || 0;
          console.log(`[SerpAPI] Saved ${savedCount} products to cache`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: searchQuery,
        merchant,
        domain: merchantInfo.domain,
        totalCount: allProducts.length,
        count: products.length,
        filteredCount,
        savedCount,
        responseTime,
        registeredDomains,
        products,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SerpAPI] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Detect category from query
function detectCategory(query: string): string {
  const categoryMap: Record<string, string[]> = {
    '상의': ['상의', '티셔츠', '셔츠', '블라우스', '니트', '맨투맨', '후드'],
    '하의': ['하의', '바지', '팬츠', '청바지', '슬랙스', '스커트', '치마'],
    '아우터': ['아우터', '자켓', '코트', '점퍼', '패딩', '가디건', '조끼'],
    '원피스': ['원피스', '드레스'],
    '신발': ['신발', '스니커즈', '운동화', '구두', '슬리퍼', '샌들', '부츠'],
    '가방': ['가방', '백', '토트', '숄더', '크로스', '클러치'],
    '악세서리': ['악세서리', '목걸이', '팔찌', '귀걸이', '반지', '시계', '모자', '스카프'],
  };

  const lowerQuery = query.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(kw => lowerQuery.includes(kw))) {
      return category;
    }
  }
  return '기타';
}

// Helper: Extract brand from title or source
function extractBrand(title: string, source: string): string {
  // Common Korean fashion brands
  const brands = ['W컨셉', '무신사', 'H패션', '나이키', '아디다스', '자라', 'H&M', '유니클로', '폴로', '구찌', '샤넬'];
  
  for (const brand of brands) {
    if (title.includes(brand) || source.includes(brand)) {
      return brand;
    }
  }
  
  // Try to extract first word as brand
  const firstWord = title.split(' ')[0];
  if (firstWord && firstWord.length > 1 && firstWord.length < 20) {
    return firstWord;
  }
  
  return source || 'Unknown';
}

// Helper: Classify style tags
function classifyStyleTags(title: string): string[] {
  const tags: string[] = [];
  const lowerTitle = title.toLowerCase();

  const styleKeywords: Record<string, string[]> = {
    '캐주얼': ['캐주얼', '데일리', '베이직'],
    '포멀': ['정장', '포멀', '오피스', '비즈니스'],
    '스트릿': ['스트릿', '힙합', '오버사이즈'],
    '미니멀': ['미니멀', '심플', '모던'],
    '빈티지': ['빈티지', '레트로', '클래식'],
    '스포티': ['스포츠', '스포티', '애슬레저', '운동'],
  };

  for (const [tag, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some(kw => lowerTitle.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ['캐주얼'];
}
