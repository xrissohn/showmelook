import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Bright Data에서 보내는 상품 데이터 형식
interface BrightDataProduct {
  url?: string;
  title?: string;
  name?: string;
  price?: number | string;
  currency?: string;
  image?: string;
  images?: string[];
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
  [key: string]: unknown;
}

// DB 저장용 형식
interface ProductForDB {
  external_id: string;
  merchant_id: string;
  product_url: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  category: string;
  style_tags: string[];
  is_available: boolean;
  raw_data: Record<string, unknown>;
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

// External ID 추출
function extractExternalId(url: string, product: BrightDataProduct): string {
  // 상품에서 직접 ID 추출
  if (product.sku) return product.sku;
  if (product.product_id) return product.product_id;
  
  // URL에서 ID 추출 시도
  const patterns = [
    /\/products?\/(\d+)/i,
    /\/goods\/(\d+)/i,
    /\/item\/(\d+)/i,
    /[?&](?:product_?id|goods_?no|item_?id)=(\w+)/i,
    /\/(\d{6,})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // 최후의 수단: URL 해시
  return btoa(url).slice(0, 20);
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

// 스타일 태그 추출
function extractStyleTags(name: string, category: string): string[] {
  const tags: string[] = [];
  const nameLower = name.toLowerCase();
  
  const styleKeywords: Record<string, string[]> = {
    '캐주얼': ['캐주얼', 'casual', '데일리', 'daily', '베이직', 'basic'],
    '미니멀': ['미니멀', 'minimal', '심플', 'simple', '모던', 'modern'],
    '스트릿': ['스트릿', 'street', '오버핏', 'overfit', '빅사이즈'],
    '클래식': ['클래식', 'classic', '포멀', 'formal', '정장', '오피스', 'office'],
    '스포티': ['스포티', 'sporty', '애슬레저', 'athleisure', '운동', 'sport'],
    '빈티지': ['빈티지', 'vintage', '레트로', 'retro'],
    '페미닌': ['페미닌', 'feminine', '러블리', 'lovely', '플라워', 'flower'],
  };
  
  for (const [style, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      tags.push(style);
    }
  }
  
  // 카테고리 태그 추가
  if (category !== '기타') {
    tags.push(category);
  }
  
  return tags.length > 0 ? tags : ['일반'];
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
function extractImageUrl(product: BrightDataProduct): string | null {
  if (product.main_image) return product.main_image;
  if (product.image) return product.image;
  if (product.images && product.images.length > 0) return product.images[0];
  return null;
}

// 상품 데이터 변환
function transformProduct(product: BrightDataProduct): ProductForDB | null {
  const url = product.url;
  if (!url) {
    console.log('Skipping product without URL');
    return null;
  }
  
  const name = product.title || product.name || '';
  if (!name) {
    console.log('Skipping product without name:', url);
    return null;
  }
  
  const price = parsePrice(product.price);
  if (price <= 0) {
    console.log('Skipping product with invalid price:', name);
    return null;
  }
  
  const merchantId = extractMerchantId(url);
  const externalId = extractExternalId(url, product);
  const category = product.category || inferCategory(name);
  const styleTags = extractStyleTags(name, category);
  
  // 재고 상태 확인
  let isAvailable = true;
  if (product.availability) {
    const avail = product.availability.toLowerCase();
    isAvailable = !avail.includes('out') && !avail.includes('품절') && !avail.includes('sold');
  }
  if (product.in_stock !== undefined) {
    isAvailable = product.in_stock;
  }
  
  return {
    external_id: externalId,
    merchant_id: merchantId,
    product_url: url,
    name: name.slice(0, 500),
    price,
    currency: product.currency || 'KRW',
    image_url: extractImageUrl(product),
    category,
    style_tags: styleTags,
    is_available: isAvailable,
    raw_data: product as Record<string, unknown>,
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
    // 인증 확인 (선택적 - Bright Data에서 설정한 경우)
    const webhookSecret = Deno.env.get('BRIGHTDATA_WEBHOOK_SECRET');
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
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
      // NDJSON 형식
      products = parseNDJSON(rawBody);
      console.log('Parsed as NDJSON:', products.length, 'products');
    } else {
      // JSON 형식 (배열 또는 단일 객체)
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
        // JSON 파싱 실패 시 NDJSON 시도
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
    const transformedProducts: ProductForDB[] = [];
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

    // DB에 Upsert (중복 제외)
    const { data, error } = await supabase
      .from('products_cache')
      .upsert(
        transformedProducts.map(p => ({
          ...p,
          updated_at: new Date().toISOString(),
        })),
        { 
          onConflict: 'external_id,merchant_id',
          ignoreDuplicates: false  // 기존 데이터 업데이트
        }
      )
      .select('id, external_id, name');

    if (error) {
      console.error('DB upsert error:', error);
      return new Response(JSON.stringify({ 
        error: 'Database error', 
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = {
      success: true,
      received: products.length,
      processed: transformedProducts.length,
      skipped,
      saved: data?.length || 0,
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
