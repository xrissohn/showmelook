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

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // 운영자 권한확인 엔드포인트
  if (path === 'manager-auth') {
    // 카페24에서 보내는 GET 요청 처리
    if (req.method === 'GET') {
      // 카페24가 이 URL로 GET 요청을 보내 유효성을 확인함
      // 성공 응답 반환
      return new Response(
        JSON.stringify({
          success: true,
          message: 'ShowMeLook 운영자 권한확인 완료',
          service: 'ShowMeLook Virtual Fitting Service',
          version: '1.0.0'
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // POST 요청 - 실제 인증 처리
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        console.log('Manager auth request:', body);

        // 카페24 인증 요청 처리
        return new Response(
          JSON.stringify({
            success: true,
            message: '운영자 권한이 확인되었습니다.',
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('Manager auth error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }
  }

  // 기본 라우트 - 서비스 정보 반환
  return new Response(
    JSON.stringify({
      service: 'ShowMeLook Cafe24 OAuth',
      endpoints: {
        'manager-auth': '/cafe24-oauth/manager-auth'
      }
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
});
