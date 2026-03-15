// analyze-product-colors v2 - AI 이미지 색상 분석 (병렬 처리)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// 표준 색상 카테고리
const STANDARD_COLORS = [
  'white', 'ivory', 'cream', 'beige', 'oatmeal',
  'brown', 'tan', 'camel', 'mocha', 'wheat', 'sand',
  'black', 'charcoal', 'gray', 'silver',
  'navy', 'blue', 'skyblue', 'denim blue',
  'red', 'burgundy', 'wine', 'coral', 'pink', 'rose',
  'orange', 'peach',
  'yellow', 'gold', 'mustard',
  'green', 'olive', 'khaki', 'mint', 'sage',
  'purple', 'lavender', 'lilac',
  'multicolor',
];

// 비표준 색상 → 표준 매핑
const COLOR_NORMALIZE: Record<string, string> = {
  'grey': 'gray', 'dark blue': 'navy', 'light blue': 'skyblue',
  'off-white': 'ivory', 'dark green': 'olive', 'light green': 'mint',
  'dark red': 'burgundy', 'light pink': 'pink', 'forest': 'green',
  'emerald': 'green', 'salmon': 'coral', 'plum': 'purple',
  'violet': 'purple', 'lemon': 'yellow', 'apricot': 'orange',
  'denim': 'denim blue', 'pattern': 'multicolor', 'print': 'multicolor',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { batchSize = 20, dryRun = false } = await req.json();
    const effectiveBatchSize = Math.min(batchSize, 50);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // color_family가 unknown인 상품 조회 (여유분 확보)
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, color, image_url, category, dna_meta')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .not('dna_meta', 'is', null)
      .order('collected_at', { ascending: false })
      .limit(effectiveBatchSize * 3);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);

    // unknown 색상만 필터링
    const unknownProducts = (products || []).filter(p => {
      const cf = (p as any).dna_meta?.color_family;
      if (!cf) return true;
      if (Array.isArray(cf)) return cf.length === 0 || cf.every((c: string) => c === 'unknown');
      return cf === 'unknown';
    }).slice(0, effectiveBatchSize);

    console.log(`[analyze-colors] Found ${unknownProducts.length} products with unknown color (dryRun: ${dryRun})`);

    if (unknownProducts.length === 0) {
      return new Response(JSON.stringify({
        success: true, message: 'No products with unknown color found',
        processed: 0, updated: 0, failed: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];
    let updated = 0;

    // 병렬 처리 (5개씩)
    const CONCURRENCY = 5;
    for (let i = 0; i < unknownProducts.length; i += CONCURRENCY) {
      const batch = unknownProducts.slice(i, i + CONCURRENCY);
      
      const promises = batch.map(async (product: any) => {
        try {
          if (!product.image_url || product.image_url.includes('placeholder')) {
            return { id: product.id, name: product.name, oldColor: 'unknown', newColor: 'unknown', success: false, error: 'No valid image' };
          }

          const finalColors = await analyzeImageColor(product, LOVABLE_API_KEY!);

          if (finalColors[0] !== 'unknown' && !dryRun) {
            const updatedMeta = {
              ...(product as any).dna_meta,
              color_family: finalColors,
              color_analyzed_at: new Date().toISOString(),
            };

            const { error: updateError } = await supabase
              .from('products_cache')
              .update({ dna_meta: updatedMeta, color: finalColors.join(', ') })
              .eq('id', product.id);

            if (updateError) {
              return { id: product.id, name: product.name, oldColor: 'unknown', newColor: finalColors.join(', '), success: false, error: `DB: ${updateError.message}` };
            }
            updated++;
            return { id: product.id, name: product.name, oldColor: 'unknown', newColor: finalColors.join(', '), success: true };
          }

          return {
            id: product.id, name: product.name, oldColor: 'unknown',
            newColor: finalColors.join(', '),
            success: finalColors[0] !== 'unknown',
            error: dryRun ? 'Dry run' : undefined,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[analyze-colors] Error ${product.id}:`, msg);
          return { id: product.id, name: product.name, oldColor: 'unknown', newColor: 'unknown', success: false, error: msg };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Rate limit 방지: 배치 간 800ms 대기
      if (i + CONCURRENCY < unknownProducts.length) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    // 통계 집계
    const colorCounts: Record<string, number> = {};
    results.filter(r => r.success && r.newColor !== 'unknown').forEach(r => {
      const colors = r.newColor.split(', ');
      colors.forEach((c: string) => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
    });

    const elapsed = Date.now() - startTime;
    console.log(`[analyze-colors] Done in ${elapsed}ms: ${updated} updated, ${results.filter(r => !r.success).length} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      updated,
      failed: results.filter(r => !r.success).length,
      colorDistribution: colorCounts,
      results: results.slice(0, 50),
      dryRun,
      elapsed: `${elapsed}ms`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-colors] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeImageColor(product: any, apiKey: string): Promise<string[]> {
  const prompt = `Analyze this product image. Return ONLY the 1-2 main colors from this list:
${STANDARD_COLORS.join(', ')}

Rules:
- Return the most dominant color(s) only
- For denim, use "denim blue"  
- For metallic jewelry, use "silver" or "gold"
- For many colors/patterns, use "multicolor"
- Return ONLY color words separated by commas

Product name hint: ${(product.name || '').substring(0, 60)}
Category: ${product.category || ''}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: product.image_url } },
        ],
      }],
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit');
    throw new Error(`AI error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';

  // 색상 파싱
  const detected: string[] = [];
  const added = new Set<string>();

  for (const part of raw.split(',').map((s: string) => s.trim()).filter(Boolean)) {
    // 표준 색상 직접 매칭
    for (const std of STANDARD_COLORS) {
      if (part.includes(std) && !added.has(std)) {
        detected.push(std);
        added.add(std);
        break;
      }
    }
    // 비표준 → 표준 매핑
    if (!added.has(part)) {
      for (const [key, val] of Object.entries(COLOR_NORMALIZE)) {
        if (part.includes(key) && !added.has(val)) {
          detected.push(val);
          added.add(val);
          break;
        }
      }
    }
  }

  const result = detected.length > 0 ? detected.slice(0, 3) : ['unknown'];
  console.log(`[analyze-colors] ${(product.name || '').substring(0, 25)}: "${raw}" → [${result.join(', ')}]`);
  return result;
}
