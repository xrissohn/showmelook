import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// 쿠팡 파트너스 HMAC-SHA256 서명 생성
async function generateCoupangHmacSignature(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const [path, query = ""] = url.split("?");
  
  // GMT 시간 형식: yyMMdd'T'HHmmss'Z'
  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(2); // YYMMDDTHHmmssZ 형식
  
  const message = datetime + method + path + query;
  
  // HMAC-SHA256 서명 생성
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${hexSignature}`;
}

// 쿠팡 파트너스 딥링크 API 호출
async function convertCoupangToDeeplink(productUrl: string, subId?: string): Promise<{
  success: boolean;
  shortenUrl?: string;
  landingUrl?: string;
  error?: string;
}> {
  const accessKey = Deno.env.get('COUPANG_ACCESS_KEY');
  const secretKey = Deno.env.get('COUPANG_SECRET_KEY');
  
  if (!accessKey || !secretKey) {
    console.error('[deeplink] Coupang API keys not configured');
    return { success: false, error: 'Coupang API keys not configured' };
  }
  
  const apiPath = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
  const authorization = await generateCoupangHmacSignature("POST", apiPath, accessKey, secretKey);
  
  try {
    const response = await fetch(`https://api-gateway.coupang.com${apiPath}`, {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coupangUrls: [productUrl],
        subId: subId || undefined,
      }),
    });
    
    const data = await response.json();
    console.log('[deeplink] Coupang API response:', JSON.stringify(data));
    
    if (data.rCode === "0" && data.data && data.data.length > 0) {
      return {
        success: true,
        shortenUrl: data.data[0].shortenUrl,
        landingUrl: data.data[0].landingUrl,
      };
    }
    
    return { 
      success: false, 
      error: data.rMessage || 'Coupang API failed' 
    };
  } catch (error) {
    console.error('[deeplink] Coupang API error:', error);
    return { success: false, error: String(error) };
  }
}

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

// 머천트 딥링크 템플릿 (DB 조회 실패 시 Fallback) - LinkPrice API 형식 사용
const MERCHANT_TEMPLATES: Record<string, string> = {
  'paulsmith': 'https://click.linkprice.com/click.php?m=paulsmith&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'posty': 'https://click.linkprice.com/click.php?m=posty&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'stories': 'https://click.linkprice.com/click.php?m=stories&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'arket': 'https://click.linkprice.com/click.php?m=arket&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'benetton1': 'https://click.linkprice.com/click.php?m=benetton1&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'wconcept': 'https://click.linkprice.com/click.php?m=wconcept&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'hfashion': 'https://click.linkprice.com/click.php?m=hfashion&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'jestina': 'https://click.linkprice.com/click.php?m=jestina&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'stockx': 'https://click.linkprice.com/click.php?m=stockx&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
  'kream': 'https://click.linkprice.com/click.php?m=kream&a={affiliate_id}&l=9999&l_cd1=3&l_cd2=q&tu={encoded_url}&lpinfo={tracking_id}',
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

// Tracking ID 생성 (user_id 앞 8자리 + timestamp + random)
function generateTrackingId(userId: string | null): string {
  const userPart = userId ? userId.slice(0, 8) : 'anon';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${userPart}_${timestamp}_${random}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Parse request body
    const { product_url, force_api, product_id, product_name, product_price } = await req.json();

    if (!product_url) {
      return new Response(
        JSON.stringify({ error: 'product_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user from JWT token (optional - deeplinks work for guests too, but purchase_intents require auth)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      try {
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        if (!claimsError && claimsData?.claims?.sub) {
          userId = claimsData.claims.sub as string;
          console.log('[deeplink] Authenticated user:', userId);
        }
      } catch (authError) {
        console.log('[deeplink] Token validation failed, proceeding as guest:', authError);
      }
    }

    console.log('[deeplink] Converting product URL:', product_url, 'userId:', userId, 'force_api:', force_api);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 쿠팡 제휴 링크인지 확인 (이미 유효한 딥링크)
    if (product_url.includes('link.coupang.com') || product_url.includes('coupa.ng')) {
      console.log('[deeplink] Already a Coupang affiliate link, returning as-is');
      return new Response(
        JSON.stringify({
          success: true,
          merchant_id: 'coupang',
          merchant_name: 'coupang',
          original_url: product_url,
          affiliate_url: product_url,
          mobile_supported: true,
          source: 'coupang_direct'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 쿠팡 일반 URL인 경우 -> 쿠팡 파트너스 딥링크 API 사용
    if (product_url.includes('coupang.com')) {
      console.log('[deeplink] Coupang product URL detected, converting via Partners API');
      
      // Tracking ID 생성 (subId로 사용)
      const trackingId = userId ? generateTrackingId(userId) : undefined;
      
      const coupangResult = await convertCoupangToDeeplink(product_url, trackingId);
      
      if (coupangResult.success && coupangResult.shortenUrl) {
        console.log('[deeplink] Coupang deeplink generated:', coupangResult.shortenUrl);
        
        // userId가 있으면 purchase_intents에 기록
        if (userId && trackingId) {
          try {
            await supabase
              .from('purchase_intents')
              .insert({
                tracking_id: trackingId,
                user_id: userId,
                product_id: product_id || null,
                merchant_id: 'coupang',
                product_url: product_url,
                product_name: product_name || null,
                product_price: product_price || 0,
                clicked_at: new Date().toISOString(),
                status: 'pending',
                confirmation_status: 'pending',
              });
            console.log('[deeplink] Recorded purchase intent for Coupang:', trackingId);
          } catch (intentError) {
            console.error('[deeplink] Failed to record purchase intent:', intentError);
          }
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            merchant_id: 'coupang',
            merchant_name: 'coupang',
            original_url: product_url,
            affiliate_url: coupangResult.shortenUrl,
            landing_url: coupangResult.landingUrl,
            tracking_id: trackingId,
            mobile_supported: true,
            source: 'coupang_partners_api'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('[deeplink] Coupang deeplink conversion failed:', coupangResult.error);
        return new Response(
          JSON.stringify({
            error: 'Coupang deeplink conversion failed',
            message: coupangResult.error,
            original_url: product_url
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
    
    // Tracking ID 생성 (userId가 있을 경우)
    let trackingId: string | null = null;
    if (userId) {
      trackingId = generateTrackingId(userId);
      console.log('[deeplink] Generated tracking_id:', trackingId);
    }
    
    // force_api=true인 경우 API만 사용
    if (force_api) {
      console.log('[deeplink] Force API mode - skipping template');
    }
    
    // 1. DB에서 모든 머천트를 조회하여 base_url로 매칭 (force_api가 아닌 경우)
    let merchantTemplate: string | null = null;
    let matchedMerchantId: string | null = null;
    
    if (!force_api) {
      try {
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
    }
    
    // 2. DB 매칭 실패 시 도메인 매핑으로 Fallback (force_api가 아닌 경우)
    if (!force_api && !matchedMerchantId) {
      matchedMerchantId = extractMerchantIdFromDomain(product_url);
      if (matchedMerchantId && MERCHANT_TEMPLATES[matchedMerchantId]) {
        merchantTemplate = MERCHANT_TEMPLATES[matchedMerchantId];
        console.log('[deeplink] Using fallback template for:', matchedMerchantId);
      }
    }

    // 3. 머천트 템플릿이 있으면 바로 사용 (force_api가 아닌 경우)
    if (!force_api && merchantTemplate && matchedMerchantId) {
      let affiliateUrl = merchantTemplate
        .replace('{affiliate_id}', affiliateId)
        .replace('{encoded_url}', encodedUrl)
        .replace('{url}', encodedUrl)
        .replace('{tracking_id}', trackingId || '');
      
      // tracking_id가 없으면 lpinfo 파라미터 제거
      if (!trackingId) {
        affiliateUrl = affiliateUrl.replace('&lpinfo=', '');
      }
      
      console.log('[deeplink] Generated affiliate URL via template:', affiliateUrl);

      // 4. userId가 있으면 purchase_intents에 기록
      if (userId && trackingId) {
        try {
          await supabase
            .from('purchase_intents')
            .insert({
              tracking_id: trackingId,
              user_id: userId,
              product_id: product_id || null,
              merchant_id: matchedMerchantId,
              product_url: product_url,
              product_name: product_name || null,
              product_price: product_price || 0,
              clicked_at: new Date().toISOString(),
              status: 'pending',
              confirmation_status: 'pending',
            });
          console.log('[deeplink] Recorded purchase intent:', trackingId);
        } catch (intentError) {
          console.error('[deeplink] Failed to record purchase intent:', intentError);
          // 기록 실패해도 딥링크는 정상 반환
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          merchant_id: matchedMerchantId,
          merchant_name: merchantName,
          original_url: product_url,
          affiliate_url: affiliateUrl,
          tracking_id: trackingId,
          mobile_supported: true,
          source: 'merchant_template'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. LinkPrice API Fallback (알려지지 않은 머천트용)
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

    // API 결과에 lpinfo 추가 (가능한 경우)
    let finalAffiliateUrl = linkPriceData.url;
    if (trackingId && finalAffiliateUrl) {
      finalAffiliateUrl = finalAffiliateUrl.includes('?') 
        ? `${finalAffiliateUrl}&lpinfo=${trackingId}`
        : `${finalAffiliateUrl}?lpinfo=${trackingId}`;
    }

    // userId가 있으면 purchase_intents에 기록
    if (userId && trackingId) {
      try {
        await supabase
          .from('purchase_intents')
          .insert({
            tracking_id: trackingId,
            user_id: userId,
            product_id: product_id || null,
            merchant_id: merchantName,
            product_url: product_url,
            product_name: product_name || null,
            product_price: product_price || 0,
            clicked_at: new Date().toISOString(),
            status: 'pending',
            confirmation_status: 'pending',
          });
        console.log('[deeplink] Recorded purchase intent (API):', trackingId);
      } catch (intentError) {
        console.error('[deeplink] Failed to record purchase intent:', intentError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        merchant_name: merchantName,
        original_url: product_url,
        affiliate_url: finalAffiliateUrl,
        tracking_id: trackingId,
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
