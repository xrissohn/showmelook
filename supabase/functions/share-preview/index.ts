import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * share-preview Edge Function
 * 
 * This function serves HTML with proper OG meta tags for social media crawlers.
 * When KakaoTalk, Facebook, Twitter, etc. fetch the shared URL, they get proper
 * server-rendered meta tags instead of relying on JavaScript.
 * 
 * Usage: https://showmelook.com/api/share/{lookId}
 * or via the Edge Function URL directly
 */

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
    const pageUrl = `https://showmelook.com/look/${lookId}`;

    if (look && !error) {
      // Get signed URL for the image
      if (look.image_url && look.image_url.includes("generated-looks/")) {
        const path = look.image_url.split("generated-looks/").pop();
        if (path) {
          const { data: signedData } = await supabase.storage
            .from("generated-looks")
            .createSignedUrl(path, 86400); // 24 hours
          if (signedData?.signedUrl) {
            imageUrl = signedData.signedUrl;
          }
        }
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

    // For crawlers, return HTML with proper meta tags
    if (isCrawler) {
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="쇼미룩 ShowMeLook">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Redirect to actual page after a short delay (for crawlers that execute JS) -->
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <p>Redirecting to <a href="${pageUrl}">${title}</a>...</p>
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
