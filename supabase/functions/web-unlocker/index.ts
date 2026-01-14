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

// H Fashion Mall parser
function parseHFashion(html: string, url: string): ProductData | null {
  try {
    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd['@type'] === 'Product' || jsonLd.name) {
          return {
            name: jsonLd.name || '',
            brand: jsonLd.brand?.name || jsonLd.brand || null,
            price: parseInt(String(jsonLd.offers?.price || jsonLd.price || 0).replace(/,/g, '')),
            original_price: null,
            image_url: jsonLd.image?.[0] || jsonLd.image || null,
            category: inferCategory(jsonLd.name || ''),
            sizes: null,
            is_in_stock: jsonLd.offers?.availability !== 'OutOfStock',
            color: extractColor(jsonLd.name || ''),
          };
        }
      } catch (e) {
        console.log('H Fashion JSON-LD parsing failed');
      }
    }
    
    // Fallback to regex - look for specific H Fashion patterns
    const nameMatch = html.match(/<h1[^>]*class="[^"]*goods-name[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/goodsNm\s*[=:]\s*["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    const priceMatch = html.match(/salePrice\s*[=:]\s*["']?([\d,]+)["']?/i) ||
                       html.match(/goodsPrice\s*[=:]\s*["']?([\d,]+)["']?/i) ||
                       html.match(/"price":\s*"?([\d,]+)"?/i);
    
    const imageMatch = html.match(/goodsImg\s*[=:]\s*["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const brandMatch = html.match(/brandNm\s*[=:]\s*["']([^"']+)["']/i) ||
                       html.match(/"brand":\s*"([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
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
    console.error('H Fashion parsing error:', error);
    return null;
  }
}

// Posty parser (Zigzag/Kakao Style based)
function parsePosty(html: string, url: string): ProductData | null {
  try {
    // Posty uses NEXT_DATA like Zigzag
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const product = nextData?.props?.pageProps?.product || 
                        nextData?.props?.pageProps?.initialData?.product ||
                        nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data;
        
        if (product) {
          return {
            name: product.name || product.title || '',
            brand: product.brandName || product.brand?.name || product.shopName || null,
            price: product.salePrice || product.price || product.finalPrice || 0,
            original_price: product.originPrice || product.originalPrice || null,
            image_url: product.imageUrl || product.thumbnailUrl || product.mainImage || null,
            category: inferCategory(product.name || product.title || ''),
            sizes: product.options?.map((o: any) => o.name) || null,
            is_in_stock: product.isSoldOut !== true,
            color: extractColor(product.name || ''),
          };
        }
      } catch (e) {
        console.log('Posty NEXT_DATA parsing failed:', e);
      }
    }
    
    // Fallback to meta tags
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/"salePrice":\s*(\d+)/i);
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
      is_in_stock: !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Posty parsing error:', error);
    return null;
  }
}

// J.ESTINA parser (jewelry brand)
function parseJestina(html: string, url: string): ProductData | null {
  try {
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                      html.match(/<h3[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)<\/h3>/i);
    
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/class="[^"]*price[^"]*"[^>]*>[\s\S]*?([\d,]+)/i);
    
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: 'J.ESTINA',
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: 'accessory',
      sizes: null,
      is_in_stock: !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('J.ESTINA parsing error:', error);
    return null;
  }
}

// ARKET parser (H&M group - uses JSON-LD)
function parseArket(html: string, url: string): ProductData | null {
  try {
    // Try JSON-LD first (H&M group sites use this)
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if (jsonLd['@type'] === 'Product') {
          return {
            name: jsonLd.name || '',
            brand: 'ARKET',
            price: parseInt(String(jsonLd.offers?.price || jsonLd.offers?.[0]?.price || 0).replace(/,/g, '')),
            original_price: null,
            image_url: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image || null,
            category: inferCategory(jsonLd.name || ''),
            sizes: null,
            is_in_stock: jsonLd.offers?.availability !== 'OutOfStock',
            color: extractColor(jsonLd.name || jsonLd.color || ''),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fallback: look for product data in window object
    const productDataMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i) ||
                             html.match(/productData\s*[=:]\s*({[\s\S]*?});/i);
    if (productDataMatch) {
      try {
        const data = JSON.parse(productDataMatch[1]);
        const product = data.product || data;
        if (product.name) {
          return {
            name: product.name,
            brand: 'ARKET',
            price: product.price || product.salePrice || 0,
            original_price: product.originalPrice || null,
            image_url: product.image || product.imageUrl || null,
            category: inferCategory(product.name),
            sizes: null,
            is_in_stock: true,
            color: extractColor(product.name),
          };
        }
      } catch (e) {
        console.log('ARKET preloaded state parsing failed');
      }
    }
    
    // Last fallback: meta tags
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/₩\s*([\d,]+)/);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|–].*ARKET.*$/i, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: 'ARKET',
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.toLowerCase().includes('out of stock') && !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('ARKET parsing error:', error);
    return null;
  }
}

// & Other Stories parser (H&M group)
function parseStories(html: string, url: string): ProductData | null {
  try {
    // Try JSON-LD first
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if (jsonLd['@type'] === 'Product') {
          return {
            name: jsonLd.name || '',
            brand: '& Other Stories',
            price: parseInt(String(jsonLd.offers?.price || jsonLd.offers?.[0]?.price || 0).replace(/,/g, '')),
            original_price: null,
            image_url: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image || null,
            category: inferCategory(jsonLd.name || ''),
            sizes: null,
            is_in_stock: jsonLd.offers?.availability !== 'OutOfStock',
            color: extractColor(jsonLd.name || jsonLd.color || ''),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/₩\s*([\d,]+)/);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|–].*$/i, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: '& Other Stories',
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.toLowerCase().includes('out of stock'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('& Other Stories parsing error:', error);
    return null;
  }
}
// Paul Smith parser
function parsePaulSmith(html: string, url: string): ProductData | null {
  try {
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/₩\s*([\d,]+)/);
    
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: 'Paul Smith',
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Paul Smith parsing error:', error);
    return null;
  }
}

// Benetton parser
function parseBenetton(html: string, url: string): ProductData | null {
  try {
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    const priceMatch = html.match(/"price":\s*"?([\d,]+)"?/i) ||
                       html.match(/class="[^"]*price[^"]*"[^>]*>[\s\S]*?([\d,]+)/i);
    
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    const name = nameMatch ? nameMatch[1].trim().replace(/\s*[-|].*$/, '') : null;
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
    
    if (!name || !price) return null;
    
    return {
      name,
      brand: 'United Colors of Benetton',
      price,
      original_price: null,
      image_url: imageMatch ? imageMatch[1] : null,
      category: inferCategory(name),
      sizes: null,
      is_in_stock: !html.includes('품절'),
      color: extractColor(name),
    };
  } catch (error) {
    console.error('Benetton parsing error:', error);
    return null;
  }
}

// StockX parser - for sneaker images
function parseStockX(html: string, url: string): ProductData | null {
  try {
    // StockX uses React/Next.js, try multiple extraction methods
    
    // Method 1: Try og:image meta tag (most reliable for images)
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    // Method 2: Try JSON-LD
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if (jsonLd['@type'] === 'Product') {
          const imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
          return {
            name: jsonLd.name || ogTitleMatch?.[1] || '',
            brand: jsonLd.brand?.name || null,
            price: parseInt(String(jsonLd.offers?.price || jsonLd.offers?.[0]?.price || 0).replace(/[^\d]/g, '')) || 0,
            original_price: null,
            image_url: imageUrl || ogImageMatch?.[1] || null,
            category: '신발',
            sizes: null,
            is_in_stock: true,
            color: extractColor(jsonLd.name || ''),
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    // Method 3: Try __NEXT_DATA__
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const product = nextData?.props?.pageProps?.product || 
                        nextData?.props?.pageProps?.data?.product ||
                        nextData?.props?.pageProps?.initialState?.product;
        if (product) {
          return {
            name: product.title || product.name || ogTitleMatch?.[1] || '',
            brand: product.brand || null,
            price: product.retailPrice || product.market?.lowestAsk || 0,
            original_price: null,
            image_url: product.media?.imageUrl || product.media?.thumbUrl || product.image || ogImageMatch?.[1] || null,
            category: '신발',
            sizes: null,
            is_in_stock: true,
            color: extractColor(product.title || product.name || ''),
          };
        }
      } catch (e) {
        console.log('StockX __NEXT_DATA__ parsing failed');
      }
    }
    
    // Method 4: Fallback to og tags only
    if (ogImageMatch?.[1]) {
      return {
        name: ogTitleMatch?.[1]?.replace(/\s*[-|–].*StockX.*$/i, '') || '',
        brand: null,
        price: 0,
        original_price: null,
        image_url: ogImageMatch[1],
        category: '신발',
        sizes: null,
        is_in_stock: true,
        color: extractColor(ogTitleMatch?.[1] || ''),
      };
    }
    
    return null;
  } catch (error) {
    console.error('StockX parsing error:', error);
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
  if (url.includes('hfashionmall.com') || url.includes('hfashion.co.kr')) return 'hfashion';
  if (url.includes('posty.kr')) return 'posty';
  if (url.includes('jestina.co.kr')) return 'jestina';
  if (url.includes('arket.com')) return 'arket';
  if (url.includes('stories.com')) return 'stories';
  if (url.includes('paulsmith.co.kr')) return 'paulsmith';
  if (url.includes('benettonmall.co.kr')) return 'benetton1';
  if (url.includes('musinsa.com')) return 'musinsa';
  if (url.includes('29cm.co.kr')) return '29cm';
  if (url.includes('stockx.com')) return 'stockx';
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

// Main scraping function using Bright Data Proxy
async function scrapeWithProxy(url: string): Promise<{ html: string | null; error: string | null }> {
  const proxyHost = Deno.env.get('BRIGHTDATA_PROXY_HOST');
  const proxyUser = Deno.env.get('BRIGHTDATA_PROXY_USER');
  const proxyPass = Deno.env.get('BRIGHTDATA_PROXY_PASS');
  const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
  
  // Method 1: Use Web Unlocker API with correct parameters
  if (apiKey) {
    try {
      console.log(`[Method 1] Scraping with Web Unlocker API: ${url}`);
      
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
          country: 'kr', // Korean IP for better access
        }),
      });
      
      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 1000 && html.includes('<')) {
          console.log(`[Method 1] Success! HTML length: ${html.length}`);
          return { html, error: null };
        }
        console.log(`[Method 1] Invalid response, trying Method 2...`);
      } else {
        const errorText = await response.text();
        console.log(`[Method 1] API returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`[Method 1] Error: ${error}`);
    }
  }
  
  // Method 2: Direct proxy using Deno.createHttpClient
  if (proxyHost && proxyUser && proxyPass) {
    try {
      console.log(`[Method 2] Scraping with Direct Proxy: ${url}`);
      
      // Deno supports HTTP proxy via Deno.createHttpClient
      const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}`;
      console.log(`[Method 2] Proxy: ${proxyHost}`);
      
      // Create HTTP client with proxy
      const client = Deno.createHttpClient({
        proxy: {
          url: proxyUrl,
        },
      });
      
      const response = await fetch(url, {
        client,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
      });
      
      client.close();
      
      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 1000) {
          console.log(`[Method 2] Success! HTML length: ${html.length}`);
          return { html, error: null };
        }
      } else {
        console.log(`[Method 2] Response status: ${response.status}`);
      }
    } catch (error) {
      console.log(`[Method 2] Error: ${error}`);
    }
  }
  
  // Method 3: Simple fetch without proxy (for sites that don't block)
  try {
    console.log(`[Method 3] Simple fetch: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 500) {
        console.log(`[Method 3] Success! HTML length: ${html.length}`);
        return { html, error: null };
      }
    }
    console.log(`[Method 3] Response status: ${response.status}`);
  } catch (error) {
    console.log(`[Method 3] Error: ${error}`);
  }
  
  return { html: null, error: 'All scraping methods failed' };
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
      
      const { html, error } = await scrapeWithProxy(url);
      
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
        case 'hfashion':
          productData = parseHFashion(html, url);
          break;
        case 'posty':
          productData = parsePosty(html, url);
          break;
        case 'jestina':
          productData = parseJestina(html, url);
          break;
        case 'arket':
          productData = parseArket(html, url);
          break;
        case 'stories':
          productData = parseStories(html, url);
          break;
        case 'paulsmith':
          productData = parsePaulSmith(html, url);
          break;
        case 'benetton1':
          productData = parseBenetton(html, url);
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
