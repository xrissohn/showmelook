import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ==========================================
    // 1. 위젯 SDK 제공
    // ==========================================
    if (endpoint === 'sdk.js') {
      const mallId = url.searchParams.get('mall_id');
      
const sdkCode = `
(function() {
  'use strict';
  
  window.ShowMeLook = window.ShowMeLook || {};
  
  const APP_BASE_URL = 'https://showmelook.lovable.app';
  const WIDGET_BASE_URL = '${SUPABASE_URL}/functions/v1/cafe24-widget';
  const MALL_ID = '${mallId || ''}';
  
  // 가상피팅 위젯 초기화
  ShowMeLook.init = function(options) {
    console.log('ShowMeLook widget initialized', options);
    this.options = options || {};
    this.mallId = options.mallId || MALL_ID;
  };
  
  // 가상피팅 버튼 생성
  ShowMeLook.createButton = function(productNo, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found:', containerId);
      return;
    }
    
    const button = document.createElement('button');
    button.className = 'showmelook-fitting-btn';
    button.innerHTML = '<span style="margin-right:6px">👗</span> 가상 피팅해보기';
    button.style.cssText = \`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    \`;
    
    button.onmouseover = function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };
    button.onmouseout = function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';
    };
    
    button.onclick = function() {
      ShowMeLook.openFitting(productNo);
    };
    
    container.appendChild(button);
  };
  
  // 가상피팅 모달 열기 (프론트엔드 앱으로 연결)
  ShowMeLook.openFitting = function(productNo) {
    const modal = document.createElement('div');
    modal.id = 'showmelook-modal';
    modal.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    \`;
    
    const iframe = document.createElement('iframe');
    // 프론트엔드 앱 라우트로 연결 (Edge Function HTML 대신)
    iframe.src = APP_BASE_URL + '/cafe24-fitting?mall_id=' + encodeURIComponent(this.mallId) + '&product_no=' + productNo;
    iframe.style.cssText = \`
      width: 90%;
      max-width: 500px;
      height: 85vh;
      border: none;
      border-radius: 16px;
      background: white;
    \`;
    
    modal.appendChild(iframe);
    
    modal.onclick = function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    };
    
    document.body.appendChild(modal);
  };
  
  // 피팅 모달 닫기
  ShowMeLook.closeFitting = function() {
    const modal = document.getElementById('showmelook-modal');
    if (modal) modal.remove();
  };
  
  console.log('ShowMeLook SDK loaded');
})();
      `;

      return new Response(sdkCode, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ==========================================
    // 2. 피팅 세션 생성
    // ==========================================
    if (endpoint === 'create-session') {
      const { mall_id, product_no, customer_id } = await req.json();

      if (!mall_id || !product_no) {
        return new Response(
          JSON.stringify({ error: 'mall_id and product_no are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 테넌트 확인 및 사용량 체크
      const { data: tenant, error: tenantError } = await supabase
        .from('cafe24_tenants')
        .select('*')
        .eq('mall_id', mall_id)
        .eq('is_active', true)
        .single();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 월간 사용량 체크
      if (tenant.monthly_generation_used >= tenant.monthly_generation_limit) {
        return new Response(
          JSON.stringify({ 
            error: 'Monthly generation limit exceeded',
            limit: tenant.monthly_generation_limit,
            used: tenant.monthly_generation_used,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 세션 토큰 생성
      const sessionToken = crypto.randomUUID();

      // 세션 저장
      const { data: session, error: sessionError } = await supabase
        .from('cafe24_fitting_sessions')
        .insert({
          tenant_id: tenant.id,
          cafe24_product_no: product_no,
          session_token: sessionToken,
          customer_id: customer_id || null,
        })
        .select()
        .single();

      if (sessionError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          session_token: sessionToken,
          fitting_url: `${SUPABASE_URL}/functions/v1/cafe24-widget/fitting-page?session=${sessionToken}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // 3. 피팅 페이지 (iframe용)
    // ==========================================
    if (endpoint === 'fitting-page') {
      const mallId = url.searchParams.get('mall_id');
      const productNo = url.searchParams.get('product_no');
      const sessionToken = url.searchParams.get('session');

      const fittingPageHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShowMeLook 가상피팅</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: white;
      padding: 16px 24px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }
    .main {
      flex: 1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .upload-area {
      background: white;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      max-width: 500px;
      width: 100%;
    }
    .upload-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h2 { color: #333; margin-bottom: 10px; }
    p { color: #666; margin-bottom: 20px; }
    .upload-btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .upload-btn:hover { transform: translateY(-2px); }
    .product-info {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #888;
    }
    input[type="file"] { display: none; }
    .preview-area {
      display: none;
      margin-top: 20px;
    }
    .preview-area img {
      max-width: 100%;
      max-height: 300px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ShowMeLook</div>
    <button class="close-btn" onclick="parent.ShowMeLook && parent.ShowMeLook.closeFitting()">×</button>
  </div>
  
  <div class="main">
    <div class="upload-area">
      <div class="upload-icon">📸</div>
      <h2>나만의 가상 피팅</h2>
      <p>사진을 업로드하면 상품을 입은 모습을 확인할 수 있어요</p>
      
      <label class="upload-btn">
        사진 선택하기
        <input type="file" id="photo-input" accept="image/*">
      </label>
      
      <div class="preview-area" id="preview-area">
        <img id="preview-image" src="" alt="Preview">
      </div>
      
      <div class="product-info">
        상품번호: ${productNo || 'N/A'}<br>
        쇼핑몰: ${mallId || 'N/A'}
      </div>
    </div>
  </div>

  <script>
    const photoInput = document.getElementById('photo-input');
    const previewArea = document.getElementById('preview-area');
    const previewImage = document.getElementById('preview-image');
    
    const generateBtn = document.createElement('button');
    generateBtn.id = 'generate-btn';
    generateBtn.textContent = '가상 피팅 시작';
    generateBtn.style.cssText = \`
      display: none;
      margin-top: 20px;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    \`;
    document.querySelector('.upload-area').appendChild(generateBtn);
    
    const resultArea = document.createElement('div');
    resultArea.id = 'result-area';
    resultArea.style.cssText = 'display: none; margin-top: 20px; text-align: center;';
    document.querySelector('.upload-area').appendChild(resultArea);

    let uploadedImageBase64 = null;

    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          previewImage.src = e.target.result;
          previewArea.style.display = 'block';
          generateBtn.style.display = 'inline-block';
          uploadedImageBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    generateBtn.addEventListener('click', async function() {
      if (!uploadedImageBase64) return;
      
      generateBtn.disabled = true;
      generateBtn.textContent = '생성 중...';
      
      try {
        // generate-style API 호출
        const response = await fetch('${SUPABASE_URL}/functions/v1/generate-style', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            style: 'casual',
            products: 'virtual fitting with cafe24 product',
            userProfile: {
              gender: 'female',
              height: 165,
              body_type: 'average',
            },
            userAvatarUrl: uploadedImageBase64,
            useFaceComposite: true,
          }),
        });
        
        const data = await response.json();
        
        if (data.imageUrl) {
          resultArea.innerHTML = \`
            <h3 style="color:#333;margin-bottom:10px;">🎉 피팅 완료!</h3>
            <img src="\${data.imageUrl}" style="max-width:100%;max-height:400px;border-radius:8px;margin-bottom:10px;">
            <p style="color:#666;font-size:14px;">이미지를 저장하려면 우클릭하세요</p>
          \`;
          resultArea.style.display = 'block';
          
          // 결과 저장 (세션 토큰이 있는 경우)
          const sessionToken = new URLSearchParams(window.location.search).get('session');
          if (sessionToken) {
            await fetch('${SUPABASE_URL}/functions/v1/cafe24-widget/save-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_token: sessionToken,
                fitting_result_url: data.imageUrl,
              }),
            });
          }
        } else {
          resultArea.innerHTML = '<p style="color:red;">피팅 생성에 실패했습니다: ' + (data.error || '알 수 없는 오류') + '</p>';
          resultArea.style.display = 'block';
        }
      } catch (error) {
        resultArea.innerHTML = '<p style="color:red;">오류: ' + error.message + '</p>';
        resultArea.style.display = 'block';
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '가상 피팅 시작';
      }
    });
  </script>
</body>
</html>
      `;

      return new Response(fittingPageHtml, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // ==========================================
    // 4. 피팅 결과 저장
    // ==========================================
    if (endpoint === 'save-result') {
      const { session_token, fitting_result_url } = await req.json();

      if (!session_token || !fitting_result_url) {
        return new Response(
          JSON.stringify({ error: 'session_token and fitting_result_url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 세션 업데이트
      const { data: session, error: sessionError } = await supabase
        .from('cafe24_fitting_sessions')
        .update({
          fitting_result_url: fitting_result_url,
          completed_at: new Date().toISOString(),
        })
        .eq('session_token', session_token)
        .select('tenant_id')
        .single();

      if (sessionError) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 테넌트 사용량 증가
      await supabase.rpc('increment_cafe24_usage', { tenant_id: session.tenant_id });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 기본 응답
    return new Response(
      JSON.stringify({
        service: 'ShowMeLook Cafe24 Widget',
        endpoints: {
          'sdk.js': 'GET - 위젯 SDK 스크립트',
          'create-session': 'POST - 피팅 세션 생성',
          'fitting-page': 'GET - 피팅 페이지 (iframe)',
          'save-result': 'POST - 피팅 결과 저장',
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cafe24 widget error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
