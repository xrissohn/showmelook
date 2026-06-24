import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// 공개 위젯 베이스 URL (내부 인프라 URL 대신 사용)
const WIDGET_API_BASE = `${SUPABASE_URL}/functions/v1/cafe24-widget`;
const APP_BASE_URL = 'https://showmelook.lovable.app';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
      const mallIdRaw = url.searchParams.get('mall_id') ?? '';
      if (mallIdRaw && !/^[a-zA-Z0-9_-]{1,50}$/.test(mallIdRaw)) {
        return new Response('Invalid mall_id', { status: 400, headers: corsHeaders });
      }
      const mallId = mallIdRaw;
      
const sdkCode = `
(function() {
  'use strict';
  
  window.ShowMeLook = window.ShowMeLook || {};
  
  var APP_BASE_URL = ${JSON.stringify(APP_BASE_URL)};
  var MALL_ID = ${JSON.stringify(mallId)};
  
  ShowMeLook.init = function(options) {
    this.options = options || {};
    this.mallId = options.mallId || MALL_ID;
  };
  
  ShowMeLook.createButton = function(productNo, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var button = document.createElement('button');
    button.className = 'showmelook-fitting-btn';
    button.innerHTML = '<span style="margin-right:6px">👗</span> 가상 피팅해보기';
    button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;';
    
    button.onmouseover = function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
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
  
  ShowMeLook.openFitting = function(productNo) {
    var modal = document.createElement('div');
    modal.id = 'showmelook-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:999999;';
    
    var iframe = document.createElement('iframe');
    iframe.src = APP_BASE_URL + '/cafe24-fitting?mall_id=' + encodeURIComponent(this.mallId) + '&product_no=' + productNo;
    iframe.style.cssText = 'width:90%;max-width:500px;height:85vh;border:none;border-radius:16px;background:white;';
    
    modal.appendChild(iframe);
    
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };
    
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'showmelook-close') modal.remove();
    });
    
    document.body.appendChild(modal);
  };
  
  ShowMeLook.closeFitting = function() {
    var modal = document.getElementById('showmelook-modal');
    if (modal) modal.remove();
  };
})();
`;

      return new Response(sdkCode, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
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

      if (tenant.monthly_generation_used >= tenant.monthly_generation_limit) {
        return new Response(
          JSON.stringify({ error: 'Monthly generation limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessionToken = crypto.randomUUID();

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
          fitting_url: `${WIDGET_API_BASE}/fitting-page?session=${sessionToken}`,
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

      // HTML 이스케이프
      const safeMallId = (mallId || 'N/A').replace(/[<>&"']/g, '');
      const safeProductNo = (productNo || 'N/A').replace(/[<>&"']/g, '');

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
    .upload-icon { font-size: 64px; margin-bottom: 20px; }
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
    .preview-area { display: none; margin-top: 20px; }
    .preview-area img { max-width: 100%; max-height: 300px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ShowMeLook</div>
    <button class="close-btn" onclick="parent.postMessage({type:'showmelook-close'},'*')">×</button>
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
        상품번호: ${safeProductNo}<br>
        쇼핑몰: ${safeMallId}
      </div>
    </div>
  </div>

  <script>
    var photoInput = document.getElementById('photo-input');
    var previewArea = document.getElementById('preview-area');
    var previewImage = document.getElementById('preview-image');
    
    var generateBtn = document.createElement('button');
    generateBtn.id = 'generate-btn';
    generateBtn.textContent = '가상 피팅 시작';
    generateBtn.style.cssText = 'display:none;margin-top:20px;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;';
    document.querySelector('.upload-area').appendChild(generateBtn);
    
    var resultArea = document.createElement('div');
    resultArea.id = 'result-area';
    resultArea.style.cssText = 'display:none;margin-top:20px;text-align:center;';
    document.querySelector('.upload-area').appendChild(resultArea);

    var uploadedImageBase64 = null;

    photoInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        var reader = new FileReader();
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
        var response = await fetch('${APP_BASE_URL}/api/generate-style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            style: 'casual',
            products: 'virtual fitting with cafe24 product',
            userProfile: { gender: 'female', height: 165, body_type: 'average' },
            userAvatarUrl: uploadedImageBase64,
            useFaceComposite: true,
          }),
        });
        
        var data = await response.json();
        
        if (data.imageUrl) {
          resultArea.innerHTML = '<h3 style="color:#333;margin-bottom:10px;">🎉 피팅 완료!</h3>' +
            '<img src="' + data.imageUrl + '" style="max-width:100%;max-height:400px;border-radius:8px;margin-bottom:10px;">' +
            '<p style="color:#666;font-size:14px;">이미지를 저장하려면 우클릭하세요</p>';
          resultArea.style.display = 'block';
        } else {
          resultArea.innerHTML = '<p style="color:red;">피팅 생성에 실패했습니다.</p>';
          resultArea.style.display = 'block';
        }
      } catch (error) {
        resultArea.innerHTML = '<p style="color:red;">오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>';
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

      await supabase.rpc('increment_cafe24_usage', { tenant_id: session.tenant_id });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 기본 응답 - 404
    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cafe24 widget error');
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
