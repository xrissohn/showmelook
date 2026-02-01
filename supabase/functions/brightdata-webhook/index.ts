import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Bright Data에서 보내는 상품 데이터 형식
interface BrightDataProduct {
  url?: string;
  product_url?: string;
  title?: string;
  name?: string;
  product_name?: string;
  price?: number | string;
  original_price?: { value?: number; currency?: string };
  final_price?: { value?: number; currency?: string };
  currency?: string;
  image?: string;
  images?: string[];
  image_urls?: string[];
  main_image?: string;
  brand?: string;
  category?: string;
  description?: string;
  availability?: string;
  in_stock?: boolean;
  seller?: string;
  merchant?: string;
  sku?: string;
  product_id?: string;
  sizes?: string[];
  colors?: string[];
  [key: string]: unknown;
}

// register-product에 전달할 형식
interface ProductInput {
  merchant_id: string;
  product_url: string;
  name: string;
  price: number;
  original_price?: number;
  image_url?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  sizes?: Record<string, unknown>;
  gender?: string;
  color?: string;
  is_in_stock?: boolean;
}

// 머천트 ID 추출
function extractMerchantId(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('wconcept')) return 'wconcept';
  if (urlLower.includes('hfashionmall')) return 'hfashionmall';
  if (urlLower.includes('paulsmith')) return 'paulsmith';
  if (urlLower.includes('ssfshop')) return 'ssfshop';
  if (urlLower.includes('sivillage')) return 'sivillage';
  if (urlLower.includes('29cm')) return '29cm';
  if (urlLower.includes('musinsa')) return 'musinsa';
  if (urlLower.includes('stories')) return 'stories';
  if (urlLower.includes('posty')) return 'posty';
  if (urlLower.includes('lfmall')) return 'lfmall';
  return 'unknown';
}

// 카테고리 추론
function inferCategory(name: string): string {
  const nameLower = name.toLowerCase();
  
  const categoryMap: Record<string, string[]> = {
    '상의': ['티셔츠', 't-shirt', 'tee', '셔츠', 'shirt', '블라우스', 'blouse', '니트', 'knit', '스웨터', 'sweater', '후드', 'hoodie', '맨투맨', '탑', 'top', '가디건', 'cardigan'],
    '하의': ['팬츠', 'pants', '바지', 'trousers', '진', 'jeans', '청바지', '스커트', 'skirt', '치마', '쇼츠', 'shorts', '반바지', '슬랙스', 'slacks'],
    '아우터': ['자켓', 'jacket', '코트', 'coat', '점퍼', 'jumper', '패딩', 'padding', '다운', 'down', '블레이저', 'blazer', '조끼', 'vest', '무스탕', '파카', 'parka'],
    '원피스': ['원피스', 'dress', '드레스'],
    '가방': ['가방', 'bag', '백팩', 'backpack', '토트', 'tote', '숄더백', '클러치', 'clutch', '크로스백'],
    '신발': ['슈즈', 'shoes', '스니커즈', 'sneakers', '부츠', 'boots', '로퍼', 'loafer', '샌들', 'sandal', '힐', 'heel', '플랫', 'flat', '운동화'],
    '액세서리': ['모자', 'hat', 'cap', '벨트', 'belt', '스카프', 'scarf', '장갑', 'gloves', '양말', 'socks', '시계', 'watch', '주얼리', 'jewelry', '목걸이', 'necklace', '귀걸이', 'earring', '반지', 'ring', '팔찌', 'bracelet'],
  };
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      return category;
    }
  }
  
  return '기타';
}

// 가격 파싱
function parsePrice(price: unknown): number {
  if (typeof price === 'number') return Math.round(price);
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^\d.]/g, '');
    return Math.round(parseFloat(cleaned) || 0);
  }
  return 0;
}

// 이미지 URL 추출
function extractImageUrl(product: BrightDataProduct): string | undefined {
  if (product.main_image) return product.main_image;
  if (product.image) return product.image;
  if (product.images && product.images.length > 0) return product.images[0];
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return undefined;
}

// 상품 데이터 변환 (register-product 형식으로)
function transformProduct(product: BrightDataProduct): ProductInput | null {
  const url = product.url || product.product_url;
  if (!url) {
    console.log('Skipping product without URL:', JSON.stringify(product).slice(0, 200));
    return null;
  }
  
  const name = product.title || product.name || product.product_name || '';
  if (!name) {
    console.log('Skipping product without name:', url);
    return null;
  }
  
  let price = parsePrice(product.price);
  if (price <= 0 && product.final_price?.value) {
    price = Math.round(product.final_price.value);
  }
  if (price <= 0 && product.original_price?.value) {
    price = Math.round(product.original_price.value);
  }
  if (price <= 0) {
    console.log('Skipping product with invalid price:', name);
    return null;
  }
  
  const merchantId = extractMerchantId(url);
  const category = product.category || inferCategory(name);
  
  // 재고 상태 확인
  let isInStock = true;
  if (product.availability) {
    const avail = product.availability.toLowerCase();
    isInStock = !avail.includes('out') && !avail.includes('품절') && !avail.includes('sold');
  }
  if (product.in_stock !== undefined) {
    isInStock = product.in_stock;
  }
  
  // 원가 추출
  let originalPrice: number | undefined;
  if (product.original_price?.value) {
    originalPrice = Math.round(product.original_price.value);
  }
  
  // 카테고리 분리
  let mainCategory = category;
  let subCategory: string | undefined;
  if (category.includes('>')) {
    const parts = category.split('>').map(s => s.trim());
    mainCategory = parts[0];
    subCategory = parts[1];
  }
  
  // 성별, 색상, 사이즈
  const gender = product.gender as string | undefined;
  let color: string | undefined;
  if (product.colors && product.colors.length > 0) {
    color = product.colors[0];
  }
  let sizes: Record<string, unknown> | undefined;
  if (product.sizes && product.sizes.length > 0) {
    sizes = { available: product.sizes };
  }
  
  return {
    merchant_id: merchantId,
    product_url: url,
    name: name.slice(0, 500),
    price,
    original_price: originalPrice,
    image_url: extractImageUrl(product),
    category: mainCategory,
    sub_category: subCategory,
    brand: product.brand,
    sizes,
    gender,
    color,
    is_in_stock: isInStock,
  };
}

// NDJSON 파싱
function parseNDJSON(text: string): BrightDataProduct[] {
  const lines = text.trim().split('\n');
  const products: BrightDataProduct[] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        products.push(JSON.parse(line));
      } catch (e) {
        console.error('Failed to parse NDJSON line:', line.slice(0, 100));
      }
    }
  }
  
  return products;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== Bright Data Webhook Received ===');
  console.log('Method:', req.method);
  console.log('Content-Type:', req.headers.get('content-type'));

  try {
    // 인증 확인 with timestamp validation
    const webhookSecret = Deno.env.get('BRIGHTDATA_WEBHOOK_SECRET');
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
      const providedTimestamp = req.headers.get('x-webhook-timestamp');
      
      // Timestamp validation (prevent replay attacks - 5 minute tolerance)
      if (providedTimestamp) {
        const requestTime = parseInt(providedTimestamp);
        const currentTime = Math.floor(Date.now() / 1000);
        const tolerance = 300; // 5 minutes
        
        if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > tolerance) {
          console.error('Webhook timestamp out of tolerance');
          return new Response(JSON.stringify({ error: 'Request timestamp expired or invalid' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      if (providedSecret !== webhookSecret) {
        console.error('Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Supabase 클라이언트
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청 본문 파싱
    const contentType = req.headers.get('content-type') || '';
    const rawBody = await req.text();
    
    console.log('Body length:', rawBody.length);
    console.log('Body preview:', rawBody.slice(0, 500));

    let products: BrightDataProduct[] = [];

    if (contentType.includes('application/x-ndjson') || contentType.includes('ndjson')) {
      products = parseNDJSON(rawBody);
      console.log('Parsed as NDJSON:', products.length, 'products');
    } else {
      try {
        const parsed = JSON.parse(rawBody);
        if (Array.isArray(parsed)) {
          products = parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          products = parsed.data;
        } else if (parsed.results && Array.isArray(parsed.results)) {
          products = parsed.results;
        } else {
          products = [parsed];
        }
        console.log('Parsed as JSON:', products.length, 'products');
      } catch (e) {
        products = parseNDJSON(rawBody);
        console.log('Fallback to NDJSON:', products.length, 'products');
      }
    }

    if (products.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No products to process',
        received: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 상품 변환
    const transformedProducts: ProductInput[] = [];
    let skipped = 0;

    for (const product of products) {
      const transformed = transformProduct(product);
      if (transformed) {
        transformedProducts.push(transformed);
      } else {
        skipped++;
      }
    }

    console.log('Transformed:', transformedProducts.length, 'Skipped:', skipped);

    if (transformedProducts.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No valid products after transformation',
        received: products.length,
        skipped 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // register-product Edge Function 호출 (배치 처리)
    const BATCH_SIZE = 10;
    let successCount = 0;
    let failedCount = 0;
    const failedProducts: Array<{ product: ProductInput; error: string }> = [];

    for (let i = 0; i < transformedProducts.length; i += BATCH_SIZE) {
      const batch = transformedProducts.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transformedProducts.length / BATCH_SIZE)}`);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/register-product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ products: batch }),
        });

        const result = await response.json();

        if (result.success && result.results) {
          for (const r of result.results) {
            if (r.success) {
              successCount++;
            } else {
              failedCount++;
              const originalProduct = batch.find(p => p.product_url === r.product_url);
              if (originalProduct) {
                failedProducts.push({
                  product: originalProduct,
                  error: r.error || 'Unknown error',
                });
              }
            }
          }
        } else {
          // 전체 배치 실패
          for (const product of batch) {
            failedCount++;
            failedProducts.push({
              product,
              error: result.error || 'Batch failed',
            });
          }
        }
      } catch (error) {
        console.error('Batch call error:', error);
        for (const product of batch) {
          failedCount++;
          failedProducts.push({
            product,
            error: error instanceof Error ? error.message : 'Network error',
          });
        }
      }

      // 배치 간 딜레이 (rate limit 방지)
      if (i + BATCH_SIZE < transformedProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 실패한 제품들을 pending_products에 저장
    if (failedProducts.length > 0) {
      console.log(`Saving ${failedProducts.length} failed products to pending_products`);
      
      const pendingRecords = failedProducts.map(fp => ({
        source: 'brightdata',
        raw_data: fp.product,
        error_type: fp.error.includes('image') ? 'image_failed' : 
                    fp.error.includes('dna') ? 'dna_failed' : 'both_failed',
        error_message: fp.error,
      }));

      const { error: pendingError } = await supabase
        .from('pending_products')
        .insert(pendingRecords);

      if (pendingError) {
        console.error('Failed to save pending products:', pendingError);
      }
    }

    const result = {
      success: true,
      received: products.length,
      transformed: transformedProducts.length,
      skipped,
      registered: successCount,
      failed: failedCount,
      pendingSaved: failedProducts.length,
      timestamp: new Date().toISOString(),
    };

    console.log('Webhook result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
