import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_url } = await req.json();

    if (!product_url) {
      return new Response(
        JSON.stringify({ error: 'product_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Converting product URL:', product_url);

    // Get affiliate ID from secrets
    const affiliateId = Deno.env.get('LINKPRICE_AFFILIATE_ID');
    if (!affiliateId) {
      console.error('LINKPRICE_AFFILIATE_ID not configured');
      return new Response(
        JSON.stringify({ error: 'Affiliate ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encode the product URL
    const encodedUrl = encodeURIComponent(product_url);

    // Call LinkPrice API to get the actual deeplink
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${affiliateId}&url=${encodedUrl}&mode=json`;
    
    console.log('Calling LinkPrice API:', apiUrl);

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('LinkPrice API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          error: 'LinkPrice API error', 
          message: `Status: ${response.status}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseText = await response.text();
    console.log('LinkPrice API raw response:', responseText);

    // Parse JSON response (LinkPrice uses EUC-KR encoding, but JSON should work)
    let linkPriceData;
    try {
      linkPriceData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse LinkPrice response:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse LinkPrice response', 
          raw_response: responseText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('LinkPrice API parsed response:', linkPriceData);

    // Check if conversion was successful
    if (linkPriceData.result !== 'S') {
      console.error('LinkPrice conversion failed:', linkPriceData);
      return new Response(
        JSON.stringify({ 
          error: 'LinkPrice conversion failed', 
          message: 'The URL could not be converted. This merchant may not be supported.',
          result: linkPriceData.result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract merchant name from domain for display
    const urlObj = new URL(product_url);
    const domain = urlObj.hostname.replace('www.', '');
    const merchantName = domain.split('.')[0];

    return new Response(
      JSON.stringify({
        success: true,
        merchant_name: merchantName,
        original_url: product_url,
        affiliate_url: linkPriceData.url,
        mobile_supported: linkPriceData.mobile_yn === 'Y',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Deeplink error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
