import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrightDataProduct {
  url: string;
  title?: string;
  name?: string;
  brand?: string;
  price?: number | string;
  final_price?: number | string;
  currency?: string;
  image?: string;
  image_url?: string;
  images?: string[];
  category?: string;
  categories?: string[];
  availability?: string;
  in_stock?: boolean;
  description?: string;
  color?: string;
  size?: string;
  sizes?: string[];
  gender?: string;
}

interface ProductForDB {
  merchant_id: string;
  product_url: string;
  external_id: string | null;
  name: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  category: string;
  sub_category: string | null;
  sizes: any | null;
  is_in_stock: boolean;
  style_tags: string[] | null;
  gender: string | null;
  color: string | null;
}

// Bright Data API를 사용한 스크래핑
async function scrapeWithBrightData(urls: string[]): Promise<BrightDataProduct[]> {
  const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
  
  if (!apiKey) {
    console.error('[BrightData] API key not configured');
    throw new Error('BRIGHTDATA_API_KEY not configured');
  }

  console.log(`[BrightData] Scraping ${urls.length} URLs...`);

  try {
    // 동기 방식으로 스크래핑 (최대 20개 URL)
    const response = await fetch(
      'https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_l7q7dkf244hwjntr0&format=json',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(urls.map(url => ({ url }))),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BrightData] HTTP error: ${response.status} - ${errorText}`);
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[BrightData] Received ${Array.isArray(data) ? data.length : 0} products`);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[BrightData] Scrape error:', error);
    throw error;
  }
}

// 가격 파싱 (문자열에서 숫자로)
function parsePrice(price: any): number {
  if (typeof price === 'number') return Math.round(price);
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.]/g, '');
    return Math.round(parseFloat(cleaned) || 0);
  }
  return 0;
}

// 이미지 URL 추출
function extractImageUrl(product: BrightDataProduct): string | null {
  if (product.image_url) return product.image_url;
  if (product.image) return product.image;
  if (product.images && product.images.length > 0) return product.images[0];
  return null;
}

// 카테고리 추출
function extractCategory(product: BrightDataProduct): string {
  if (product.category) return product.category;
  if (product.categories && product.categories.length > 0) return product.categories[0];
  
  // 상품명에서 카테고리 추론
  const name = (product.title || product.name || '').toLowerCase();
  if (name.includes('jacket') || name.includes('자켓') || name.includes('코트')) return 'outer';
  if (name.includes('shirt') || name.includes('셔츠') || name.includes('블라우스')) return 'top';
  if (name.includes('pants') || name.includes('팬츠') || name.includes('바지')) return 'bottom';
  if (name.includes('dress') || name.includes('드레스') || name.includes('원피스')) return 'dress';
  if (name.includes('skirt') || name.includes('스커트')) return 'bottom';
  if (name.includes('shoe') || name.includes('신발') || name.includes('스니커즈')) return 'shoes';
  if (name.includes('bag') || name.includes('가방') || name.includes('백')) return 'bag';
  
  return 'other';
}

// 스타일 태그 분류
function classifyStyleTags(name: string, category: string): string[] {
  const tags: string[] = [];
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('캐주얼') || nameLower.includes('casual')) tags.push('casual');
  if (nameLower.includes('클래식') || nameLower.includes('classic')) tags.push('classic');
  if (nameLower.includes('미니멀') || nameLower.includes('minimal')) tags.push('minimal');
  if (nameLower.includes('스트릿') || nameLower.includes('street')) tags.push('street');
  if (nameLower.includes('스포티') || nameLower.includes('sporty')) tags.push('sporty');
  if (nameLower.includes('럭셔리') || nameLower.includes('luxury')) tags.push('luxury');
  if (nameLower.includes('빈티지') || nameLower.includes('vintage')) tags.push('vintage');
  
  return tags.length > 0 ? tags : ['casual'];
}

// Merchant ID 추출 (URL에서)
function extractMerchantId(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('wconcept')) return 'wconcept';
  if (urlLower.includes('posty')) return 'posty';
  if (urlLower.includes('29cm')) return '29cm';
  if (urlLower.includes('musinsa')) return 'musinsa';
  if (urlLower.includes('hfashion')) return 'hfashion';
  if (urlLower.includes('stories')) return 'stories';
  if (urlLower.includes('paulsmith')) return 'paulsmith';
  if (urlLower.includes('jestina')) return 'jestina';
  if (urlLower.includes('arket')) return 'arket';
  if (urlLower.includes('benetton')) return 'benetton1';
  return 'unknown';
}

// External ID 추출 (URL에서)
function extractExternalId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    // 마지막 숫자 패턴 찾기
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(pathParts[i])) {
        return pathParts[i];
      }
    }
    return pathParts[pathParts.length - 1] || null;
  } catch {
    return null;
  }
}

// BrightData 응답을 DB 형식으로 변환
function transformToDBProduct(product: BrightDataProduct): ProductForDB | null {
  const name = product.title || product.name;
  if (!name || !product.url) {
    console.log('[Transform] Skipping product without name or URL');
    return null;
  }

  const price = parsePrice(product.final_price || product.price);
  if (price === 0) {
    console.log(`[Transform] Skipping product with zero price: ${name}`);
    return null;
  }

  const imageUrl = extractImageUrl(product);
  const category = extractCategory(product);
  const merchantId = extractMerchantId(product.url);

  return {
    merchant_id: merchantId,
    product_url: product.url,
    external_id: extractExternalId(product.url),
    name: name,
    brand: product.brand || null,
    price: price,
    original_price: product.price ? parsePrice(product.price) : null,
    image_url: imageUrl,
    category: category,
    sub_category: null,
    sizes: product.sizes ? { available: product.sizes } : (product.size ? { available: [product.size] } : null),
    is_in_stock: product.in_stock !== false && product.availability !== 'out_of_stock',
    style_tags: classifyStyleTags(name, category),
    gender: product.gender || null,
    color: product.color || null,
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { urls, mode = 'scrape' } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 최대 20개 URL 제한 (Bright Data 동기 방식 제한)
    const targetUrls = urls.slice(0, 20);
    console.log(`[BrightData Collect] Processing ${targetUrls.length} URLs`);

    // Bright Data로 스크래핑
    const scrapedProducts = await scrapeWithBrightData(targetUrls);
    console.log(`[BrightData Collect] Scraped ${scrapedProducts.length} products`);

    // DB 형식으로 변환
    const dbProducts: ProductForDB[] = [];
    for (const product of scrapedProducts) {
      const transformed = transformToDBProduct(product);
      if (transformed) {
        dbProducts.push(transformed);
      }
    }

    console.log(`[BrightData Collect] Transformed ${dbProducts.length} valid products`);

    if (mode === 'preview') {
      // 미리보기 모드: DB에 저장하지 않고 결과만 반환
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'preview',
          total_urls: targetUrls.length,
          scraped: scrapedProducts.length,
          valid: dbProducts.length,
          products: dbProducts,
          raw_sample: scrapedProducts.slice(0, 2),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DB에 저장
    let inserted = 0;
    let errors = 0;

    for (const product of dbProducts) {
      try {
        const { error } = await supabase
          .from('products_cache')
          .upsert({
            ...product,
            collected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
          }, {
            onConflict: 'product_url',
          });

        if (error) {
          console.error('[Upsert] Error:', error);
          errors++;
        } else {
          inserted++;
        }
      } catch (e) {
        console.error('[Upsert] Exception:', e);
        errors++;
      }
    }

    console.log(`[BrightData Collect] Inserted: ${inserted}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'save',
        total_urls: targetUrls.length,
        scraped: scrapedProducts.length,
        valid: dbProducts.length,
        inserted: inserted,
        errors: errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BrightData Collect] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
