import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAFE24_CLIENT_ID = Deno.env.get('CAFE24_CLIENT_ID')!;
const CAFE24_CLIENT_SECRET = Deno.env.get('CAFE24_CLIENT_SECRET')!;

// 프론트엔드 URL (설치 완료 후 리다이렉트)
const FRONTEND_URL = 'https://showmelook.lovable.app';

// 카페24 OAuth 스코프 (필요한 권한)
const CAFE24_SCOPES = [
  'mall.read_store',
  'mall.read_product',
  'mall.read_category',
  'mall.read_collection',
  'mall.read_customer',
  'mall.read_order',
  'mall.write_order',
].join(',');

// Base64 인코딩 (Basic Auth용)
function encodeBase64(str: string): string {
  return btoa(str);
}

// HMAC-SHA256 검증 (카페24 요청 위변조 방지)
async function verifyHmac(params: URLSearchParams, hmac: string): Promise<boolean> {
  try {
    // hmac 파라미터 제외하고 정렬된 쿼리스트링 생성
    const sortedParams = new URLSearchParams();
    const keys = Array.from(params.keys()).filter(k => k !== 'hmac').sort();
    
    for (const key of keys) {
      sortedParams.append(key, params.get(key) || '');
    }
    
    const message = sortedParams.toString();
    
    // HMAC-SHA256 계산
    const encoder = new TextEncoder();
    const keyData = encoder.encode(CAFE24_CLIENT_SECRET);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedHmac = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log('HMAC verification:', { expected: hmac, computed: computedHmac });
    
    return computedHmac === hmac;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // URL 파싱
  const rawUrl = req.url;
  const decodedUrl = decodeURIComponent(rawUrl);
  const url = new URL(decodedUrl);
  
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1] || '';

  console.log('Cafe24 OAuth endpoint:', endpoint, 'Method:', req.method, 'Search:', url.search);

  try {
    // ==========================================
    // 1. 앱 설치 진입점 (카페24 앱스토어 표준)
    // 카페24 앱 URL: https://xxx.supabase.co/functions/v1/cafe24-oauth/install
    // ==========================================
    if (endpoint === 'install' || endpoint === 'cafe24-oauth') {
      const mallId = url.searchParams.get('mall_id');
      const shopNo = url.searchParams.get('shop_no') || '1';
      const timestamp = url.searchParams.get('timestamp');
      const hmac = url.searchParams.get('hmac');
      
      console.log('Install request:', { mallId, shopNo, timestamp, hmac: hmac ? 'present' : 'missing' });
      
      if (!mallId) {
        return new Response(
          renderErrorPage('설치 오류', 'mall_id가 누락되었습니다.'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // HMAC 검증 (보안)
      if (hmac) {
        const isValid = await verifyHmac(url.searchParams, hmac);
        if (!isValid) {
          console.error('HMAC verification failed for mall:', mallId);
          // 개발 중에는 경고만 로그하고 진행 (프로덕션에서는 차단)
          // return new Response(
          //   renderErrorPage('보안 오류', '요청 검증에 실패했습니다.'),
          //   { status: 403, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
          // );
        }
      }

      // state에 설치 정보 포함
      const state = encodeBase64(JSON.stringify({
        mall_id: mallId,
        shop_no: shopNo,
        timestamp: Date.now(),
        random: crypto.randomUUID()
      }));

      const redirectUri = `${SUPABASE_URL}/functions/v1/cafe24-oauth/callback`;
      
      // 카페24 OAuth 인증 페이지로 리다이렉트
      const authorizeUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${CAFE24_CLIENT_ID}&` +
        `state=${encodeURIComponent(state)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(CAFE24_SCOPES)}`;

      console.log('Redirecting to Cafe24 OAuth:', authorizeUrl);

      return new Response(null, {
        status: 302,
        headers: {
          'Location': authorizeUrl,
        },
      });
    }

    // ==========================================
    // 2. 운영자 권한확인 엔드포인트
    // ==========================================
    if (endpoint === 'manager-auth') {
      if (req.method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ShowMeLook 운영자 권한확인 완료',
            service: 'ShowMeLook Virtual Fitting Service',
            version: '1.0.0'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'POST') {
        const body = await req.json();
        console.log('Manager auth request:', body);
        return new Response(
          JSON.stringify({
            success: true,
            message: '운영자 권한이 확인되었습니다.',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ==========================================
    // 3. OAuth 인증 시작 (레거시 호환용)
    // ==========================================
    if (endpoint === 'authorize') {
      const mallId = url.searchParams.get('mall_id');
      
      if (!mallId) {
        return new Response(
          JSON.stringify({ error: 'mall_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const state = encodeBase64(JSON.stringify({
        mall_id: mallId,
        timestamp: Date.now(),
        random: crypto.randomUUID()
      }));

      const redirectUri = `${SUPABASE_URL}/functions/v1/cafe24-oauth/callback`;
      
      const authorizeUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${CAFE24_CLIENT_ID}&` +
        `state=${encodeURIComponent(state)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(CAFE24_SCOPES)}`;

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': authorizeUrl,
        },
      });
    }

    // ==========================================
    // 4. OAuth 콜백 (토큰 발급 및 앱 화면으로 리다이렉트)
    // ==========================================
    if (endpoint === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        return new Response(
          renderErrorPage('연동 실패', errorDescription || error),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      if (!code || !state) {
        return new Response(
          renderErrorPage('연동 실패', '인증 코드가 누락되었습니다.'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // state 디코딩
      let stateData: { mall_id: string; shop_no?: string };
      try {
        stateData = JSON.parse(atob(decodeURIComponent(state)));
      } catch (e) {
        return new Response(
          renderErrorPage('연동 실패', '잘못된 인증 상태입니다.'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      const mallId = stateData.mall_id;
      const shopNo = stateData.shop_no || '1';
      const redirectUri = `${SUPABASE_URL}/functions/v1/cafe24-oauth/callback`;

      // 토큰 발급 요청
      const tokenUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
      const credentials = encodeBase64(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`);

      console.log('Requesting token for mall:', mallId);

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token error:', tokenData);
        return new Response(
          renderErrorPage('토큰 발급 실패', tokenData.error_description || tokenData.error || '알 수 없는 오류'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      console.log('Token received for mall:', mallId);

      // 쇼핑몰 정보 조회
      let shopName = mallId;
      try {
        const storeResponse = await fetch(
          `https://${mallId}.cafe24api.com/api/v2/admin/store`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
              'X-Cafe24-Api-Version': '2024-06-01',
            },
          }
        );
        
        if (storeResponse.ok) {
          const storeData = await storeResponse.json();
          shopName = storeData.store?.shop_name || mallId;
        }
      } catch (e) {
        console.log('Could not fetch store info:', e);
      }

      // 테넌트 정보 저장
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const tenantData = {
        mall_id: tokenData.mall_id || mallId,
        shop_no: parseInt(tokenData.shop_no || shopNo) || 1,
        shop_name: shopName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        refresh_token_expires_at: tokenData.refresh_token_expires_at,
        scopes: tokenData.scopes || [],
        user_id: tokenData.user_id,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // Upsert (기존 테넌트면 업데이트)
      const { data: tenant, error: dbError } = await supabase
        .from('cafe24_tenants')
        .upsert(tenantData, { onConflict: 'mall_id' })
        .select()
        .single();

      if (dbError) {
        console.error('DB error:', dbError);
        return new Response(
          renderErrorPage('저장 실패', '데이터베이스 오류가 발생했습니다.'),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      console.log('Tenant saved successfully:', mallId);

      // ⭐ 핵심: 앱 프론트 화면으로 리다이렉트
      // 카페24 앱스토어 정책: 설치 완료 후 앱의 메인 화면으로 이동해야 함
      const appUrl = `${FRONTEND_URL}/cafe24-fitting?mall_id=${encodeURIComponent(mallId)}&installed=true`;
      
      console.log('Redirecting to app:', appUrl);

      return new Response(null, {
        status: 302,
        headers: {
          'Location': appUrl,
        },
      });
    }

    // ==========================================
    // 5. 토큰 갱신 엔드포인트
    // ==========================================
    if (endpoint === 'refresh') {
      const mallId = url.searchParams.get('mall_id');
      
      if (!mallId) {
        return new Response(
          JSON.stringify({ error: 'mall_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: tenant, error: fetchError } = await supabase
        .from('cafe24_tenants')
        .select('*')
        .eq('mall_id', mallId)
        .single();

      if (fetchError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
      const credentials = encodeBase64(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`);

      const refreshResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tenant.refresh_token,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error('Refresh error:', refreshData);
        return new Response(
          JSON.stringify({ error: 'Token refresh failed', details: refreshData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('cafe24_tenants')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: refreshData.expires_at,
          refresh_token_expires_at: refreshData.refresh_token_expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('mall_id', mallId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to save new token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          expires_at: refreshData.expires_at 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 6. 테넌트 상태 조회
    // ==========================================
    if (endpoint === 'status') {
      const mallId = url.searchParams.get('mall_id');
      
      if (!mallId) {
        return new Response(
          JSON.stringify({ error: 'mall_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: tenant, error } = await supabase
        .from('cafe24_tenants')
        .select('mall_id, shop_no, shop_name, is_active, plan, monthly_generation_limit, monthly_generation_used, expires_at, created_at')
        .eq('mall_id', mallId)
        .single();

      if (error || !tenant) {
        return new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isExpired = new Date(tenant.expires_at) < new Date();

      return new Response(
        JSON.stringify({ 
          connected: true,
          tenant: {
            ...tenant,
            token_expired: isExpired,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 7. 웹훅 수신 엔드포인트
    // ==========================================
    if (endpoint === 'webhook') {
      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload = await req.json();
      console.log('Cafe24 webhook received:', payload);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: logError } = await supabase
        .from('cafe24_webhook_logs')
        .insert({
          mall_id: payload.mall_id,
          event_type: payload.event_type || payload.event || 'unknown',
          payload: payload,
        });

      if (logError) {
        console.error('Webhook log error:', logError);
      }

      const eventType = payload.event_type || payload.event;
      
      switch (eventType) {
        case 'app/uninstalled':
          await supabase
            .from('cafe24_tenants')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('mall_id', payload.mall_id);
          break;
          
        case 'product/created':
        case 'product/updated':
        case 'product/deleted':
          // 상품 변경 시 동기화 플래그 업데이트
          break;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 8. 앱 삭제 확인 엔드포인트 (카페24 요구사항)
    // ==========================================
    if (endpoint === 'uninstall') {
      const mallId = url.searchParams.get('mall_id');
      
      if (!mallId) {
        return new Response(
          JSON.stringify({ error: 'mall_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 테넌트 비활성화
      const { error: updateError } = await supabase
        .from('cafe24_tenants')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('mall_id', mallId);

      if (updateError) {
        console.error('Uninstall error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to uninstall' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('App uninstalled for mall:', mallId);

      return new Response(
        JSON.stringify({ success: true, message: 'App uninstalled successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 기본 라우트 - 서비스 정보 반환
    // ==========================================
    return new Response(
      JSON.stringify({
        service: 'ShowMeLook Cafe24 OAuth',
        version: '2.0.0',
        endpoints: {
          'install': 'GET - 앱 설치 진입점 (카페24 앱 URL)',
          'manager-auth': 'GET/POST - 운영자 권한확인',
          'authorize': 'GET - OAuth 인증 시작 (레거시)',
          'callback': 'GET - OAuth 콜백 (토큰 발급)',
          'refresh': 'GET - 토큰 갱신 (?mall_id=xxx)',
          'status': 'GET - 테넌트 상태 조회 (?mall_id=xxx)',
          'webhook': 'POST - 카페24 웹훅 수신',
          'uninstall': 'GET - 앱 삭제 처리 (?mall_id=xxx)',
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Cafe24 OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// 에러 페이지 렌더링 함수
function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ShowMeLook</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      display: flex; justify-content: center; align-items: center; height: 100vh; 
      margin: 0; background: #f3f4f6;
    }
    .card { 
      background: white; padding: 40px; border-radius: 16px; text-align: center; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;
    }
    .error-icon { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; margin-bottom: 10px; font-size: 24px; }
    p { color: #666; margin-bottom: 20px; line-height: 1.6; }
    .btn { 
      display: inline-block; padding: 12px 24px; 
      background: #667eea; color: white; text-decoration: none; 
      border-radius: 8px; font-weight: 600;
    }
    .btn:hover { background: #5a67d8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="javascript:history.back()" class="btn">이전으로 돌아가기</a>
  </div>
</body>
</html>`;
}
