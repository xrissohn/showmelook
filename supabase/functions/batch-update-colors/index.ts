import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 유효한 color_family 값 목록
const VALID_COLOR_FAMILIES = [
  "white", "black", "gray", "charcoal",
  "navy", "blue", "denim blue",
  "beige", "cream", "ivory", "oatmeal",
  "brown", "camel", "mocha", "tan",
  "red", "wine", "burgundy", "coral",
  "pink", "lavender",
  "green", "olive", "khaki", "mint",
  "yellow", "gold", "mustard",
  "orange",
  "purple",
  "silver",
  "sand", "wheat",
  "multicolor",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 인증 확인 (admin만 실행 가능)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .single();
        if (!roleData) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 20, 50); // 최대 50개
    const dryRun = body.dryRun || false;

    // color_family가 unknown인 상품 조회
    const { data: products, error: fetchError } = await supabase
      .from("products_cache")
      .select("id, name, brand, color, image_url, dna_meta, category, sub_category")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .not("dna_meta", "is", null)
      .order("collected_at", { ascending: false })
      .limit(batchSize * 3); // 여유분 확보

    if (fetchError) throw fetchError;

    // unknown color_family만 필터링
    const unknownProducts = (products || []).filter((p: any) => {
      const cf = p.dna_meta?.color_family;
      if (!cf) return true;
      if (Array.isArray(cf)) return cf.length === 0 || cf.every((c: string) => c === "unknown");
      return cf === "unknown";
    }).slice(0, batchSize);

    if (unknownProducts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No products with unknown colors found",
          processed: 0,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[batch-update-colors] Processing ${unknownProducts.length} products (dryRun: ${dryRun})`);

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    // 병렬 처리 (5개씩)
    const CONCURRENCY = 5;
    for (let i = 0; i < unknownProducts.length; i += CONCURRENCY) {
      const batch = unknownProducts.slice(i, i + CONCURRENCY);
      
      const promises = batch.map(async (product: any) => {
        try {
          const colorResult = await analyzeProductColor(
            product,
            LOVABLE_API_KEY
          );

          if (colorResult && colorResult.length > 0 && !dryRun) {
            // dna_meta 업데이트
            const updatedMeta = { ...product.dna_meta, color_family: colorResult };
            
            const { error: updateError } = await supabase
              .from("products_cache")
              .update({ 
                dna_meta: updatedMeta,
                color: colorResult.join(", "),
              })
              .eq("id", product.id);

            if (updateError) {
              console.error(`[batch-update-colors] Update failed for ${product.id}:`, updateError.message);
              failCount++;
              return { id: product.id, name: product.name, status: "update_failed", error: updateError.message };
            }

            successCount++;
            return { id: product.id, name: product.name, status: "updated", colors: colorResult };
          } else if (colorResult && colorResult.length > 0) {
            successCount++;
            return { id: product.id, name: product.name, status: "dry_run", colors: colorResult };
          } else {
            failCount++;
            return { id: product.id, name: product.name, status: "no_color_detected" };
          }
        } catch (err) {
          failCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[batch-update-colors] Error for ${product.id}:`, errMsg);
          return { id: product.id, name: product.name, status: "error", error: errMsg };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Rate limit 방지: 배치 간 1초 대기
      if (i + CONCURRENCY < unknownProducts.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 남은 unknown 개수 조회
    const { count: remainingCount } = await supabase
      .from("products_cache")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .not("image_url", "is", null)
      .not("dna_meta", "is", null);

    const elapsed = Date.now() - startTime;
    console.log(`[batch-update-colors] Done in ${elapsed}ms: ${successCount} success, ${failCount} fail`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: unknownProducts.length,
        successCount,
        failCount,
        elapsed: `${elapsed}ms`,
        dryRun,
        remaining: remainingCount || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[batch-update-colors] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeProductColor(
  product: any,
  apiKey: string
): Promise<string[] | null> {
  const imageUrl = product.image_url;
  if (!imageUrl) return null;

  // 상품명과 color 필드에서 힌트 추출
  const nameHint = product.name || "";
  const colorHint = product.color || "";
  const categoryHint = product.category || "";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a product color analyzer. Given a product image, identify the main color(s) of the product.

Return ONLY a JSON array of color names from this allowed list:
${VALID_COLOR_FAMILIES.join(", ")}

Rules:
- Return 1-2 main colors only (the most dominant colors)
- If the product has a clear single color, return just that one
- If it has two distinct colors (e.g. two-tone), return both
- For denim products, use "denim blue"
- For metallic jewelry, use "silver" or "gold"
- For products with many colors/patterns, use "multicolor"
- Return ONLY the JSON array, nothing else

Example outputs:
["black"]
["navy", "white"]
["cream"]
["multicolor"]`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Product: ${nameHint}\nCategory: ${categoryHint}\nExisting color info: ${colorHint}\n\nWhat are the main colors of this product?`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content?.trim();

  if (!text) return null;

  try {
    // JSON 추출
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;

    const colors: string[] = JSON.parse(jsonMatch[0]);
    
    // 유효한 색상만 필터링
    const validColors = colors
      .map((c: string) => c.toLowerCase().trim())
      .filter((c: string) => VALID_COLOR_FAMILIES.includes(c));

    return validColors.length > 0 ? validColors : null;
  } catch {
    console.log(`[batch-update-colors] Parse failed for ${product.id}: ${text}`);
    return null;
  }
}
