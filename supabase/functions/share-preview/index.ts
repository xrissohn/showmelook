import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * share-preview Edge Function
 * 
 * This function serves HTML with proper OG meta tags for social media crawlers.
 * It also handles KakaoTalk in-app browser by providing a redirect UI.
 * 
 * Usage: https://showmelook.com/api/share/{lookId}
 * or via the Edge Function URL directly
 */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lookId = url.searchParams.get("lookId");
    const userAgent = req.headers.get("user-agent") || "";

    // Check if this is a social media crawler
    const isCrawler = /facebookexternalhit|Facebot|Twitterbot|kakaotalk-scrap|bot|crawler|spider|slurp/i.test(userAgent);
    
    // Check if this is KakaoTalk in-app browser (not crawler)
    const isKakaoInApp = /kakaotalk/i.test(userAgent) && !isCrawler;
    
    // Check device type
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);

    if (!lookId) {
      // Redirect to main site if no lookId
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, "Location": "https://showmelook.com" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the look
    const { data: look, error } = await supabase
      .from("generated_looks")
      .select("*")
      .eq("id", lookId)
      .single();

    // Default metadata
    let title = "쇼미룩 AI 스타일 추천";
    let description = "AI가 추천하는 나만의 스타일을 확인해보세요!";
    let imageUrl = "https://showmelook.com/og-image.png";
    let imageWidth = 1200;
    let imageHeight = 630;
    const pageUrl = `https://showmelook.com/look/${lookId}`;

    if (look && !error) {
      // Use og-image-gen to create a proper 1200x630 PNG
      // This prevents KakaoTalk from cropping the portrait image
      if (look.image_url) {
        imageUrl = `${supabaseUrl}/functions/v1/og-image-gen?lookId=${encodeURIComponent(lookId)}`;
        imageWidth = 1200;
        imageHeight = 630;
      }

      // Build description
      if (look.prompt_used) {
        description = look.prompt_used.slice(0, 100);
        if (look.prompt_used.length > 100) {
          description += "...";
        }
      }

      // Add tags
      if (look.tags && look.tags.length > 0) {
        const tagStr = look.tags.slice(0, 3).map((t: string) => `#${t}`).join(" ");
        description += ` ${tagStr}`;
      }
    }

    // For KakaoTalk in-app browser, return HTML with redirect options
    if (isKakaoInApp) {
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #fff;
    }
    .container {
      max-width: 360px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: rgba(212, 175, 55, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 40px;
      height: 40px;
      color: #d4af37;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .desc {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
      margin-bottom: 32px;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: transform 0.2s, opacity 0.2s;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn-primary {
      background: linear-gradient(135deg, #d4af37 0%, #c4a030 100%);
      color: #1a1a2e;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .btn-ghost {
      background: transparent;
      color: rgba(255,255,255,0.5);
    }
    .hint {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-top: 8px;
    }
    .preview-img {
      width: 100%;
      max-width: 200px;
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .toast.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    ${look ? `<img src="${escapeHtml(imageUrl)}" alt="스타일 미리보기" class="preview-img" onerror="this.style.display='none'">` : ''}
    
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
    </div>
    
    <h1>외부 브라우저에서 열기</h1>
    <p class="desc">
      카카오톡 내 브라우저에서는<br>
      일부 기능이 제한됩니다.<br>
      더 나은 경험을 위해 외부 브라우저로 열어주세요.
    </p>
    
    <div class="buttons">
      ${isAndroid ? `
        <a href="intent://${pageUrl.replace('https://', '')}#Intent;scheme=https;package=com.android.chrome;end" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Chrome에서 열기
        </a>
      ` : ''}
      
      <button onclick="copyLink()" class="btn ${isIOS ? 'btn-primary' : 'btn-secondary'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        링크 복사하기
      </button>
      
      ${isIOS ? '<p class="hint">링크를 복사한 후 Safari에서 붙여넣기 해주세요</p>' : ''}
      
      <a href="${escapeHtml(pageUrl)}" class="btn btn-ghost">이대로 보기</a>
    </div>
  </div>
  
  <div id="toast" class="toast">링크가 복사되었습니다!</div>
  
  <script>
    function copyLink() {
      const url = ${JSON.stringify(pageUrl)};
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
          showToast();
        }).catch(function() {
          fallbackCopy(url);
        });
      } else {
        fallbackCopy(url);
      }
    }
    
    function fallbackCopy(text) {
      var textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showToast();
      } catch (err) {
        alert('링크: ' + text);
      }
      document.body.removeChild(textArea);
    }
    
    function showToast() {
      var toast = document.getElementById('toast');
      toast.classList.add('show');
      setTimeout(function() {
        toast.classList.remove('show');
      }, 2000);
    }
  </script>
</body>
</html>`;

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // For crawlers, return HTML with proper meta tags
    if (isCrawler) {
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="${imageWidth}">
  <meta property="og:image:height" content="${imageHeight}">` : ''}
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="쇼미룩 ShowMeLook">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(pageUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}
  
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // For regular users, just redirect to the actual page
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": pageUrl },
    });
  } catch (error) {
    console.error("Error:", error);
    // Fallback redirect
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": "https://showmelook.com" },
    });
  }
});
