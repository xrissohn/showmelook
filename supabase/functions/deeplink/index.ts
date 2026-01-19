import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 도메인-머천트ID 매핑 (DB 조회 실패 시 Fallback)
const DOMAIN_TO_MERCHANT: Record<string, string> = {
  'paulsmith.co.kr': 'paulsmith',
  'paulsmith.com': 'paulsmith',
  'kream.co.kr': 'kream',
  'posty.kr': 'posty',
  'stories.com': 'stories',
  'arket.com': 'arket',
  'benettonmall.com': 'benetton1',
  'benettonmall.co.kr': 'benetton1',
  'wconcept.co.kr': 'wconcept',
  'hfashionmall.com': 'hfashion',
  'jestina.co.kr': 'jestina',
  'stockx.com': 'stockx',
};

// 머천트 딥링크 템플릿 (DB 조회 실패 시 Fallback)
const MERCHANT_TEMPLATES: Record<string, string> = {
  'paulsmith': 'https://click.linkprice.com/click.php?m=paulsmith&a={affiliate_id}&l=0000&u={encoded_url}',
  'posty': 'https://click.linkprice.com/click.php?m=posty&a={affiliate_id}&l=0000&u={encoded_url}',
  'stories': 'https://click.linkprice.com/click.php?m=stories&a={affiliate_id}&l=0000&u={encoded_url}',
  'arket': 'https://click.linkprice.com/click.php?m=arket&a={affiliate_id}&l=0000&u={encoded_url}',
  'benetton1': 'https://click.linkprice.com/click.php?m=benetton1&a={affiliate_id}&l=0000&u={encoded_url}',
  'wconcept': 'https://click.linkprice.com/click.php?m=wconcept&a={affiliate_id}&l=0000&u={encoded_url}',
  'hfashion': 'https://click.linkprice.com/click.php?m=hfashion&a={affiliate_id}&l=0000&u={encoded_url}',
  'jestina': 'https://click.linkprice.com/click.php?m=jestina&a={affiliate_id}&l=0000&u={encoded_url}',
  'stockx': 'https://click.linkprice.com/click.php?m=stockx&a={affiliate_id}&l=0000&u={encoded_url}',
  'kream': 'https://click.linkprice.com/click.php?m=kream&a={affiliate_id}&l=0000&u={encoded_url}',
};

// 도메인으로 머천트 ID 추출 (전체 도메인 매칭)
function extractMerchantIdFromDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    
    // 정확한 도메인 매칭 우선
    if (DOMAIN_TO_MERCHANT[hostname]) {
      return DOMAIN_TO_MERCHANT[hostname];
    }
    
    // 부분 매칭 (서브도메인 지원)
    for (const [domain, merchantId] of Object.entries(DOMAIN_TO_MERCHANT)) {
      if (hostname.includes(domain.split('.')[0])) {
        return merchantId;
      }
    }
    
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
    const urlObj = new URL(product_url);
    const domain = urlObj.hostname.replace('www.', '');
    const merchantName = domain.split('.')[0];
    
    // 1. DB에서 모든 머천트를 조회하여 base_url로 매칭
    let merchantTemplate: string | null = null;
    let matchedMerchantId: string | null = null;
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: merchants } = await supabase
        .from('merchants')
        .select('id, base_url, deeplink_template')
        .eq('is_active', true);
      
      if (merchants) {
        for (const merchant of merchants) {
          // base_url에서 도메인 추출하여 비교
          try {
            const merchantBaseUrl = new URL(merchant.base_url);
            const merchantDomain = merchantBaseUrl.hostname.toLowerCase().replace('www.', '');
            
            // 동일 도메인인지 확인
            if (domain === merchantDomain || domain.includes(merchantDomain.split('.')[0])) {
              matchedMerchantId = merchant.id;
              merchantTemplate = merchant.deeplink_template;
              console.log('[deeplink] Found merchant from DB by base_url:', matchedMerchantId);
              break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (dbError) {
      console.log('[deeplink] DB lookup failed, using fallback');
    }
    
    // 2. DB 매칭 실패 시 도메인 매핑으로 Fallback
    if (!matchedMerchantId) {
      matchedMerchantId = extractMerchantIdFromDomain(product_url);
      if (matchedMerchantId && MERCHANT_TEMPLATES[matchedMerchantId]) {
        merchantTemplate = MERCHANT_TEMPLATES[matchedMerchantId];
        console.log('[deeplink] Using fallback template for:', matchedMerchantId);
      }
    }

    // 3. 머천트 템플릿이 있으면 바로 사용
    if (merchantTemplate && matchedMerchantId) {
      const affiliateUrl = merchantTemplate
        .replace('{affiliate_id}', affiliateId)
        .replace('{encoded_url}', encodedUrl)
        .replace('{url}', encodedUrl);
      
      console.log('[deeplink] Generated affiliate URL via template:', affiliateUrl);

      return new Response(
        JSON.stringify({
          success: true,
          merchant_id: matchedMerchantId,
          merchant_name: merchantName,
          original_url: product_url,
          affiliate_url: affiliateUrl,
          mobile_supported: true,
          source: 'merchant_template'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. LinkPrice API Fallback (알려지지 않은 머천트용)
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
