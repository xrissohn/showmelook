import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAFE24_CLIENT_ID = Deno.env.get('CAFE24_CLIENT_ID')!;
const CAFE24_CLIENT_SECRET = Deno.env.get('CAFE24_CLIENT_SECRET')!;

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];

  console.log('Cafe24 OAuth endpoint:', endpoint, 'Method:', req.method);

  try {
    // ==========================================
    // 1. 운영자 권한확인 엔드포인트
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
    // 2. OAuth 인증 시작 (앱 설치 시작점)
    // ==========================================
    if (endpoint === 'authorize') {
      const mallId = url.searchParams.get('mall_id');
      
      if (!mallId) {
        return new Response(
          JSON.stringify({ error: 'mall_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // state에 mall_id 포함 (CSRF 방지 및 콜백에서 식별용)
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

      console.log('Redirecting to:', authorizeUrl);

      // 카페24 인증 페이지로 리다이렉트
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': authorizeUrl,
        },
      });
    }

    // ==========================================
    // 3. OAuth 콜백 (토큰 발급)
    // ==========================================
    if (endpoint === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        return new Response(
          `<html><body><h1>연동 실패</h1><p>에러: ${error}</p></body></html>`,
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'Missing code or state' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // state 디코딩
      let stateData: { mall_id: string };
      try {
        stateData = JSON.parse(atob(decodeURIComponent(state)));
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Invalid state' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mallId = stateData.mall_id;
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
          `<html><body><h1>토큰 발급 실패</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`,
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      console.log('Token received for mall:', mallId);

      // 테넌트 정보 저장
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const tenantData = {
        mall_id: tokenData.mall_id,
        shop_no: parseInt(tokenData.shop_no) || 1,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        refresh_token_expires_at: tokenData.refresh_token_expires_at,
        scopes: tokenData.scopes || [],
        user_id: tokenData.user_id,
        is_active: true,
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
          `<html><body><h1>저장 실패</h1><pre>${JSON.stringify(dbError, null, 2)}</pre></body></html>`,
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // 성공 페이지 반환
      return new Response(
        `<!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ShowMeLook 연동 완료</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   display: flex; justify-content: center; align-items: center; height: 100vh; 
                   margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card { background: white; padding: 40px; border-radius: 16px; text-align: center; 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
            h1 { color: #1a1a1a; margin-bottom: 10px; }
            p { color: #666; margin-bottom: 20px; }
            .success { color: #22c55e; font-size: 48px; margin-bottom: 20px; }
            .mall-id { background: #f3f4f6; padding: 10px 20px; border-radius: 8px; 
                       font-family: monospace; font-size: 14px; }
            .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; 
                   background: #667eea; color: white; text-decoration: none; 
                   border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success">✓</div>
            <h1>연동 완료!</h1>
            <p>ShowMeLook 가상피팅 서비스가 연동되었습니다.</p>
            <div class="mall-id">${tokenData.mall_id}</div>
            <a href="https://${tokenData.mall_id}.cafe24.com/admin" class="btn">관리자 페이지로 이동</a>
          </div>
        </body>
        </html>`,
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } 
        }
      );
    }

    // ==========================================
    // 4. 토큰 갱신 엔드포인트
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

      // 기존 테넌트 조회
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

      // 토큰 갱신 요청
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

      // 새 토큰 저장
      const { error: updateError } = await supabase
        .from('cafe24_tenants')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: refreshData.expires_at,
          refresh_token_expires_at: refreshData.refresh_token_expires_at,
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
    // 5. 테넌트 상태 조회
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
    // 6. 웹훅 수신 엔드포인트
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

      // 웹훅 로그 저장
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

      // 이벤트 타입별 처리
      const eventType = payload.event_type || payload.event;
      
      switch (eventType) {
        case 'app/uninstalled':
          // 앱 삭제 시 테넌트 비활성화
          await supabase
            .from('cafe24_tenants')
            .update({ is_active: false })
            .eq('mall_id', payload.mall_id);
          break;
          
        case 'product/created':
        case 'product/updated':
        case 'product/deleted':
          // 상품 변경 시 동기화 플래그 업데이트
          // 추후 cafe24-sync 함수에서 처리
          break;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 기본 라우트 - 서비스 정보 반환
    // ==========================================
    return new Response(
      JSON.stringify({
        service: 'ShowMeLook Cafe24 OAuth',
        endpoints: {
          'manager-auth': 'GET/POST - 운영자 권한확인',
          'authorize': 'GET - OAuth 인증 시작 (?mall_id=xxx)',
          'callback': 'GET - OAuth 콜백 (토큰 발급)',
          'refresh': 'GET - 토큰 갱신 (?mall_id=xxx)',
          'status': 'GET - 테넌트 상태 조회 (?mall_id=xxx)',
          'webhook': 'POST - 카페24 웹훅 수신',
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
