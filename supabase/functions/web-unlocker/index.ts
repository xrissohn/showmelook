import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Merchant-specific parsers for extracting product data from HTML
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

// W Concept parser
function parseWConcept(html: string, url: string): ProductData | null {
  try {
    // Extract product name
    const nameMatch = html.match(/<h1[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                      html.match(/<title>([^<]+)<\/title>/i);
    
    // Extract price
    const priceMatch = html.match(/data-price="(\d+)"/i) ||
                       html.match(/"price":\s*(\d+)/i) ||
                       html.match(/₩\s*([\d,]+)/);
    
    // Extract original price
    const originalPriceMatch = html.match(/data-original-price="(\d+)"/i) ||
                               html.match(/"originalPrice":\s*(\d+)/i);
    
    // Extract brand
    const brandMatch = html.match(/<span[^>]*class="[^"]*brand[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/"brand":\s*"([^"]+)"/i) ||
                       html.match(/data-brand="([^"]+)"/i);
    
    // Extract image
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
                       html.match(/"image":\s*"([^"]+)"/i) ||
                       html.match(/<img[^>]*class="[^"]*product-image[^"]*"[^>]*src="([^"]+)"/i);
    
    // Extract sizes from options
    const sizesMatch = html.match(/data-size="([^"]+)"/gi) ||
                       html.match(/"sizes?":\s*\[([^\]]+)\]/i);
    
    let sizes: string[] | null = null;
    if (sizesMatch) {
      if (typeof sizesMatch === 'object' && Array.isArray(sizesMatch)) {
        sizes = sizesMatch.map(s => s.replace(/data-size="|"/gi, ''));
      }
    }
    
    // Check stock status
    const outOfStock = html.includes('품절') || html.includes('sold-out') || html.includes('soldout');
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: brandMatch ? brandMatch[1].trim() : null,
      price,
      original_price: originalPriceMatch ? parseInt(originalPriceMatch[1]) : null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes,
      is_in_stock: !outOfStock,
      color: extractColor(name),
    };
  } catch (error) {
    console.error('W Concept parsing error:', error);
    return null;
  }
}

// Musinsa parser
function parseMusinsa(html: string, url: string): ProductData | null {
  try {
    // Extract from __NEXT_DATA__ if available
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const product = nextData?.props?.pageProps?.product || nextData?.props?.pageProps?.goods;
        
        if (product) {
          return {
            name: product.goodsName || product.name || '',
            brand: product.brandName || product.brand?.name || null,
            price: product.salePrice || product.price || 0,
            original_price: product.normalPrice || product.originPrice || null,
            image_url: product.thumbnailImageUrl || product.imageUrl || null,
            category: product.category?.name || inferCategory(product.goodsName || ''),
            sizes: product.options?.map((o: any) => o.name || o.value) || null,
            is_in_stock: product.isSoldOut !== true,
            color: product.color || extractColor(product.goodsName || ''),
          };
        }
      } catch (e) {
        console.log('NEXT_DATA parsing failed, falling back to regex');
      }
    }
    
    // Fallback to regex parsing
    const nameMatch = html.match(/<span[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    const priceMatch = html.match(/"salePrice":\s*(\d+)/i) ||
                       html.match(/class="[^"]*price[^"]*"[^>]*>[\s\S]*?([\d,]+)원/i);
    
    const brandMatch = html.match(/<a[^>]*class="[^"]*brand[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                       html.match(/"brandName":\s*"([^"]+)"/i);
    
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim() : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: brandMatch ? brandMatch[1].trim() : null,
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Musinsa parsing error:', error);
    return null;
  }
}

// 29CM parser
function parse29CM(html: string, url: string): ProductData | null {
  try {
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const product = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
        
        if (product) {
          return {
            name: product.itemName || product.name || '',
            brand: product.brandName || product.frontBrandName || null,
            price: product.salePrice || product.price || 0,
            original_price: product.consumerPrice || null,
            image_url: product.imageUrl || product.thumbnailUrl || null,
            category: inferCategory(product.itemName || ''),
            sizes: null,
            is_in_stock: product.isSoldOut !== true,
            color: extractColor(product.itemName || ''),
          };
        }
      } catch (e) {
        console.log('29CM NEXT_DATA parsing failed');
      }
    }
    
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const priceMatch = html.match(/"salePrice":\s*(\d+)/i);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim() : null;
    const price = priceMatch ? parseInt(priceMatch[1]) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: null,
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: true,
      color: extractColor(name),
    };
  } catch (error) {
    console.error('29CM parsing error:', error);
    return null;
  }
}

// Generic parser for other sites
function parseGeneric(html: string, url: string): ProductData | null {
  try {
    // Try to extract from common meta tags and structured data
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                      html.match(/<meta[^>]*name="title"[^>]*content="([^"]+)"/i) ||
                      html.match(/<title>([^<]+)<\/title>/i);
    
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/price[^>]*>[\s]*[₩$]?\s*([\d,]+)/i) ||
                       html.match(/([\d,]+)\s*원/);
    
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const brandMatch = html.match(/"brand":\s*(?:{[^}]*"name":\s*"([^"]+)"|"([^"]+)")/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: brandMatch ? (brandMatch[1] || brandMatch[2]) : null,
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.toLowerCase().includes('sold out') && !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Generic parsing error:', error);
    return null;
  }
}

// Infer category from product name
function inferCategory(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (/코트|jacket|자켓|점퍼|패딩|블레이저|가디건|후드|바람막이|아우터/i.test(lowerName)) return 'outer';
  if (/셔츠|티셔츠|블라우스|니트|스웨터|탑|맨투맨|shirt|top|sweater/i.test(lowerName)) return 'top';
  if (/바지|팬츠|진|데님|슬랙스|레깅스|쇼츠|pants|jeans|shorts/i.test(lowerName)) return 'bottom';
  if (/스커트|치마|skirt/i.test(lowerName)) return 'skirt';
  if (/원피스|dress/i.test(lowerName)) return 'dress';
  if (/신발|스니커즈|부츠|샌들|로퍼|슬리퍼|shoes|sneakers|boots/i.test(lowerName)) return 'shoes';
  if (/가방|백|토트|크로스|클러치|bag|backpack/i.test(lowerName)) return 'bag';
  if (/시계|watch/i.test(lowerName)) return 'watch';
  if (/모자|캡|비니|hat|cap/i.test(lowerName)) return 'hat';
  if (/목걸이|반지|귀걸이|팔찌|necklace|ring|earring|bracelet|jewelry/i.test(lowerName)) return 'accessory';
  
  return 'etc';
}

// Extract color from product name
function extractColor(name: string): string | null {
  const colors = ['블랙', '화이트', '그레이', '네이비', '베이지', '브라운', '카키', '레드', '블루', '그린', '핑크', '퍼플', '오렌지', '옐로우', 'black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown', 'khaki', 'red', 'blue', 'green', 'pink', 'purple', 'orange', 'yellow'];
  
  for (const color of colors) {
    if (name.toLowerCase().includes(color.toLowerCase())) {
      return color;
    }
  }
  return null;
}

// Identify merchant from URL
function identifyMerchant(url: string): string {
  if (url.includes('wconcept.co.kr')) return 'wconcept';
  if (url.includes('musinsa.com')) return 'musinsa';
  if (url.includes('29cm.co.kr')) return '29cm';
  if (url.includes('lfmall.co.kr')) return 'lfmall';
  if (url.includes('hm.com')) return 'hm';
  if (url.includes('zara.com')) return 'zara';
  if (url.includes('uniqlo.com')) return 'uniqlo';
  if (url.includes('arket.com')) return 'arket';
  return 'unknown';
}

// Extract external ID from URL
function extractExternalId(url: string): string | null {
  // W Concept: /product/123456
  const wconceptMatch = url.match(/\/product\/(\d+)/i) || url.match(/productNo=(\d+)/i);
  if (wconceptMatch) return wconceptMatch[1];
  
  // Musinsa: /goods/123456
  const musinsaMatch = url.match(/\/goods\/(\d+)/i) || url.match(/goodsNo=(\d+)/i);
  if (musinsaMatch) return musinsaMatch[1];
  
  // 29CM: /products/123456
  const cm29Match = url.match(/\/products\/(\d+)/i);
  if (cm29Match) return cm29Match[1];
  
  // Generic ID extraction
  const genericMatch = url.match(/[\/=](\d{5,})/);
  if (genericMatch) return genericMatch[1];
  
  return null;
}

// Main scraping function using Bright Data Web Unlocker
async function scrapeWithWebUnlocker(url: string, apiKey: string): Promise<{ html: string | null; error: string | null }> {
  try {
    console.log(`Scraping URL with Web Unlocker: ${url}`);
    
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        zone: 'linkprice_web_unlocker',
        url: url,
        format: 'raw',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Web Unlocker API error: ${response.status} - ${errorText}`);
      return { html: null, error: `API error: ${response.status}` };
    }
    
    const html = await response.text();
    console.log(`Received HTML length: ${html.length} characters`);
    
    return { html, error: null };
  } catch (error) {
    console.error('Web Unlocker fetch error:', error);
    return { html: null, error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
    if (!apiKey) {
      throw new Error('BRIGHTDATA_API_KEY not configured');
    }
    
    const { urls, mode = 'preview' } = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls array is required');
    }
    
    console.log(`Processing ${urls.length} URLs in ${mode} mode`);
    
    const results: any[] = [];
    const errors: any[] = [];
    
    for (const url of urls) {
      console.log(`\n=== Processing: ${url} ===`);
      
      const { html, error } = await scrapeWithWebUnlocker(url, apiKey);
      
      if (error || !html) {
        errors.push({ url, error: error || 'No HTML returned' });
        continue;
      }
      
      // Identify merchant and parse accordingly
      const merchant = identifyMerchant(url);
      console.log(`Identified merchant: ${merchant}`);
      
      let productData: ProductData | null = null;
      
      switch (merchant) {
        case 'wconcept':
          productData = parseWConcept(html, url);
          break;
        case 'musinsa':
          productData = parseMusinsa(html, url);
          break;
        case '29cm':
          productData = parse29CM(html, url);
          break;
        default:
          productData = parseGeneric(html, url);
      }
      
      if (productData) {
        const result = {
          ...productData,
          merchant_id: merchant,
          external_id: extractExternalId(url),
          product_url: url,
          html_length: html.length,
        };
        results.push(result);
        console.log(`Successfully parsed: ${productData.name}`);
      } else {
        errors.push({ url, error: 'Failed to parse product data', html_sample: html.substring(0, 500) });
      }
    }
    
    // If mode is 'save', save to products_cache table
    if (mode === 'save' && results.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const productsToInsert = results.map(r => ({
        name: r.name,
        brand: r.brand,
        price: r.price,
        original_price: r.original_price,
        image_url: r.image_url,
        category: r.category,
        sizes: r.sizes ? JSON.stringify(r.sizes) : null,
        is_in_stock: r.is_in_stock,
        color: r.color,
        merchant_id: r.merchant_id,
        external_id: r.external_id,
        product_url: r.product_url,
        collected_at: new Date().toISOString(),
        is_active: true,
      }));
      
      const { data, error: dbError } = await supabase
        .from('products_cache')
        .upsert(productsToInsert, { 
          onConflict: 'product_url',
          ignoreDuplicates: false 
        })
        .select();
      
      if (dbError) {
        console.error('Database error:', dbError);
        return new Response(
          JSON.stringify({
            success: false,
            error: dbError.message,
            results,
            errors,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'save',
          saved_count: data?.length || 0,
          results,
          errors,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'preview',
        total_urls: urls.length,
        success_count: results.length,
        error_count: errors.length,
        results,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
