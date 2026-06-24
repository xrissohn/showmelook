import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    let userId: string | undefined;
    const { data: userData } = await supabase.auth.getUser(token);
    userId = userData?.user?.id;
    if (!userId) {
      const { data: claimsData } = await supabase.auth.getClaims(token);
      userId = claimsData?.claims?.sub;
    }
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const match = image_data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid image data format. Expected data:image/*;base64,..." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = match[1];
    const base64Data = match[2];

    if (base64Data.length > 7_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Image too large. Max 5MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-style-image] Analyzing image (${mimeType}, ${Math.round(base64Data.length / 1024)}KB base64) with gemini-2.5-flash`);

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
            content: `너는 패션 스타일 분석 전문가야. 사용자가 보내는 패션 사진에서 **의류/신발/가방/액세서리만** 분석해.

중요 규칙:
1. 사진 속 인물의 외모, 얼굴, 체형, 피부색, 헤어스타일 등 신체적 특징은 절대 언급하지 마.
2. 오직 착용한 의류와 패션 아이템만 분석해.
3. 각 아이템의 카테고리, 색상, 소재, 핏, 패턴을 최대한 구체적으로 파악해.
4. 전체적인 스타일 컨셉, 계절감, TPO도 판단해.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 포함하지 마:
{
  "items": [
    { "type": "top|bottom|outer|shoes|bag|accessory|set", "category": "구체적 카테고리", "color": "주요 색상", "material": "추정 소재", "fit": "핏/실루엣", "pattern": "패턴" }
  ],
  "overallStyle": "전체 스타일 컨셉",
  "season": "적합한 계절",
  "tpo": "적합한 TPO",
  "searchPrompt": "의류 아이템 정보만으로 구성된 2-3문장의 한국어 스타일 설명. 인물 외모 묘사 절대 불포함."
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 사진에서 착용한 패션 아이템들을 분석해줘. 각 아이템을 개별적으로 식별하고, 카테고리/색상/소재/핏/패턴을 구체적으로 파악해줘. 인물의 외모는 무시하고 의류만 분석해. JSON 형식으로만 응답해.",
              },
              {
                type: "image_url",
                image_url: { url: image_data },
              },
            ],
          },
        ],
        max_tokens: 1200,
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
    const textContent = result.choices?.[0]?.message?.content?.trim();

    if (!textContent) {
      console.error("[analyze-style-image] Empty AI response:", JSON.stringify(result).slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "AI가 스타일을 분석하지 못했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // JSON 추출: ```json ... ``` 블록 또는 { ... } 직접 파싱
    let analysisData;
    try {
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) throw new Error("No JSON found");
      analysisData = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.log(`[analyze-style-image] JSON parse failed, using text fallback: ${textContent.slice(0, 200)}`);
      // 텍스트 폴백: 구조화 실패 시 텍스트 그대로 반환
      return new Response(
        JSON.stringify({
          success: true,
          description: textContent,
          searchPrompt: textContent,
          items: [],
          overallStyle: "",
          season: "",
          tpo: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-style-image] Structured: ${analysisData.items?.length || 0} items, style: ${analysisData.overallStyle}`);

    return new Response(
      JSON.stringify({
        success: true,
        description: analysisData.searchPrompt || textContent,
        searchPrompt: analysisData.searchPrompt || textContent,
        items: analysisData.items || [],
        overallStyle: analysisData.overallStyle || "",
        season: analysisData.season || "",
        tpo: analysisData.tpo || "",
      }),
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
