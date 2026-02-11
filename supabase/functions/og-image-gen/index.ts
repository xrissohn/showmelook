import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

/**
 * og-image-gen Edge Function
 * 
 * Generates a 1200x630 PNG OG image by compositing the original portrait image
 * onto a light gray background (contain fit, centered).
 * No AI costs - pure image manipulation via imagescript.
 * Caches result in storage for subsequent requests.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BG_COLOR = 0xF0F0F0FF; // light gray, RGBA

// 세로를 최대한 활용하여 전신이 크게 보이도록
const SAFE_WIDTH = 800;
const SAFE_HEIGHT = 600;

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

    // 1. Check cache first
    const ogPath = `og/v3/${lookId}.png`;
    const { data: cached } = await supabase.storage
      .from("generated-looks")
      .createSignedUrl(ogPath, 86400);

    if (cached?.signedUrl) {
      // Fetch and return the image directly (Facebook crawlers don't follow 302 redirects for og:image)
      const cachedResp = await fetch(cached.signedUrl);
      if (cachedResp.ok) {
        console.log(`[og-image-gen] Cache hit for ${lookId}`);
        const body = await cachedResp.arrayBuffer();
        return new Response(body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. Get original look image URL
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

    // 3. Resolve signed URL
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

    // 4. Download original image
    console.log(`[og-image-gen] Fetching original for ${lookId}`);
    const imgResp = await fetch(originalUrl);
    if (!imgResp.ok) {
      console.error(`[og-image-gen] Fetch failed: ${imgResp.status}`);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: "https://showmelook.com/og-image.png" },
      });
    }

    const imgBuffer = await imgResp.arrayBuffer();

    // 5. Decode and composite
    const original = await Image.decode(new Uint8Array(imgBuffer));
    const canvas = new Image(OG_WIDTH, OG_HEIGHT);
    canvas.fill(BG_COLOR);

    // 안전 영역(1000x400) 기준 contain-fit → 카카오톡 중앙 크롭에도 전신 보임
    const scale = Math.min(SAFE_WIDTH / original.width, SAFE_HEIGHT / original.height);
    const newW = Math.round(original.width * scale);
    const newH = Math.round(original.height * scale);
    const resized = original.resize(newW, newH);

    // 캔버스 중앙 배치 (안전 영역 안에 전신이 들어감)
    const offsetX = Math.round((OG_WIDTH - newW) / 2);
    const offsetY = Math.round((OG_HEIGHT - newH) / 2);
    canvas.composite(resized, offsetX, offsetY);

    // 6. Encode as PNG
    const pngBytes = await canvas.encode(1); // PNG format

    // 7. Cache to storage (fire-and-forget)
    supabase.storage
      .from("generated-looks")
      .upload(ogPath, pngBytes, {
        contentType: "image/png",
        upsert: true,
      })
      .then(({ error: uploadErr }) => {
        if (uploadErr) console.error(`[og-image-gen] Cache upload failed:`, uploadErr);
        else console.log(`[og-image-gen] Cached OG image for ${lookId}`);
      });

    console.log(`[og-image-gen] Generated PNG ${OG_WIDTH}x${OG_HEIGHT} for ${lookId}`);

    return new Response(pngBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
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
