import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 8개 머천트 테스트 URL
const testUrls: Record<string, string> = {
  wconcept: 'https://www.wconcept.co.kr/Product/300124178',
  hfashion: 'https://www.hfashionmall.com/display/pda/itemPdaView?stCd=10&itemCd=GCSTY2Y221R1',
  musinsa: 'https://www.musinsa.com/app/goods/2994785',
  posty: 'https://www.posty.kr/product/76937',
  '29cm': 'https://product.29cm.co.kr/catalog/2000000',
  arket: 'https://www.arket.com/ko-kr/women/all-womenswear/product.relaxed-t-shirt-dress-white.1163645001.html',
  stories: 'https://www.stories.com/ko-kr/ready-to-wear/tops/product.twisted-sleeve-ribbed-crop-top-beige.1224689001.html',
  jestina: 'https://www.jestina.co.kr/product/detail.html?product_no=6830',
};

interface ScrapeResult {
  merchant: string;
  url: string;
  success: boolean;
  data?: {
    title?: string;
    price?: string;
    brand?: string;
    image?: string;
    images?: string[];
    description?: string;
    availability?: string;
  };
  metadata?: any;
  error?: string;
  rawMarkdown?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { merchants, singleUrl } = await req.json();
    
    // 단일 URL 테스트
    if (singleUrl) {
      console.log(`[Firecrawl] Testing single URL: ${singleUrl}`);
      const result = await scrapeUrl(apiKey, singleUrl, 'custom');
      return new Response(
        JSON.stringify({ success: true, results: [result] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 머천트 목록 테스트
    const targetMerchants = merchants && merchants.length > 0 
      ? merchants 
      : Object.keys(testUrls);
    
    console.log(`[Firecrawl] Testing ${targetMerchants.length} merchants:`, targetMerchants);
    
    const results: ScrapeResult[] = [];
    
    for (const merchant of targetMerchants) {
      const url = testUrls[merchant];
      if (!url) {
        results.push({
          merchant,
          url: '',
          success: false,
          error: `No test URL for merchant: ${merchant}`,
        });
        continue;
      }
      
      console.log(`[Firecrawl] Scraping ${merchant}: ${url}`);
      const result = await scrapeUrl(apiKey, url, merchant);
      results.push(result);
      
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[Firecrawl] Complete: ${successCount}/${results.length} successful`);
    
    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Firecrawl] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeUrl(apiKey: string, url: string, merchant: string): Promise<ScrapeResult> {
  try {
    // Firecrawl API 호출 - JSON 추출 사용
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
        timeout: 30000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Firecrawl] API error for ${merchant}:`, response.status, errorText);
      return {
        merchant,
        url,
        success: false,
        error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }
    
    const data = await response.json();
    console.log(`[Firecrawl] Response for ${merchant}:`, JSON.stringify(data).substring(0, 500));
    
    if (!data.success) {
      return {
        merchant,
        url,
        success: false,
        error: data.error || 'Scrape failed',
      };
    }
    
    // 메타데이터에서 상품 정보 추출
    const metadata = data.data?.metadata || {};
    const markdown = data.data?.markdown || '';
    
    // 가격 추출 시도 (마크다운에서)
    const priceMatch = markdown.match(/(?:₩|원|KRW)\s*([0-9,]+)/);
    const price = priceMatch ? priceMatch[1] : null;
    
    // og:image 또는 다른 이미지 추출
    const ogImage = metadata.ogImage || metadata.image;
    
    return {
      merchant,
      url,
      success: true,
      data: {
        title: metadata.title || metadata.ogTitle,
        price: price,
        brand: extractBrand(metadata, markdown, merchant) || undefined,
        image: ogImage,
        description: metadata.description || metadata.ogDescription,
        availability: extractAvailability(markdown),
      },
      metadata: {
        statusCode: metadata.statusCode,
        title: metadata.title,
        ogTitle: metadata.ogTitle,
        ogImage: metadata.ogImage,
        ogDescription: metadata.ogDescription,
      },
      rawMarkdown: markdown.substring(0, 1000),
    };
    
  } catch (error) {
    console.error(`[Firecrawl] Exception for ${merchant}:`, error);
    return {
      merchant,
      url,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractBrand(metadata: any, markdown: string, merchant: string): string | null {
  // 메타데이터에서 브랜드 추출
  if (metadata.brand) return metadata.brand;
  
  // 머천트별 브랜드 추출 패턴
  const brandPatterns: Record<string, RegExp> = {
    wconcept: /\[([^\]]+)\]/,
    musinsa: /브랜드:\s*([^\n]+)/,
    hfashion: /브랜드\s*:\s*([^\n]+)/i,
  };
  
  const pattern = brandPatterns[merchant];
  if (pattern) {
    const match = markdown.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

function extractAvailability(markdown: string): string {
  const lowerMarkdown = markdown.toLowerCase();
  if (lowerMarkdown.includes('품절') || lowerMarkdown.includes('sold out')) {
    return 'out_of_stock';
  }
  if (lowerMarkdown.includes('구매하기') || lowerMarkdown.includes('장바구니') || lowerMarkdown.includes('add to')) {
    return 'in_stock';
  }
  return 'unknown';
}
