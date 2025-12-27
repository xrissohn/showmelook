import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Extract domain from product URL to find merchant
    const urlObj = new URL(product_url);
    const domain = urlObj.hostname.toLowerCase();

    console.log('Extracted domain:', domain);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find merchant by domain
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id, name, deeplink_template')
      .eq('is_active', true);

    if (merchantError) {
      console.error('Error fetching merchants:', merchantError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch merchants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Match merchant by domain
    const merchant = merchants?.find(m => {
      const merchantDomains: Record<string, string[]> = {
        'wconcept': ['wconcept.co.kr', 'www.wconcept.co.kr'],
        'posty': ['posty.kr', 'www.posty.kr'],
        'arket': ['arket.com', 'www.arket.com'],
        'jestina': ['jestina.co.kr', 'www.jestina.co.kr'],
        'hfashion': ['hfashionmall.com', 'www.hfashionmall.com'],
        'benetton1': ['benettonmall.co.kr', 'www.benettonmall.co.kr'],
        'stories': ['stories.com', 'www.stories.com'],
        'paulsmith': ['paulsmith.co.kr', 'www.paulsmith.co.kr'],
      };
      return merchantDomains[m.id]?.some(d => domain.includes(d));
    });

    if (!merchant) {
      console.log('No matching merchant found for domain:', domain);
      return new Response(
        JSON.stringify({ 
          error: 'Unsupported merchant', 
          message: `No affiliate program found for domain: ${domain}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found merchant:', merchant.name);

    // Generate affiliate URL
    const encodedUrl = encodeURIComponent(product_url);
    const affiliateUrl = merchant.deeplink_template
      .replace('{affiliate_id}', affiliateId)
      .replace('{encoded_url}', encodedUrl);

    console.log('Generated affiliate URL:', affiliateUrl);

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        original_url: product_url,
        affiliate_url: affiliateUrl,
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
