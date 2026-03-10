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

    console.log(`[analyze-style-image] Analyzing image (${mimeType}, ${Math.round(base64Data.length / 1024)}KB base64) with gemini-2.5-pro`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `너는 패션 스타일 분석 전문가야. 사용자가 보내는 패션 사진에서 **의류/신발/가방/액세서리만** 분석해.

중요 규칙:
1. 사진 속 인물의 외모, 얼굴, 체형, 피부색, 헤어스타일 등 신체적 특징은 절대 언급하지 마.
2. 오직 착용한 의류와 패션 아이템만 분석해.
3. 각 아이템의 카테고리, 색상, 소재, 핏, 패턴을 최대한 구체적으로 파악해.
4. 전체적인 스타일 컨셉, 계절감, TPO도 판단해.
5. 분석 결과를 반드시 제공된 함수(analyze_fashion_items)를 호출하여 반환해.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 사진에서 착용한 패션 아이템들을 분석해줘. 각 아이템(상의, 하의, 아우터, 신발, 가방, 액세서리 등)을 개별적으로 식별하고, 카테고리/색상/소재/핏/패턴을 구체적으로 파악해줘. 인물의 외모는 무시하고 의류만 분석해.",
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
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_fashion_items",
              description: "패션 사진에서 식별된 의류 아이템들의 구조화된 분석 결과를 반환합니다.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    description: "식별된 각 패션 아이템 목록",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["top", "bottom", "outer", "shoes", "bag", "accessory", "set"],
                          description: "아이템 유형"
                        },
                        category: {
                          type: "string",
                          description: "구체적 카테고리 (예: 니트/스웨터, 와이드팬츠, 스니커즈, 토트백 등)"
                        },
                        color: {
                          type: "string",
                          description: "주요 색상 (예: 베이지, 인디고블루, 블랙 등)"
                        },
                        material: {
                          type: "string",
                          description: "추정 소재 (예: 울, 데님, 가죽, 면, 폴리에스터 등)"
                        },
                        fit: {
                          type: "string",
                          description: "핏/실루엣 (예: 오버사이즈, 슬림핏, 레귤러, 와이드 등)"
                        },
                        pattern: {
                          type: "string",
                          description: "패턴 (예: 무지, 스트라이프, 체크, 플로럴 등)"
                        }
                      },
                      required: ["type", "category", "color", "material", "fit", "pattern"],
                      additionalProperties: false
                    }
                  },
                  overallStyle: {
                    type: "string",
                    description: "전체 스타일 컨셉 (예: 미니멀 캐주얼, 스트릿, 클래식, 로맨틱 등)"
                  },
                  season: {
                    type: "string",
                    description: "적합한 계절 (예: 봄/여름, 가을/겨울, 사계절 등)"
                  },
                  tpo: {
                    type: "string",
                    description: "적합한 TPO (예: 데일리, 출근, 데이트, 여행 등)"
                  },
                  searchPrompt: {
                    type: "string",
                    description: "의류 아이템 정보만으로 구성된 2-3문장의 한국어 스타일 설명. 인물 외모 묘사는 절대 포함하지 않음. 스타일 추천 검색에 사용됨."
                  }
                },
                required: ["items", "overallStyle", "season", "tpo", "searchPrompt"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_fashion_items" } },
        max_tokens: 800,
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
    
    // Tool calling 응답에서 구조화된 데이터 추출
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== "analyze_fashion_items") {
      // Fallback: 일반 텍스트 응답인 경우
      const textContent = result.choices?.[0]?.message?.content?.trim();
      if (textContent) {
        console.log(`[analyze-style-image] Fallback to text response: ${textContent.slice(0, 100)}...`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            description: textContent,
            searchPrompt: textContent,
            items: [],
            overallStyle: "",
            season: "",
            tpo: ""
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI가 스타일을 분석하지 못했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysisData;
    try {
      analysisData = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("[analyze-style-image] Failed to parse tool call arguments:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: false, error: "분석 결과 파싱에 실패했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-style-image] Structured analysis: ${analysisData.items?.length || 0} items, style: ${analysisData.overallStyle}`);
    console.log(`[analyze-style-image] Search prompt: ${analysisData.searchPrompt?.slice(0, 100)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        description: analysisData.searchPrompt,
        searchPrompt: analysisData.searchPrompt,
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
