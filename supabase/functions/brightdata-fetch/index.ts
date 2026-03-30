import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrightDataSnapshot {
  id: string;
  status: string;
  created_at: string;
  records_count?: number;
}

interface BrightDataProduct {
  url?: string;
  product_url?: string;
  title?: string;
  name?: string;
  product_name?: string;
  price?: number | string;
  original_price?: { value?: number; currency?: string };
  final_price?: { value?: number; currency?: string };
  image?: string;
  images?: string[];
  image_urls?: string[];
  main_image?: string;
  brand?: string;
  category?: string;
  availability?: string;
  in_stock?: boolean;
  sizes?: string[];
  colors?: string[];
  [key: string]: unknown;
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
  if (urlLower.includes('arket')) return 'arket';
  if (urlLower.includes('jestina')) return 'jestina';
  if (urlLower.includes('benetton')) return 'benetton';
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

// 상품 데이터 변환
function transformProduct(product: BrightDataProduct) {
  const url = product.url || product.product_url;
  if (!url) return null;
  
  const name = product.title || product.name || product.product_name || '';
  if (!name) return null;
  
  let price = parsePrice(product.price);
  if (price <= 0 && product.final_price?.value) {
    price = Math.round(product.final_price.value);
  }
  if (price <= 0 && product.original_price?.value) {
    price = Math.round(product.original_price.value);
  }
  if (price <= 0) return null;
  
  const merchantId = extractMerchantId(url);
  const category = product.category?.split('>')[0]?.trim() || inferCategory(name);
  
  let isInStock = true;
  if (product.availability) {
    const avail = product.availability.toLowerCase();
    isInStock = !avail.includes('out') && !avail.includes('품절') && !avail.includes('sold');
  }
  if (product.in_stock !== undefined) {
    isInStock = product.in_stock;
  }
  
  let originalPrice: number | undefined;
  if (product.original_price?.value) {
    originalPrice = Math.round(product.original_price.value);
  }
  
  let sizes: Record<string, unknown> | undefined;
  if (product.sizes && product.sizes.length > 0) {
    sizes = { available: product.sizes };
  }
  
  let color: string | undefined;
  if (product.colors && product.colors.length > 0) {
    color = product.colors[0];
  }
  
  return {
    merchant_id: merchantId,
    product_url: url,
    name: name.slice(0, 500),
    price,
    original_price: originalPrice,
    image_url: extractImageUrl(product),
    category,
    sub_category: product.category?.split('>')[1]?.trim(),
    brand: product.brand,
    sizes,
    color,
    is_in_stock: isInStock,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
    if (!apiKey) {
      throw new Error('BRIGHTDATA_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, dataset_id, snapshot_id, limit } = await req.json();

    // 0. 데이터셋 목록 조회
    if (action === 'dataset_list') {
      console.log('Fetching dataset list from Bright Data');

      // Try multiple endpoints
      const endpoints = [
        'https://api.brightdata.com/datasets/list',
        'https://api.brightdata.com/dca/datasets/list',
      ];

      let allDatasets: Array<{ id: string; name: string; size?: number }> = [];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              allDatasets = data;
              console.log(`Got ${data.length} datasets from ${endpoint}`);
              break;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch from ${endpoint}:`, e);
        }
      }

      // Also try views endpoint
      try {
        const viewsResponse = await fetch('https://api.brightdata.com/datasets/views', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (viewsResponse.ok) {
          const views = await viewsResponse.json();
          if (Array.isArray(views) && views.length > 0) {
            console.log(`Got ${views.length} views`);
            allDatasets = [...allDatasets, ...views.map((v: Record<string, unknown>) => ({
              id: (v.id || v.view_id || '') as string,
              name: `[View] ${v.name || v.id || 'unnamed'}`,
              size: (v.size || 0) as number,
            }))];
          }
        }
      } catch (e) {
        console.error('Failed to fetch views:', e);
      }

      return new Response(JSON.stringify({
        success: true,
        datasets: allDatasets,
        total: allDatasets.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. 스냅샷 목록 조회
    if (action === 'list_snapshots') {
      console.log(`Fetching snapshots for dataset: ${dataset_id}`);
      
      // API v3: dataset_id는 쿼리 파라미터로 전달
      const url = `https://api.brightdata.com/datasets/v3/snapshots?dataset_id=${encodeURIComponent(dataset_id)}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response body:', responseText.slice(0, 500));

      if (!response.ok) {
        console.error('Bright Data API error:', response.status, responseText);
        throw new Error(`Bright Data API error: ${response.status} - ${responseText}`);
      }

      let snapshots;
      try {
        snapshots = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Invalid JSON response from Bright Data');
      }
      
      console.log(`Found ${Array.isArray(snapshots) ? snapshots.length : 0} snapshots`);
      console.log('Snapshots:', JSON.stringify(snapshots).slice(0, 500));

      return new Response(JSON.stringify({ 
        success: true, 
        snapshots: Array.isArray(snapshots) ? snapshots : [snapshots],
        raw_response: responseText.slice(0, 1000) // 디버깅용
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. 스냅샷 데이터 가져오기
    if (action === 'fetch_snapshot') {
      if (!snapshot_id) {
        throw new Error('snapshot_id is required');
      }

      console.log(`Fetching snapshot data: ${snapshot_id}`);

      // API v3: snapshot_id로 직접 다운로드 (단수형 snapshot)
      const response = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshot_id)}?format=ndjson`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bright Data download error:', response.status, errorText);
        throw new Error(`Download error: ${response.status} - ${errorText}`);
      }

      const text = await response.text();
      const lines = text.trim().split('\n');
      console.log(`Downloaded ${lines.length} products from snapshot`);

      // 상품 변환 및 등록
      const products: BrightDataProduct[] = [];
      for (const line of lines) {
        if (line.trim()) {
          try {
            products.push(JSON.parse(line));
          } catch (e) {
            console.error('Failed to parse line:', line.slice(0, 100));
          }
        }
      }

      // limit 적용
      const maxProducts = limit || 100;
      const productsToProcess = products.slice(0, maxProducts);
      
      console.log(`Processing ${productsToProcess.length} products (limit: ${maxProducts})`);

      // register-product 호출
      const BATCH_SIZE = 10;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
        const batch = productsToProcess.slice(i, i + BATCH_SIZE);
        const transformedBatch = batch
          .map(p => transformProduct(p))
          .filter((p): p is NonNullable<typeof p> => p !== null);

        skippedCount += batch.length - transformedBatch.length;

        if (transformedBatch.length === 0) continue;

        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(productsToProcess.length / BATCH_SIZE)}`);

        try {
          const registerResponse = await fetch(`${supabaseUrl}/functions/v1/register-product`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ products: transformedBatch }),
          });

          const result = await registerResponse.json();

          if (result.success && result.results) {
            for (const r of result.results) {
              if (r.success) {
                successCount++;
              } else {
                failedCount++;
              }
            }
          } else {
            failedCount += transformedBatch.length;
          }
        } catch (error) {
          console.error('Batch registration error:', error);
          failedCount += transformedBatch.length;
        }

        // Rate limit 방지
        if (i + BATCH_SIZE < productsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        total_in_snapshot: products.length,
        processed: productsToProcess.length,
        registered: successCount,
        failed: failedCount,
        skipped: skippedCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. 전체 데이터셋 통계
    if (action === 'dataset_info') {
      const response = await fetch(
        `https://api.brightdata.com/datasets/v3/${dataset_id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const info = await response.json();

      return new Response(JSON.stringify({ success: true, info }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
