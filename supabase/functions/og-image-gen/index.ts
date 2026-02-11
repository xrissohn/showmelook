import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * og-image-gen Edge Function
 * 
 * Generates a 1200x630 OG image by embedding the original portrait image
 * inside an SVG with a light gray background (contain fit).
 * Returns PNG-like result via SVG rasterization workaround.
 * 
 * Since KakaoTalk doesn't support SVG og:image, we use a direct approach:
 * fetch original image → encode as base64 → embed in SVG → return as SVG
 * with a fallback to redirect to the original image URL.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lookId = url.searchParams.get("lookId");

    if (!lookId) {
      return new Response("Missing lookId", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get original look image URL
    const { data: look, error } = await supabase
      .from("generated_looks")
      .select("image_url")
      .eq("id", lookId)
      .single();

    if (error || !look?.image_url) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: "https://showmelook.com/og-image.png" },
      });
    }

    // 2. Resolve signed URL
    let originalUrl = look.image_url;
    if (look.image_url.includes("generated-looks/")) {
      const path = look.image_url.split("generated-looks/").pop();
      if (path) {
        const { data: signed } = await supabase.storage
          .from("generated-looks")
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) originalUrl = signed.signedUrl;
      }
    }

    // 3. Download original image and convert to base64
    console.log(`[og-image-gen] Fetching original for ${lookId}`);
    const imgResp = await fetch(originalUrl);
    if (!imgResp.ok) {
      console.error(`[og-image-gen] Fetch failed: ${imgResp.status}`);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: originalUrl },
      });
    }

    const contentType = imgResp.headers.get("content-type") || "image/png";
    const imgBuffer = await imgResp.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    
    // Convert to base64
    let binary = "";
    for (let i = 0; i < imgBytes.length; i++) {
      binary += String.fromCharCode(imgBytes[i]);
    }
    const base64 = btoa(binary);
    const dataUri = `data:${contentType};base64,${base64}`;

    // 4. Build SVG with the image centered (contain fit)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F0F0F0"/>
  <image href="${dataUri}" x="0" y="0" width="${OG_WIDTH}" height="${OG_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

    console.log(`[og-image-gen] Generated SVG for ${lookId}`);

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("[og-image-gen] Error:", error);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: "https://showmelook.com/og-image.png" },
    });
  }
});
