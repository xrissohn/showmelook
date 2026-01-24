// analyze-product-colors - AI를 통한 상품 이미지 색상 분석
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 표준 색상 카테고리
const STANDARD_COLORS = [
  'white', 'ivory', 'cream', 'beige', 'brown', 'tan', 'camel',
  'black', 'charcoal', 'gray', 'silver',
  'navy', 'blue', 'skyblue', 'lightblue', 'denim',
  'red', 'burgundy', 'wine', 'coral', 'pink', 'rose', 'salmon',
  'orange', 'peach', 'apricot',
  'yellow', 'gold', 'mustard', 'lemon',
  'green', 'olive', 'khaki', 'mint', 'sage', 'emerald', 'forest',
  'purple', 'lavender', 'violet', 'plum', 'lilac',
  'multicolor', 'pattern', 'print'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 20, dryRun = false } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'LOVABLE_API_KEY not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // color_family가 unknown이고 이미지가 있는 상품 조회
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, image_url, dna_meta')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    // unknown 색상만 필터링 (배열 또는 단일값 모두 처리)
    const unknownColorProducts = products?.filter(p => {
      const colorFamily = p.dna_meta?.color_family;
      if (!colorFamily) return true;
      if (Array.isArray(colorFamily)) {
        return colorFamily.length === 0 || (colorFamily.length === 1 && colorFamily[0] === 'unknown');
      }
      return colorFamily === 'unknown';
    }) || [];

    console.log(`[analyze-colors] Found ${unknownColorProducts.length} products with unknown color`);

    if (unknownColorProducts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No products with unknown color found',
        processed: 0,
        updated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { id: string; name: string; oldColor: string; newColor: string; success: boolean; error?: string }[] = [];
    let updated = 0;

    for (const product of unknownColorProducts) {
      try {
        const imageUrl = product.image_url;
        
        if (!imageUrl || imageUrl.includes('placeholder')) {
          results.push({
            id: product.id,
            name: product.name,
            oldColor: 'unknown',
            newColor: 'unknown',
            success: false,
            error: 'No valid image URL'
          });
          continue;
        }

        console.log(`[analyze-colors] Analyzing: ${product.name.substring(0, 30)}...`);

        // AI로 이미지 색상 분석 - 다중 색상 추출
        const prompt = `Analyze this product image and identify ALL visible colors of the clothing or accessory item.

Return up to 5 colors from this exact list (choose the closest matches):
${STANDARD_COLORS.join(', ')}

Rules:
- List colors in order of prominence (largest area first)
- Include secondary/accent colors if clearly visible
- If it's a pattern (stripes, checks, prints), return "pattern" or "multicolor" as first, then list component colors
- Return ONLY color words separated by commas, nothing else

Example responses: 
- Single color: "navy"
- Two colors: "black, white"
- Pattern: "pattern, navy, cream"`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ],
            max_tokens: 100,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[analyze-colors] AI error for ${product.id}:`, errorText);
          
          if (response.status === 429) {
            // Rate limit - stop processing
            results.push({
              id: product.id,
              name: product.name,
              oldColor: 'unknown',
              newColor: 'unknown',
              success: false,
              error: 'Rate limit reached'
            });
            break;
          }
          
          results.push({
            id: product.id,
            name: product.name,
            oldColor: 'unknown',
            newColor: 'unknown',
            success: false,
            error: `AI API error: ${response.status}`
          });
          continue;
        }

        const aiData = await response.json();
        const rawColor = aiData.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
        
        // 다중 색상 추출 - 콤마로 분리
        const colorMap: Record<string, string> = {
          'grey': 'gray',
          'dark blue': 'navy',
          'light blue': 'skyblue',
          'off-white': 'ivory',
          'dark green': 'forest',
          'light green': 'mint',
          'dark red': 'burgundy',
          'light pink': 'rose',
        };
        
        const detectedColors: string[] = [];
        const addedColors = new Set<string>();
        
        // 콤마로 분리하여 각 색상 처리
        const rawParts = rawColor.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        
        for (const part of rawParts) {
          // 표준 색상 매칭
          for (const stdColor of STANDARD_COLORS) {
            if (part.includes(stdColor) && !addedColors.has(stdColor)) {
              detectedColors.push(stdColor);
              addedColors.add(stdColor);
              break;
            }
          }
          
          // 추가 매핑
          if (!addedColors.has(part)) {
            for (const [key, val] of Object.entries(colorMap)) {
              if (part.includes(key) && !addedColors.has(val)) {
                detectedColors.push(val);
                addedColors.add(val);
                break;
              }
            }
          }
        }

        const finalColors = detectedColors.length > 0 ? detectedColors.slice(0, 5) : ['unknown'];

        console.log(`[analyze-colors] ${product.name.substring(0, 20)}: AI said "${rawColor}" → mapped to [${finalColors.join(', ')}]`);

        if (finalColors[0] !== 'unknown' && !dryRun) {
          // DB 업데이트 - 배열로 저장
          const updatedMeta = {
            ...product.dna_meta,
            color_family: finalColors,
            color_analyzed_at: new Date().toISOString()
          };

          const { error: updateError } = await supabase
            .from('products_cache')
            .update({ 
              dna_meta: updatedMeta,
              dna_generated_at: new Date().toISOString()
            })
            .eq('id', product.id);

          if (updateError) {
            results.push({
              id: product.id,
              name: product.name,
              oldColor: 'unknown',
              newColor: finalColors.join(', '),
              success: false,
              error: `DB update failed: ${updateError.message}`
            });
          } else {
            updated++;
            results.push({
              id: product.id,
              name: product.name,
              oldColor: 'unknown',
              newColor: finalColors.join(', '),
              success: true
            });
          }
        } else {
          results.push({
            id: product.id,
            name: product.name,
            oldColor: 'unknown',
            newColor: finalColors.join(', '),
            success: finalColors[0] !== 'unknown',
            error: dryRun ? 'Dry run - not saved' : undefined
          });
        }

        // Rate limit 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (err) {
        console.error(`[analyze-colors] Error processing ${product.id}:`, err);
        results.push({
          id: product.id,
          name: product.name,
          oldColor: 'unknown',
          newColor: 'unknown',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // 통계 집계
    const colorCounts: Record<string, number> = {};
    results.filter(r => r.success && r.newColor !== 'unknown').forEach(r => {
      colorCounts[r.newColor] = (colorCounts[r.newColor] || 0) + 1;
    });

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      updated,
      failed: results.filter(r => !r.success).length,
      colorDistribution: colorCounts,
      results: results.slice(0, 50), // 상세 결과는 50개까지만
      dryRun
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-colors] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
