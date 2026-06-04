import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// 허용 도메인 목록
const ALLOWED_ORIGINS = [
  'https://showmelook.lovable.app',
  'https://id-preview--3a817bf4-1535-4b1d-98d6-75ea63d8e05b.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin === o) ||
    /\.cafe24\.com$/.test(new URL(origin || 'https://x').hostname) ||
    /\.cafe24api\.com$/.test(new URL(origin || 'https://x').hostname);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAFE24_CLIENT_ID = Deno.env.get('CAFE24_CLIENT_ID')!;
const CAFE24_CLIENT_SECRET = Deno.env.get('CAFE24_CLIENT_SECRET')!;

const FRONTEND_URL = 'https://showmelook.lovable.app';

// 카페24 OAuth 스코프 - 가상피팅 + 구매등급제 연동에 필요한 권한
const CAFE24_SCOPES = [
  'mall.read_store',       // 쇼핑몰 기본 정보
  'mall.read_product',     // 상품 정보 (피팅 대상)
  'mall.read_category',    // 카테고리 조회
  'mall.read_customer',    // 회원 정보 (구매등급 매칭)
  'mall.read_order',       // 주문/구매 이력 (등급 산정)
].join(',');

function encodeBase64(str: string): string {
  return btoa(str);
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// HMAC-SHA256 검증
async function verifyHmac(params: URLSearchParams, hmac: string): Promise<boolean> {
  try {
    const sortedParams = new URLSearchParams();
    const keys = Array.from(params.keys()).filter(k => k !== 'hmac').sort();
    for (const key of keys) {
      sortedParams.append(key, params.get(key) || '');
    }
    const message = sortedParams.toString();

    const encoder = new TextEncoder();
    const keyData = encoder.encode(CAFE24_CLIENT_SECRET);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedHmac = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHmac === hmac;
  } catch (error) {
    console.error('HMAC verification failed');
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rawUrl = req.url;
  const decodedUrl = decodeURIComponent(rawUrl);
  const url = new URL(decodedUrl);

  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1] || '';

  console.log('Cafe24 OAuth endpoint:', endpoint, 'Method:', req.method);

  try {
    // ==========================================
    // 1. 앱 설치 진입점
    // ==========================================
    if (endpoint === 'install' || endpoint === 'cafe24-oauth') {
      const mallId = url.searchParams.get('mall_id');
      const shopNo = url.searchParams.get('shop_no') || '1';
      const hmac = url.searchParams.get('hmac');

      if (!mallId) {
        return new Response(
          renderErrorPage('설치 오류', 'mall_id가 누락되었습니다.'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // HMAC 검증 — Cafe24 설치 진입점은 반드시 서명을 요구한다
      // (CAFE24_SKIP_HMAC=true 환경변수가 설정된 테스트 환경에서만 우회 가능)
      const skipHmac = Deno.env.get('CAFE24_SKIP_HMAC') === 'true';
      if (!skipHmac) {
        if (!hmac) {
          console.error('HMAC missing for mall:', mallId);
          return new Response(
            renderErrorPage('인증 실패', 'HMAC 서명이 누락되었습니다.'),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        const isValid = await verifyHmac(url.searchParams, hmac);
        if (!isValid) {
          console.error('HMAC verification FAILED for mall:', mallId);
          return new Response(
            renderErrorPage('인증 실패', 'HMAC 서명이 일치하지 않습니다.'),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      }

      const state = encodeBase64(JSON.stringify({
        mall_id: mallId,
        shop_no: shopNo,
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
        headers: { 'Location': authorizeUrl },
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
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'POST') {
        const body = await req.json();
        return new Response(
          JSON.stringify({ success: true, message: '운영자 권한이 확인되었습니다.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        headers: { ...corsHeaders, 'Location': authorizeUrl },
      });
    }

    // ==========================================
    // 4. OAuth 콜백
    // ==========================================
    if (endpoint === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error);
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

      const tokenUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
      const credentials = encodeBase64(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`);

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
        console.error('Token exchange failed');
        return new Response(
          renderErrorPage('토큰 발급 실패', tokenData.error_description || tokenData.error || '알 수 없는 오류'),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

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
        // 쇼핑몰 정보 조회 실패 시 mallId 사용
      }

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

      const { data: tenant, error: dbError } = await supabase
        .from('cafe24_tenants')
        .upsert(tenantData, { onConflict: 'mall_id' })
        .select()
        .single();

      if (dbError) {
        console.error('DB save failed');
        return new Response(
          renderErrorPage('저장 실패', '데이터베이스 오류가 발생했습니다.'),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      const appUrl = `${FRONTEND_URL}/cafe24-fitting?mall_id=${encodeURIComponent(mallId)}&installed=true`;

      return new Response(null, {
        status: 302,
        headers: { 'Location': appUrl },
      });
    }

    // ==========================================
    // 5. 토큰 갱신
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
        console.error('Token refresh failed');
        return new Response(
          JSON.stringify({ error: 'Token refresh failed' }),
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
        return new Response(
          JSON.stringify({ error: 'Failed to save new token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, expires_at: refreshData.expires_at }),
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
        JSON.stringify({ connected: true, tenant: { ...tenant, token_expired: isExpired } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 7. 웹훅 수신
    // ==========================================
    if (endpoint === 'webhook') {
      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Cafe24 webhook HMAC-SHA256 검증 (raw body 기반)
      const rawBody = await req.text();
      const providedHmac =
        req.headers.get('x-cafe24-hmac-sha256') ||
        req.headers.get('X-Cafe24-Hmac-Sha256') ||
        req.headers.get('x-hmac-sha256');

      const skipHmac = Deno.env.get('CAFE24_SKIP_HMAC') === 'true';
      if (!skipHmac) {
        if (!providedHmac) {
          console.error('Cafe24 webhook missing HMAC header');
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        try {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(CAFE24_CLIENT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
          const expected = encodeBase64(new Uint8Array(sig));
          if (expected !== providedHmac) {
            console.error('Cafe24 webhook HMAC mismatch');
            return new Response(
              JSON.stringify({ error: 'Forbidden' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('Cafe24 webhook HMAC verification error:', e);
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      let payload: any = {};
      try { payload = JSON.parse(rawBody); } catch (_) { payload = {}; }

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
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 8. 앱 삭제 확인
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
      const { error: updateError } = await supabase
        .from('cafe24_tenants')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('mall_id', mallId);

      if (updateError) {
        console.error('Uninstall error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to uninstall' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 기본 라우트 - 404
    // ==========================================
    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cafe24 OAuth error');
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// 에러 페이지 렌더링 (XSS 방지 적용)
function renderErrorPage(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - ShowMeLook</title>
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
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="javascript:history.back()" class="btn">이전으로 돌아가기</a>
  </div>
</body>
</html>`;
}
