import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Merchant {
  id: string;
  name: string;
  base_url: string;
  scrape_config: { categories?: string[] };
}

interface ProductData {
  name: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  category: string;
  sizes: string[] | null;
  is_in_stock: boolean;
  color: string | null;
}

interface BatchResult {
  merchant_id: string;
  merchant_name: string;
  urls_tried: number;
  success_count: number;
  saved_count: number;
  errors: string[];
}

// Sample product URLs per merchant for testing
const SAMPLE_URLS: Record<string, string[]> = {
  wconcept: [
    'https://www.wconcept.co.kr/Product/302123456',
    'https://www.wconcept.co.kr/Product/302234567',
  ],
  hfashion: [
    'https://www.hfashionmall.com/display/dpGoods?goodsNumber=AM0123456',
    'https://www.hfashionmall.com/display/dpGoods?goodsNumber=AM0234567',
  ],
  posty: [
    'https://www.posty.kr/product/detail/1234567',
    'https://www.posty.kr/product/detail/2345678',
  ],
  jestina: [
    'https://www.jestina.co.kr/products/1234567',
    'https://www.jestina.co.kr/products/2345678',
  ],
  paulsmith: [
    'https://www.paulsmith.co.kr/products/1234567',
    'https://www.paulsmith.co.kr/products/2345678',
  ],
  arket: [
    'https://www.arket.com/ko-kr/products/1234567',
    'https://www.arket.com/ko-kr/products/2345678',
  ],
  stories: [
    'https://www.stories.com/ko-kr/products/1234567',
    'https://www.stories.com/ko-kr/products/2345678',
  ],
  benetton1: [
    'https://www.benettonmall.co.kr/product/1234567',
    'https://www.benettonmall.co.kr/product/2345678',
  ],
};

// Proxy configuration
const PROXY_HOST = Deno.env.get('BRIGHTDATA_PROXY_HOST');
const PROXY_USER = Deno.env.get('BRIGHTDATA_PROXY_USER');
const PROXY_PASS = Deno.env.get('BRIGHTDATA_PROXY_PASS');

async function scrapeWithProxy(url: string): Promise<{ html: string | null; error: string | null }> {
  // Method 1: Direct fetch (simplest approach)
  try {
    console.log(`Attempting direct fetch for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      if (html.length > 5000) {
        console.log(`Direct fetch successful: ${html.length} chars`);
        return { html, error: null };
      }
    }
    console.log(`Direct fetch returned: ${response.status}`);
  } catch (e) {
    console.log(`Direct fetch failed: ${e}`);
  }

  // Method 2: Bright Data Web Unlocker API
  const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
  if (apiKey) {
    try {
      console.log(`Attempting Bright Data API for: ${url}`);
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          zone: 'web_unlocker',
          url: url,
          format: 'raw',
          country: 'kr',
        }),
      });
      
      if (response.ok) {
        const html = await response.text();
        if (html.length > 1000) {
          console.log(`Bright Data API successful: ${html.length} chars`);
          return { html, error: null };
        }
      }
      console.log(`Bright Data API returned: ${response.status}`);
    } catch (e) {
      console.log(`Bright Data API failed: ${e}`);
    }
  }

  return { html: null, error: 'All scraping methods failed' };
}

function identifyMerchant(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('wconcept')) return 'wconcept';
  if (urlLower.includes('hfashionmall')) return 'hfashion';
  if (urlLower.includes('posty')) return 'posty';
  if (urlLower.includes('jestina')) return 'jestina';
  if (urlLower.includes('paulsmith')) return 'paulsmith';
  if (urlLower.includes('arket.com')) return 'arket';
  if (urlLower.includes('stories.com')) return 'stories';
  if (urlLower.includes('benettonmall')) return 'benetton1';
  return 'unknown';
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('재킷') || n.includes('jacket') || n.includes('자켓')) return 'outer';
  if (n.includes('코트') || n.includes('coat')) return 'outer';
  if (n.includes('패딩') || n.includes('puffer') || n.includes('다운')) return 'outer';
  if (n.includes('점퍼') || n.includes('jumper')) return 'outer';
  if (n.includes('셔츠') || n.includes('shirt') || n.includes('블라우스')) return 'top';
  if (n.includes('니트') || n.includes('sweater') || n.includes('스웨터')) return 'top';
  if (n.includes('티셔츠') || n.includes('t-shirt') || n.includes('tee')) return 'top';
  if (n.includes('맨투맨') || n.includes('sweatshirt') || n.includes('후드')) return 'top';
  if (n.includes('원피스') || n.includes('dress')) return 'dress';
  if (n.includes('팬츠') || n.includes('pants') || n.includes('바지') || n.includes('진')) return 'bottom';
  if (n.includes('스커트') || n.includes('skirt') || n.includes('치마')) return 'bottom';
  if (n.includes('슈즈') || n.includes('shoes') || n.includes('운동화') || n.includes('부츠')) return 'shoes';
  if (n.includes('백') || n.includes('bag') || n.includes('가방') || n.includes('토트')) return 'bag';
  if (n.includes('목걸이') || n.includes('necklace') || n.includes('귀걸이') || n.includes('earring') || n.includes('반지') || n.includes('ring')) return 'accessory';
  return 'top';
}

function extractColor(name: string): string | null {
  const colors: Record<string, string[]> = {
    'black': ['블랙', 'black', '검정'],
    'white': ['화이트', 'white', '흰색', '아이보리', 'ivory'],
    'beige': ['베이지', 'beige', '크림'],
    'gray': ['그레이', 'gray', 'grey', '회색'],
    'navy': ['네이비', 'navy'],
    'blue': ['블루', 'blue', '파란'],
    'red': ['레드', 'red', '빨강'],
    'pink': ['핑크', 'pink'],
    'brown': ['브라운', 'brown', '갈색'],
    'green': ['그린', 'green', '카키', 'khaki'],
  };
  const n = name.toLowerCase();
  for (const [color, keywords] of Object.entries(colors)) {
    if (keywords.some(k => n.includes(k))) return color;
  }
  return null;
}

function parseGenericProduct(html: string, url: string): ProductData | null {
  try {
    // Try JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd['@type'] === 'Product' || jsonLd.name) {
          const price = jsonLd.offers?.price || jsonLd.offers?.[0]?.price || 0;
          return {
            name: jsonLd.name || '',
            brand: jsonLd.brand?.name || jsonLd.brand || null,
            price: parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
            original_price: null,
            image_url: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image || null,
            category: inferCategory(jsonLd.name || ''),
            sizes: null,
            is_in_stock: jsonLd.offers?.availability !== 'OutOfStock',
            color: extractColor(jsonLd.name || ''),
          };
        }
      } catch (e) {
        console.log('JSON-LD parsing failed');
      }
    }

    // Try __NEXT_DATA__
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const product = nextData?.props?.pageProps?.product || 
                        nextData?.props?.pageProps?.goods ||
                        nextData?.props?.pageProps?.initialData?.product;
        if (product) {
          return {
            name: product.name || product.goodsName || product.title || '',
            brand: product.brandName || product.brand?.name || null,
            price: product.salePrice || product.price || product.finalPrice || 0,
            original_price: product.originPrice || product.normalPrice || null,
            image_url: product.imageUrl || product.thumbnailImageUrl || null,
            category: inferCategory(product.name || product.goodsName || ''),
            sizes: product.options?.map((o: any) => o.name) || null,
            is_in_stock: product.isSoldOut !== true,
            color: extractColor(product.name || product.goodsName || ''),
          };
        }
      } catch (e) {
        console.log('NEXT_DATA parsing failed');
      }
    }

    // Fallback to meta tags
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) || html.match(/₩\s*([\d,]+)/);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: null,
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.toLowerCase().includes('품절') && !html.toLowerCase().includes('sold out'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Generic parsing error:', error);
    return null;
  }
}

function extractExternalId(url: string): string | null {
  // Various URL patterns
  const patterns = [
    /\/Product\/(\d+)/i,
    /\/products?\/(\d+)/i,
    /\/goods\/(\d+)/i,
    /goodsNumber=([A-Z0-9]+)/i,
    /\/detail\/(\d+)/i,
    /\/p\/([a-zA-Z0-9]+)/i,
    /\/(\d{6,})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { merchantIds, urlsPerMerchant = 5, customUrls } = body;

    // Get merchants to process
    let merchantsQuery = supabase.from('merchants').select('*').eq('is_active', true);
    if (merchantIds && merchantIds.length > 0) {
      merchantsQuery = merchantsQuery.in('id', merchantIds);
    }
    
    const { data: merchants, error: merchantError } = await merchantsQuery;
    if (merchantError) throw merchantError;

    console.log(`Starting batch collection for ${merchants?.length || 0} merchants`);

    const results: BatchResult[] = [];
    let totalSaved = 0;

    for (const merchant of merchants || []) {
      const result: BatchResult = {
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        urls_tried: 0,
        success_count: 0,
        saved_count: 0,
        errors: [],
      };

      // Get URLs to scrape
      let urlsToScrape: string[] = [];
      
      if (customUrls && customUrls[merchant.id]) {
        urlsToScrape = customUrls[merchant.id].slice(0, urlsPerMerchant);
      } else if (SAMPLE_URLS[merchant.id]) {
        urlsToScrape = SAMPLE_URLS[merchant.id].slice(0, urlsPerMerchant);
      }

      console.log(`Processing ${merchant.name}: ${urlsToScrape.length} URLs`);
      result.urls_tried = urlsToScrape.length;

      for (const url of urlsToScrape) {
        try {
          const { html, error } = await scrapeWithProxy(url);
          
          if (error || !html) {
            result.errors.push(`${url}: ${error || 'Empty HTML'}`);
            continue;
          }

          const productData = parseGenericProduct(html, url);
          if (!productData || !productData.name || !productData.price) {
            result.errors.push(`${url}: Failed to parse product data`);
            continue;
          }

          result.success_count++;

          // Save to database
          const externalId = extractExternalId(url);
          const { error: upsertError } = await supabase
            .from('products_cache')
            .upsert({
              merchant_id: merchant.id,
              external_id: externalId,
              product_url: url,
              name: productData.name,
              brand: productData.brand,
              price: productData.price,
              original_price: productData.original_price,
              image_url: productData.image_url,
              category: productData.category,
              sizes: productData.sizes,
              is_in_stock: productData.is_in_stock,
              color: productData.color,
              style_tags: [],
              gender: null,
              is_active: true,
              collected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'product_url',
            });

          if (upsertError) {
            result.errors.push(`${url}: DB error - ${upsertError.message}`);
          } else {
            result.saved_count++;
            totalSaved++;
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          result.errors.push(`${url}: ${e}`);
        }
      }

      // Update merchant last_collected_at
      if (result.saved_count > 0) {
        await supabase
          .from('merchants')
          .update({ last_collected_at: new Date().toISOString() })
          .eq('id', merchant.id);
      }

      results.push(result);
      console.log(`${merchant.name}: ${result.success_count}/${result.urls_tried} scraped, ${result.saved_count} saved`);
    }

    return new Response(JSON.stringify({
      success: true,
      merchants_processed: results.length,
      total_saved: totalSaved,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Batch collect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
