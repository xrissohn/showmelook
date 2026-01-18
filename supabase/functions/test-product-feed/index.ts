import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedProduct {
  product_id?: string;
  product_name?: string;
  category_code?: string;
  category_name?: string;
  brand?: string;
  price?: number | string;
  sale_price?: number | string;
  original_price?: number | string;
  image_url?: string;
  product_url?: string;
  shop_name?: string;
  currency?: string;
  in_stock?: boolean | string;
  [key: string]: unknown;
}

interface FeedResponse {
  success: boolean;
  merchant: string;
  apiConnected: boolean;
  totalProducts: number;
  sampleProducts: FeedProduct[];
  fields: string[];
  rawResponse?: unknown;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { merchant = '11st' } = await req.json().catch(() => ({}));
    
    const affiliateId = Deno.env.get('LINKPRICE_AFFILIATE_ID');
    if (!affiliateId) {
      return new Response(
        JSON.stringify({
          success: false,
          merchant,
          apiConnected: false,
          totalProducts: 0,
          sampleProducts: [],
          fields: [],
          error: 'LINKPRICE_AFFILIATE_ID 시크릿이 설정되지 않았습니다.',
        } as FeedResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build API URL based on merchant
    const merchantApiMap: Record<string, string> = {
      '11st': `https://api.linkprice.com/ci/product/deal/11st/${affiliateId}`,
      'coupang': `https://api.linkprice.com/ci/product/deal/coupang/${affiliateId}`,
      'gmarket': `https://api.linkprice.com/ci/product/deal/gmarket/${affiliateId}`,
      'auction': `https://api.linkprice.com/ci/product/deal/auction/${affiliateId}`,
    };

    const apiUrl = merchantApiMap[merchant];
    if (!apiUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          merchant,
          apiConnected: false,
          totalProducts: 0,
          sampleProducts: [],
          fields: [],
          error: `지원하지 않는 머천트: ${merchant}. 지원 목록: ${Object.keys(merchantApiMap).join(', ')}`,
        } as FeedResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-product-feed] Fetching ${merchant} feed from: ${apiUrl}`);
    
    // Call LinkPrice product feed API
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'ShowMeLook/1.0',
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[test-product-feed] API response status: ${response.status}, time: ${elapsed}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[test-product-feed] API error: ${errorText}`);
      return new Response(
        JSON.stringify({
          success: false,
          merchant,
          apiConnected: false,
          totalProducts: 0,
          sampleProducts: [],
          fields: [],
          error: `API 응답 오류 (${response.status}): ${errorText.substring(0, 200)}`,
        } as FeedResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse response
    const contentType = response.headers.get('content-type') || '';
    let products: FeedProduct[] = [];
    let rawData: unknown = null;
    
    if (contentType.includes('application/json')) {
      rawData = await response.json();
      
      // Handle different JSON structures
      if (Array.isArray(rawData)) {
        products = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        // Check common wrapper fields
        const dataObj = rawData as Record<string, unknown>;
        if (Array.isArray(dataObj.products)) {
          products = dataObj.products;
        } else if (Array.isArray(dataObj.items)) {
          products = dataObj.items;
        } else if (Array.isArray(dataObj.data)) {
          products = dataObj.data;
        } else {
          // Single product or unknown structure
          products = [dataObj as FeedProduct];
        }
      }
    } else {
      // Try to parse as JSON anyway
      const text = await response.text();
      try {
        rawData = JSON.parse(text);
        if (Array.isArray(rawData)) {
          products = rawData;
        } else if (typeof rawData === 'object' && rawData !== null) {
          const dataObj = rawData as Record<string, unknown>;
          if (Array.isArray(dataObj.products)) {
            products = dataObj.products;
          } else if (Array.isArray(dataObj.items)) {
            products = dataObj.items;
          } else if (Array.isArray(dataObj.data)) {
            products = dataObj.data;
          }
        }
      } catch {
        console.log(`[test-product-feed] Non-JSON response, content-type: ${contentType}`);
        return new Response(
          JSON.stringify({
            success: false,
            merchant,
            apiConnected: true,
            totalProducts: 0,
            sampleProducts: [],
            fields: [],
            error: `JSON 파싱 실패. Content-Type: ${contentType}, 응답 샘플: ${text.substring(0, 500)}`,
          } as FeedResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract field names from first product
    const fields = products.length > 0 ? Object.keys(products[0]) : [];
    
    // Get sample products (first 5)
    const sampleProducts = products.slice(0, 5);

    console.log(`[test-product-feed] Success! Total products: ${products.length}, fields: ${fields.join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        merchant,
        apiConnected: true,
        totalProducts: products.length,
        sampleProducts,
        fields,
        elapsedMs: elapsed,
      } as FeedResponse & { elapsedMs: number }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-product-feed] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        merchant: 'unknown',
        apiConnected: false,
        totalProducts: 0,
        sampleProducts: [],
        fields: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      } as FeedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
