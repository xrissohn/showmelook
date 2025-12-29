import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STYLE_TAGS = ['미니멀 시크', '스트릿 무드', '로맨틱 클래식', '애슬레저 핏', '보헤미안 에센스'];

interface Product {
  merchant_id: string;
  product_url: string;
  external_id: string;
  name: string;
  brand?: string;
  price: number;
  original_price?: number;
  image_url?: string;
  category: string;
  sub_category?: string;
  sizes?: string[];
  is_in_stock: boolean;
  gender?: string;
  color?: string;
}

interface Merchant {
  id: string;
  name: string;
  base_url: string;
  scrape_type: string;
  scrape_config: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { merchant_id, limit = 50 } = await req.json();

    if (!merchant_id) {
      return new Response(
        JSON.stringify({ error: 'merchant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting product collection for merchant: ${merchant_id}, limit: ${limit}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return new Response(
        JSON.stringify({ error: 'Merchant not found', details: merchantError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found merchant: ${merchant.name}, scrape_type: ${merchant.scrape_type}`);

    let products: Product[] = [];
    
    try {
      switch (merchant.scrape_type) {
        case 'next_data':
          products = await scrapeNextData(merchant, limit);
          break;
        case 'api':
          products = await scrapeApi(merchant, limit);
          break;
        case 'html':
          products = await scrapeHtml(merchant, limit);
          break;
        default:
          console.log(`Unknown scrape_type: ${merchant.scrape_type}`);
          products = [];
      }
    } catch (scrapeError) {
      console.error('Scraping error:', scrapeError);
    }

    console.log(`Collected ${products.length} real products`);

    if (products.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No products found from scraping',
          collected: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const taggedProducts = classifyStyleTags(products);
    const upsertResults = await upsertProducts(supabase, taggedProducts);

    await supabase
      .from('merchants')
      .update({ last_collected_at: new Date().toISOString() })
      .eq('id', merchant_id);

    console.log(`Successfully collected and stored ${upsertResults.inserted} products`);

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id,
        collected: products.length,
        inserted: upsertResults.inserted,
        updated: upsertResults.updated,
        errors: upsertResults.errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Collect products error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalize image URL to absolute path with proper CDN
function normalizeImageUrl(url: string | undefined, merchantId: string, baseUrl: string): string | undefined {
  if (!url) return undefined;
  
  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/\?.*$/, ''); // Remove query params for cleaner URL
  }
  
  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // Merchant-specific CDN domains
  const cdnDomains: Record<string, string> = {
    'wconcept': 'https://cdn.wconcept.co.kr',
    'posty': 'https://image.posty.kr',
    'arket': 'https://lp2.hm.com/hmgoepprod',
    'stories': 'https://lp2.hm.com/hmgoepprod',
    'jestina': 'https://www.jestina.co.kr',
    'hfashion': 'https://www.hfashionmall.com',
    'benetton1': 'https://kr.benetton.com',
    'paulsmith': 'https://www.paulsmith.co.kr',
  };
  
  const cdnBase = cdnDomains[merchantId] || baseUrl;
  
  // Handle relative paths
  if (url.startsWith('/')) {
    return `${cdnBase}${url}`;
  }
  
  return `${cdnBase}/${url}`;
}

// Scrape W Concept using __NEXT_DATA__
async function scrapeWConcept(limit: number): Promise<Product[]> {
  const products: Product[] = [];
  const categories = [
    { url: 'https://www.wconcept.co.kr/Women/Top', gender: 'female', cat: 'top' },
    { url: 'https://www.wconcept.co.kr/Women/Bottom', gender: 'female', cat: 'bottom' },
    { url: 'https://www.wconcept.co.kr/Women/Outer', gender: 'female', cat: 'outerwear' },
    { url: 'https://www.wconcept.co.kr/Women/Dress', gender: 'female', cat: 'dress' },
  ];

  for (const { url, gender, cat } of categories) {
    if (products.length >= limit) break;
    
    try {
      console.log(`Fetching W Concept: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        }
      });
      
      if (!response.ok) {
        console.log(`Failed to fetch ${url}: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      
      if (nextDataMatch) {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Try multiple possible paths for product data
        const items = nextData?.props?.pageProps?.initialState?.products?.list ||
                      nextData?.props?.pageProps?.products ||
                      nextData?.props?.pageProps?.items ||
                      nextData?.props?.pageProps?.data?.items ||
                      nextData?.props?.pageProps?.goodsList?.items || [];
        
        console.log(`Found ${items.length} items from W Concept ${cat}`);
        
        for (const item of items) {
          if (products.length >= limit) break;
          
          const goodsNo = item.goodsNo || item.id || item.productId;
          if (!goodsNo) continue;
          
          const imageUrl = normalizeImageUrl(
            item.imgUrl || item.imageUrl || item.mainImg || item.image,
            'wconcept',
            'https://www.wconcept.co.kr'
          );
          
          const product: Product = {
            merchant_id: 'wconcept',
            product_url: `https://www.wconcept.co.kr/Product/${goodsNo}`,
            external_id: String(goodsNo),
            name: item.goodsNm || item.name || item.title || '',
            brand: item.brandNm || item.brandName || item.brand || '',
            price: parseInt(item.sellPrice || item.salePrice || item.price) || 0,
            original_price: parseInt(item.normalPrice || item.originalPrice || item.consumerPrice),
            image_url: imageUrl,
            category: cat,
            is_in_stock: item.soldOutFl !== 'Y' && item.soldOut !== true,
            gender: gender,
            color: item.colorNm || item.color,
          };
          
          if (product.name && product.price > 0) {
            products.push(product);
          }
        }
      }
    } catch (e) {
      console.error(`Error scraping W Concept ${url}:`, e);
    }
  }
  
  return products;
}

// Scrape Posty using __NEXT_DATA__
async function scrapePosty(limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  try {
    const url = 'https://www.posty.kr/product/list?category=001';
    console.log(`Fetching Posty: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch Posty: ${response.status}`);
      return products;
    }
    
    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const items = nextData?.props?.pageProps?.products || 
                    nextData?.props?.pageProps?.data?.list || [];
      
      console.log(`Found ${items.length} items from Posty`);
      
      for (const item of items.slice(0, limit)) {
        const product: Product = {
          merchant_id: 'posty',
          product_url: `https://www.posty.kr/product/${item.id || item.productId}`,
          external_id: String(item.id || item.productId),
          name: item.name || item.productName || '',
          brand: item.brand || 'POSTY',
          price: parseInt(item.salePrice || item.price) || 0,
          original_price: parseInt(item.originalPrice),
          image_url: normalizeImageUrl(item.imageUrl || item.mainImage, 'posty', 'https://www.posty.kr'),
          category: detectCategory(item.categoryName || item.name || ''),
          is_in_stock: !item.soldOut,
          gender: 'female',
        };
        
        if (product.name && product.price > 0) {
          products.push(product);
        }
      }
    }
  } catch (e) {
    console.error('Error scraping Posty:', e);
  }
  
  return products;
}

// Scrape H&M Group sites (Arket, & Other Stories) using their API
async function scrapeHMGroup(merchantId: string, limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  const apiEndpoints: Record<string, string[]> = {
    'arket': [
      'https://www.arket.com/ko-kr/women/tops/shirts-blouses/_jcr_content/main/productlisting.products.json',
      'https://www.arket.com/ko-kr/women/dresses/_jcr_content/main/productlisting.products.json',
    ],
    'stories': [
      'https://www.stories.com/ko-kr/clothing/tops/_jcr_content/main/productlisting.products.json',
      'https://www.stories.com/ko-kr/clothing/dresses/_jcr_content/main/productlisting.products.json',
    ],
  };
  
  const endpoints = apiEndpoints[merchantId] || [];
  
  for (const apiUrl of endpoints) {
    if (products.length >= limit) break;
    
    try {
      console.log(`Fetching ${merchantId} API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.log(`Failed to fetch ${merchantId} API: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const items = data.products || data.items || [];
      
      console.log(`Found ${items.length} items from ${merchantId}`);
      
      for (const item of items) {
        if (products.length >= limit) break;
        
        const product: Product = {
          merchant_id: merchantId,
          product_url: `https://www.${merchantId === 'stories' ? 'stories' : 'arket'}.com${item.url || item.link}`,
          external_id: item.articleCode || item.code || String(item.id),
          name: item.title || item.name || '',
          brand: merchantId === 'arket' ? 'ARKET' : '& Other Stories',
          price: parseInt(item.price?.value || item.salePrice) || 0,
          original_price: parseInt(item.regularPrice?.value || item.originalPrice),
          image_url: normalizeImageUrl(item.image?.src || item.images?.[0]?.src, merchantId, ''),
          category: detectCategory(item.category || item.title || ''),
          is_in_stock: item.inStock !== false,
          gender: 'female',
        };
        
        if (product.name && product.price > 0) {
          products.push(product);
        }
      }
    } catch (e) {
      console.error(`Error scraping ${merchantId}:`, e);
    }
  }
  
  return products;
}

// Scrape J.ESTINA (jewelry)
async function scrapeJestina(limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  try {
    const url = 'https://www.jestina.co.kr/product/list?category=1';
    console.log(`Fetching J.ESTINA: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch J.ESTINA: ${response.status}`);
      return products;
    }
    
    const html = await response.text();
    
    // Try to find product data in script tags or data attributes
    const productMatches = html.matchAll(/data-product-id="(\d+)"[^>]*data-product-name="([^"]+)"[^>]*data-product-price="(\d+)"/g);
    
    for (const match of productMatches) {
      if (products.length >= limit) break;
      
      const [, id, name, price] = match;
      
      // Try to find corresponding image
      const imgMatch = html.match(new RegExp(`product/${id}[^"]*"[^>]*<img[^>]*src="([^"]+)"`));
      
      products.push({
        merchant_id: 'jestina',
        product_url: `https://www.jestina.co.kr/product/view?productNo=${id}`,
        external_id: id,
        name: decodeURIComponent(name),
        brand: 'J.ESTINA',
        price: parseInt(price) || 0,
        image_url: normalizeImageUrl(imgMatch?.[1], 'jestina', 'https://www.jestina.co.kr'),
        category: 'accessory',
        is_in_stock: true,
        gender: 'female',
      });
    }
    
    console.log(`Found ${products.length} items from J.ESTINA`);
  } catch (e) {
    console.error('Error scraping J.ESTINA:', e);
  }
  
  return products;
}

// Generic Next.js scraper
async function scrapeNextData(merchant: Merchant, limit: number): Promise<Product[]> {
  switch (merchant.id) {
    case 'wconcept':
      return await scrapeWConcept(limit);
    case 'posty':
      return await scrapePosty(limit);
    case 'jestina':
      return await scrapeJestina(limit);
    case 'paulsmith':
      // Paul Smith uses standard Next.js structure
      return await scrapeGenericNextData(merchant, limit);
    default:
      return [];
  }
}

async function scrapeGenericNextData(merchant: Merchant, limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  try {
    const response = await fetch(merchant.base_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) return products;
    
    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const items = nextData?.props?.pageProps?.products || 
                    nextData?.props?.pageProps?.items || [];
      
      for (const item of items.slice(0, limit)) {
        const product: Product = {
          merchant_id: merchant.id,
          product_url: `${merchant.base_url}/product/${item.id}`,
          external_id: String(item.id),
          name: item.name || item.title || '',
          brand: item.brand || merchant.name,
          price: parseInt(item.price) || 0,
          image_url: normalizeImageUrl(item.image || item.imageUrl, merchant.id, merchant.base_url),
          category: detectCategory(item.category || item.name || ''),
          is_in_stock: !item.soldOut,
          gender: 'unisex',
        };
        
        if (product.name && product.price > 0) {
          products.push(product);
        }
      }
    }
  } catch (e) {
    console.error(`Error scraping ${merchant.id}:`, e);
  }
  
  return products;
}

// Scrape API-based merchants
async function scrapeApi(merchant: Merchant, limit: number): Promise<Product[]> {
  switch (merchant.id) {
    case 'arket':
    case 'stories':
      return await scrapeHMGroup(merchant.id, limit);
    case 'hfashion':
      return await scrapeHFashion(limit);
    default:
      return [];
  }
}

// Scrape H Fashion Mall
async function scrapeHFashion(limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  try {
    // H Fashion uses internal JSON API
    const apiUrl = 'https://www.hfashionmall.com/display/category/list?categoryId=10000&pageSize=' + limit;
    console.log(`Fetching H Fashion: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch H Fashion: ${response.status}`);
      return products;
    }
    
    const data = await response.json();
    const items = data.data?.products || data.products || [];
    
    for (const item of items.slice(0, limit)) {
      products.push({
        merchant_id: 'hfashion',
        product_url: `https://www.hfashionmall.com/product/${item.productId}`,
        external_id: String(item.productId),
        name: item.productName || item.name || '',
        brand: item.brandName || item.brand || '',
        price: parseInt(item.salePrice || item.price) || 0,
        original_price: parseInt(item.originalPrice),
        image_url: normalizeImageUrl(item.imageUrl || item.mainImage, 'hfashion', 'https://www.hfashionmall.com'),
        category: detectCategory(item.categoryName || item.name || ''),
        is_in_stock: !item.soldOut,
        gender: item.gender || 'unisex',
      });
    }
    
    console.log(`Found ${products.length} items from H Fashion`);
  } catch (e) {
    console.error('Error scraping H Fashion:', e);
  }
  
  return products;
}

// Scrape HTML-based merchants
async function scrapeHtml(merchant: Merchant, limit: number): Promise<Product[]> {
  switch (merchant.id) {
    case 'benetton1':
      return await scrapeBenetton(limit);
    default:
      return [];
  }
}

// Scrape Benetton using HTML parsing
async function scrapeBenetton(limit: number): Promise<Product[]> {
  const products: Product[] = [];
  
  try {
    const url = 'https://kr.benetton.com/women/clothing/';
    console.log(`Fetching Benetton: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch Benetton: ${response.status}`);
      return products;
    }
    
    const html = await response.text();
    
    // Extract product data using regex patterns
    const productPattern = /<div[^>]*class="[^"]*product-tile[^"]*"[^>]*data-pid="([^"]+)"[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<a[^>]*class="[^"]*link[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</g;
    
    let match;
    while ((match = productPattern.exec(html)) !== null && products.length < limit) {
      const [, id, imageUrl, name, priceStr] = match;
      const price = parseInt(priceStr.replace(/[^\d]/g, '')) || 0;
      
      products.push({
        merchant_id: 'benetton1',
        product_url: `https://kr.benetton.com/product/${id}`,
        external_id: id,
        name: name.trim(),
        brand: 'BENETTON',
        price: price,
        image_url: normalizeImageUrl(imageUrl, 'benetton1', 'https://kr.benetton.com'),
        category: detectCategory(name),
        is_in_stock: true,
        gender: 'unisex',
      });
    }
    
    console.log(`Found ${products.length} items from Benetton`);
  } catch (e) {
    console.error('Error scraping Benetton:', e);
  }
  
  return products;
}

function detectCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('top') || lowerText.includes('shirt') || lowerText.includes('blouse') || 
      lowerText.includes('sweater') || lowerText.includes('knit') || lowerText.includes('tee') ||
      lowerText.includes('니트') || lowerText.includes('블라우스') || lowerText.includes('셔츠')) {
    return 'top';
  }
  if (lowerText.includes('bottom') || lowerText.includes('pants') || lowerText.includes('skirt') || 
      lowerText.includes('trouser') || lowerText.includes('jeans') ||
      lowerText.includes('팬츠') || lowerText.includes('스커트') || lowerText.includes('바지')) {
    return 'bottom';
  }
  if (lowerText.includes('outer') || lowerText.includes('coat') || lowerText.includes('jacket') || 
      lowerText.includes('blazer') || lowerText.includes('코트') || lowerText.includes('자켓')) {
    return 'outerwear';
  }
  if (lowerText.includes('dress') || lowerText.includes('드레스') || lowerText.includes('원피스')) {
    return 'dress';
  }
  if (lowerText.includes('shoe') || lowerText.includes('boot') || lowerText.includes('sneaker') ||
      lowerText.includes('슈즈') || lowerText.includes('부츠')) {
    return 'shoes';
  }
  if (lowerText.includes('bag') || lowerText.includes('tote') || lowerText.includes('clutch') ||
      lowerText.includes('백') || lowerText.includes('가방')) {
    return 'bag';
  }
  if (lowerText.includes('accessory') || lowerText.includes('jewelry') || lowerText.includes('earring') ||
      lowerText.includes('necklace') || lowerText.includes('bracelet') || lowerText.includes('watch') ||
      lowerText.includes('scarf') || lowerText.includes('tie') ||
      lowerText.includes('이어링') || lowerText.includes('목걸이') || lowerText.includes('팔찌')) {
    return 'accessory';
  }
  
  return 'top';
}

function classifyStyleTags(products: Product[]): (Product & { style_tags: string[] })[] {
  return products.map(product => {
    const tags: string[] = [];
    const text = `${product.name} ${product.brand || ''} ${product.category}`.toLowerCase();
    
    if (text.includes('minimal') || text.includes('classic') || text.includes('clean') ||
        text.includes('silk') || text.includes('cashmere') || product.brand?.includes('COS') ||
        product.brand?.includes('THEORY') || product.brand?.includes('ARKET') ||
        text.includes('미니멀') || text.includes('클래식')) {
      tags.push('미니멀 시크');
    }
    
    if (text.includes('street') || text.includes('urban') || text.includes('casual') ||
        text.includes('sneaker') || text.includes('hoodie') || text.includes('denim') ||
        text.includes('스트릿') || text.includes('캐주얼')) {
      tags.push('스트릿 무드');
    }
    
    if (text.includes('romantic') || text.includes('floral') || text.includes('lace') ||
        text.includes('dress') || text.includes('blouse') || text.includes('jewelry') ||
        product.brand?.includes('J.ESTINA') ||
        text.includes('로맨틱') || text.includes('플로럴')) {
      tags.push('로맨틱 클래식');
    }
    
    if (text.includes('active') || text.includes('sport') || text.includes('jogger') ||
        text.includes('legging') || text.includes('athleisure') ||
        text.includes('애슬레저') || text.includes('스포츠')) {
      tags.push('애슬레저 핏');
    }
    
    if (text.includes('boho') || text.includes('bohemian') || text.includes('linen') ||
        text.includes('natural') || text.includes('organic') || text.includes('earthy') ||
        text.includes('보헤미안') || text.includes('린넨')) {
      tags.push('보헤미안 에센스');
    }
    
    if (tags.length === 0) {
      tags.push('미니멀 시크');
    }
    
    return { ...product, style_tags: tags.slice(0, 3) };
  });
}

async function upsertProducts(
  supabase: any, 
  products: (Product & { style_tags: string[] })[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const { error } = await supabase
        .from('products_cache')
        .upsert({
          merchant_id: product.merchant_id,
          product_url: product.product_url,
          external_id: product.external_id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          original_price: product.original_price,
          image_url: product.image_url,
          category: product.category,
          sub_category: product.sub_category,
          sizes: product.sizes,
          is_in_stock: product.is_in_stock,
          style_tags: product.style_tags,
          gender: product.gender,
          color: product.color,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'product_url',
        });

      if (error) {
        console.error('Upsert error:', error);
        errors++;
      } else {
        inserted++;
      }
    } catch (e) {
      console.error('Product upsert error:', e);
      errors++;
    }
  }

  return { inserted, updated, errors };
}
