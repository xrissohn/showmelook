import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_data } = await req.json();

    if (!image_data || typeof image_data !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "image_data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Extract base64 and mime type
    const match = image_data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid image data format. Expected data:image/*;base64,..." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = match[1];
    const base64Data = match[2];

    // Size check (~5MB limit for base64)
    if (base64Data.length > 7_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Image too large. Max 5MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-style-image] Analyzing image (${mimeType}, ${Math.round(base64Data.length / 1024)}KB base64)`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "너는 패션 스타일 분석 전문가야. 사용자가 보내는 패션 사진을 분석해서 한국어로 스타일을 설명해줘.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 패션 사진의 스타일을 한국어로 자연스럽게 설명해줘. 의류 종류, 색상, 분위기, 계절감, TPO(시간/장소/상황) 등을 포함해서 2-3문장으로 간결하게 작성해줘. 스타일 추천 검색어로 사용할 거야.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image_data,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[analyze-style-image] AI gateway error: ${response.status}`, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI 크레딧이 부족합니다." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "AI 분석 중 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const description = result.choices?.[0]?.message?.content?.trim();

    if (!description) {
      return new Response(
        JSON.stringify({ success: false, error: "AI가 스타일을 분석하지 못했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-style-image] Analysis result: ${description.slice(0, 100)}...`);

    return new Response(
      JSON.stringify({ success: true, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[analyze-style-image] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
