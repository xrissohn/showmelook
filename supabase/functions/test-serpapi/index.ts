import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SerpAPIProduct {
  title: string;
  thumbnail: string;
  link: string;
  price?: string;
  extracted_price?: number;
  source?: string;
}

interface SerpAPIResponse {
  shopping_results?: SerpAPIProduct[];
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    
    if (!SERPAPI_API_KEY) {
      console.error('SERPAPI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'SERPAPI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query, merchant = 'wconcept' } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define merchant domains
    const merchantDomains: Record<string, string> = {
      'wconcept': 'wconcept.co.kr',
      'hfashion': 'hfashionmall.com',
      'musinsa': 'musinsa.com',
      'posty': 'posty.kr',
      'jestina': 'jestina.co.kr',
      'oslonog': 'oslonog.co.kr',
    };

    const domain = merchantDomains[merchant] || merchantDomains['wconcept'];
    const searchQuery = `site:${domain} ${query}`;

    console.log(`[SerpAPI] Searching: "${searchQuery}"`);
    const startTime = Date.now();

    // Build SerpAPI URL
    const serpApiUrl = new URL('https://serpapi.com/search.json');
    serpApiUrl.searchParams.set('engine', 'google_shopping');
    serpApiUrl.searchParams.set('q', searchQuery);
    serpApiUrl.searchParams.set('location', 'South Korea');
    serpApiUrl.searchParams.set('hl', 'ko');
    serpApiUrl.searchParams.set('gl', 'kr');
    serpApiUrl.searchParams.set('api_key', SERPAPI_API_KEY);

    const response = await fetch(serpApiUrl.toString());
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SerpAPI] API error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SerpAPI error: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: SerpAPIResponse = await response.json();
    console.log(`[SerpAPI] Response received in ${responseTime}ms`);

    if (data.error) {
      console.error(`[SerpAPI] API returned error:`, data.error);
      return new Response(
        JSON.stringify({ success: false, error: data.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract products from shopping_results
    const products = (data.shopping_results || []).map((item) => ({
      title: item.title || 'Unknown',
      thumbnail: item.thumbnail || '',
      link: item.link || '',
      price: item.extracted_price || null,
      priceText: item.price || '',
      source: item.source || domain,
    }));

    console.log(`[SerpAPI] Found ${products.length} products`);

    // Log sample product for debugging
    if (products.length > 0) {
      console.log(`[SerpAPI] Sample product:`, JSON.stringify(products[0]));
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: searchQuery,
        merchant,
        domain,
        count: products.length,
        responseTime,
        products,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SerpAPI] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
