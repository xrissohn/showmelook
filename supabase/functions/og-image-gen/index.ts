import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * og-image-gen Edge Function
 * 
 * Generates a 1200x630 landscape OG image from a portrait look image.
 * Caches the result in storage for subsequent requests.
 * Used by share-preview for KakaoTalk/Facebook/Twitter OG meta tags.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 1. Check if cached OG version exists
    const ogPath = `og/${lookId}.png`;
    const { data: existingFiles } = await supabase.storage
      .from("generated-looks")
      .list("og", { search: `${lookId}.png`, limit: 1 });

    if (existingFiles && existingFiles.length > 0 && existingFiles[0].name === `${lookId}.png`) {
      console.log(`[og-image-gen] Serving cached OG image for ${lookId}`);
      // Fetch and return cached image
      const { data: fileData } = await supabase.storage
        .from("generated-looks")
        .download(ogPath);
      
      if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        return new Response(new Uint8Array(arrayBuffer), {
          headers: {
            ...corsHeaders,
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. Get original look image
    const { data: look, error } = await supabase
      .from("generated_looks")
      .select("image_url")
      .eq("id", lookId)
      .single();

    if (error || !look?.image_url) {
      console.log(`[og-image-gen] Look not found: ${lookId}`);
      // Redirect to default OG image
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: "https://showmelook.com/og-image.png" },
      });
    }

    // 3. Get signed URL for original image
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

    // 4. Use Gemini to create 1200x630 OG image
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[og-image-gen] LOVABLE_API_KEY not found");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: originalUrl },
      });
    }

    console.log(`[og-image-gen] Generating OG image for ${lookId}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "이 전신 패션 사진을 1200x630 픽셀의 가로형 소셜 공유 이미지로 변환해주세요. 반드시 지켜야 할 사항: 1) 인물의 머리부터 발끝까지 전체가 잘리지 않고 모두 보여야 합니다. 2) 인물을 중앙에 배치하고 적절한 여백을 두세요. 3) 배경은 깔끔한 밝은 그레이(#F0F0F0)로 채워주세요. 4) 원본 인물의 비율과 품질을 유지하세요. 5) 정확히 1200x630 해상도로 만들어주세요."
            },
            {
              type: "image_url",
              image_url: { url: originalUrl }
            }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[og-image-gen] Gemini error: ${errorText}`);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: originalUrl },
      });
    }

    const data = await response.json();
    const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) {
      console.error("[og-image-gen] No image in Gemini response");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: originalUrl },
      });
    }

    // 5. Decode and upload to storage
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const imageBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("generated-looks")
      .upload(ogPath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[og-image-gen] Upload error: ${uploadError.message}`);
    } else {
      console.log(`[og-image-gen] Cached OG image at ${ogPath}`);
    }

    // 6. Return image directly
    return new Response(imageBytes, {
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
