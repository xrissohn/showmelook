import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 머천트 딥링크 템플릿 (DB 조회 실패 시 Fallback)
const MERCHANT_TEMPLATES: Record<string, string> = {
  'paulsmith': 'https://click.linkprice.com/click.php?m=paulsmith&a={affiliate_id}&l=0000&u={encoded_url}',
  'kream': 'https://click.linkprice.com/click.php?m=kream&a={affiliate_id}&l=0000&u={encoded_url}',
};

// 도메인으로 머천트 ID 추출
function extractMerchantId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    
    if (hostname.includes('paulsmith')) return 'paulsmith';
    if (hostname.includes('kream')) return 'kream';
    
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
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

    console.log('[deeplink] Converting product URL:', product_url);

    const affiliateId = Deno.env.get('LINKPRICE_AFFILIATE_ID');
    if (!affiliateId) {
      console.error('[deeplink] LINKPRICE_AFFILIATE_ID not configured');
      return new Response(
        JSON.stringify({ error: 'Affiliate ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encodedUrl = encodeURIComponent(product_url);
    const merchantId = extractMerchantId(product_url);
    
    // 머천트 템플릿 우선 시도 (DB 조회)
    let merchantTemplate: string | null = null;
    
    if (merchantId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: merchant } = await supabase
          .from('merchants')
          .select('deeplink_template')
          .eq('id', merchantId)
          .single();
        
        if (merchant?.deeplink_template) {
          merchantTemplate = merchant.deeplink_template;
          console.log('[deeplink] Found merchant template from DB:', merchantId);
        }
      } catch (dbError) {
        console.log('[deeplink] DB lookup failed, using fallback templates');
      }
      
      // Fallback to hardcoded templates
      if (!merchantTemplate && MERCHANT_TEMPLATES[merchantId]) {
        merchantTemplate = MERCHANT_TEMPLATES[merchantId];
        console.log('[deeplink] Using fallback template for:', merchantId);
      }
    }

    // 머천트 템플릿이 있으면 바로 사용
    if (merchantTemplate) {
      const affiliateUrl = merchantTemplate
        .replace('{affiliate_id}', affiliateId)
        .replace('{encoded_url}', encodedUrl)
        .replace('{url}', encodedUrl);
      
      console.log('[deeplink] Generated affiliate URL via template:', affiliateUrl);
      
      const urlObj = new URL(product_url);
      const domain = urlObj.hostname.replace('www.', '');
      const merchantName = domain.split('.')[0];

      return new Response(
        JSON.stringify({
          success: true,
          merchant_name: merchantName,
          original_url: product_url,
          affiliate_url: affiliateUrl,
          mobile_supported: true,
          source: 'merchant_template'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LinkPrice API Fallback
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${affiliateId}&url=${encodedUrl}&mode=json`;
    console.log('[deeplink] Calling LinkPrice API:', apiUrl);

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('[deeplink] LinkPrice API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          error: 'LinkPrice API error', 
          message: `Status: ${response.status}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseText = await response.text();
    console.log('[deeplink] LinkPrice API raw response:', responseText);

    let linkPriceData;
    try {
      linkPriceData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[deeplink] Failed to parse LinkPrice response:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse LinkPrice response', 
          raw_response: responseText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[deeplink] LinkPrice API parsed response:', linkPriceData);

    if (linkPriceData.result !== 'S') {
      console.error('[deeplink] LinkPrice conversion failed:', linkPriceData);
      return new Response(
        JSON.stringify({ 
          error: 'LinkPrice conversion failed', 
          message: 'The URL could not be converted. This merchant may not be supported.',
          result: linkPriceData.result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        source: 'linkprice_api'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[deeplink] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
