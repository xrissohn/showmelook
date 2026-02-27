// analyze-image-positions - AI를 통한 이미지 내 의류 위치 분석 (Few-shot 학습 포함)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClothingPosition {
  category: string;
  x: number;
  y: number;
  confidence: number;
}

interface TagCorrection {
  category: string;
  ai_x: number;
  ai_y: number;
  manual_x: number;
  manual_y: number;
}

// 카테고리별 보정 통계를 집계
function aggregateCorrections(corrections: TagCorrection[]): Map<string, { count: number; avg_offset_x: number; avg_offset_y: number; examples: string[] }> {
  const byCategory = new Map<string, TagCorrection[]>();
  for (const c of corrections) {
    const list = byCategory.get(c.category) || [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  const result = new Map<string, { count: number; avg_offset_x: number; avg_offset_y: number; examples: string[] }>();
  for (const [cat, items] of byCategory) {
    const avg_offset_x = items.reduce((s, i) => s + (i.manual_x - i.ai_x), 0) / items.length;
    const avg_offset_y = items.reduce((s, i) => s + (i.manual_y - i.ai_y), 0) / items.length;
    const examples = items.slice(0, 3).map(i =>
      `AI(${Math.round(i.ai_x)},${Math.round(i.ai_y)})→유저(${Math.round(i.manual_x)},${Math.round(i.manual_y)})`
    );
    result.set(cat, { count: items.length, avg_offset_x: Math.round(avg_offset_x * 10) / 10, avg_offset_y: Math.round(avg_offset_y * 10) / 10, examples });
  }
  return result;
}

// Few-shot 프롬프트 생성
function buildFewShotPrompt(stats: Map<string, { count: number; avg_offset_x: number; avg_offset_y: number; examples: string[] }>): string {
  if (stats.size === 0) return '';

  let prompt = `\n\nIMPORTANT CALIBRATION DATA from user corrections (apply these offsets to improve accuracy):\n`;
  for (const [cat, stat] of stats) {
    const direction_x = stat.avg_offset_x > 0 ? '오른쪽' : '왼쪽';
    const direction_y = stat.avg_offset_y > 0 ? '아래' : '위';
    prompt += `- ${cat}: Users corrected AI positions by avg (${stat.avg_offset_x > 0 ? '+' : ''}${stat.avg_offset_x}%, ${stat.avg_offset_y > 0 ? '+' : ''}${stat.avg_offset_y}%) → shift ${Math.abs(stat.avg_offset_x)}% ${direction_x}, ${Math.abs(stat.avg_offset_y)}% ${direction_y} (${stat.count}건, e.g. ${stat.examples[0]})\n`;
  }
  prompt += `Use these corrections to place tags more accurately.\n`;
  return prompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_url, categories } = await req.json();

    if (!image_url) {
      return new Response(JSON.stringify({ error: 'image_url is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[analyze-image-positions] LOVABLE_API_KEY not found');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'API key not configured',
        positions: getDefaultPositions(categories || [])
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Few-shot: tag_corrections에서 최근 보정 데이터 조회
    let fewShotPrompt = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: corrections, error } = await supabase
        .from('tag_corrections')
        .select('category, ai_x, ai_y, manual_x, manual_y')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && corrections && corrections.length > 0) {
        const stats = aggregateCorrections(corrections as TagCorrection[]);
        fewShotPrompt = buildFewShotPrompt(stats);
        console.log(`[analyze-image-positions] Few-shot: ${corrections.length} corrections across ${stats.size} categories`);
      } else {
        console.log(`[analyze-image-positions] No correction data yet, using base prompt`);
      }
    } catch (e) {
      console.warn('[analyze-image-positions] Failed to fetch corrections, continuing without few-shot:', e);
    }

    const categoryList = categories && categories.length > 0 
      ? categories.join(', ') 
      : '상의, 하의, 아우터, 신발, 가방, 숄더백, 크로스백, 쇼퍼백, 지갑, 액세서리, 귀걸이, 펜던트, 모자, 장갑, 원피스, 점프수트';

    const prompt = `You are a fashion image analysis expert. Analyze this fashion/outfit image and locate each clothing item or accessory.

For each of these categories: ${categoryList}

Find the CENTER POINT of where that item appears in the image. Return coordinates as percentages:
- x: 0 = left edge, 100 = right edge
- y: 0 = top edge, 100 = bottom edge

POSITIONING GUIDELINES (coordinates are percentage of image dimensions):
- 상의/top/티셔츠/니트: Upper torso area, y=25-35, x=45-55 (center)
- 아우터/outer/재킷/코트/점퍼/패딩: Overlaps with top, y=20-35, x=45-55
- 하의/bottom/바지/스커트: Hip to knee area, y=55-70, x=45-55
- 원피스/점프수트/dress: Full body garment, y=35-50, x=45-55
- 신발/shoes/운동화/스니커즈/샌들/로퍼/부츠: Near bottom of image, y=85-95, x=45-55
- 가방/숄더백/크로스백/쇼퍼백/백팩: Usually to the side, y=40-60, x=20-35
- 지갑/wallet: Small item near hand, y=50-65, x=65-80
- 귀걸이/earring: Near ears, y=8-15, x=30-40 or x=60-70
- 펜던트/necklace/목걸이: Near neck/chest, y=15-25, x=45-55
- 장갑/gloves: Near hands, y=55-70, x=15-30 or x=70-85
- 액세서리/시계/팔찌/반지: Varies, watches on wrist y=50-65
- 모자/hat/cap/버킷햇/비니/헤어: VERY TOP of image, y=2-10, x=45-55
- 마스크/mask/바라클라바/넥워머: Below the face/chin area, y=15-22, x=45-55
${fewShotPrompt}
IMPORTANT: 
- Only include items that are CLEARLY VISIBLE in the image
- Be precise - aim for the exact center of each visible item
- confidence should be 0.9+ if clearly visible, 0.5-0.8 if partially visible

Respond with ONLY a JSON array, no other text:
[{"category": "상의", "x": 50, "y": 30, "confidence": 0.95}]`;

    console.log(`[analyze-image-positions] Analyzing image: ${image_url.substring(0, 50)}...`);

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
            role: 'system',
            content: 'You are an expert at analyzing fashion images and identifying the precise pixel locations of clothing items. Always respond with only valid JSON arrays.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image_url } }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-image-positions] API error:', errorText);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to analyze image',
        positions: getDefaultPositions(categories || [])
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`[analyze-image-positions] AI response: ${content.substring(0, 200)}`);

    let positions: ClothingPosition[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        positions = JSON.parse(jsonMatch[0]);
        positions = positions.filter(p => 
          p.category && 
          typeof p.x === 'number' && 
          typeof p.y === 'number' &&
          p.x >= 0 && p.x <= 100 &&
          p.y >= 0 && p.y <= 100
        ).map(p => ({
          ...p,
          confidence: p.confidence || 0.8
        }));
      }
    } catch (parseError) {
      console.error('[analyze-image-positions] JSON parse error:', parseError);
    }

    if (positions.length === 0) {
      positions = getDefaultPositions(categories || []);
    }

    console.log(`[analyze-image-positions] Found ${positions.length} positions`);

    return new Response(JSON.stringify({ 
      success: true,
      positions,
      analyzed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-image-positions] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      positions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getDefaultPositions(categories: string[]): ClothingPosition[] {
  const defaults: Record<string, ClothingPosition> = {
    '상의': { category: '상의', x: 50, y: 30, confidence: 0.5 },
    'top': { category: 'top', x: 50, y: 30, confidence: 0.5 },
    '아우터': { category: '아우터', x: 50, y: 28, confidence: 0.5 },
    'outer': { category: 'outer', x: 50, y: 28, confidence: 0.5 },
    '재킷': { category: '재킷', x: 50, y: 28, confidence: 0.5 },
    '하의': { category: '하의', x: 50, y: 62, confidence: 0.5 },
    'bottom': { category: 'bottom', x: 50, y: 62, confidence: 0.5 },
    '원피스': { category: '원피스', x: 50, y: 45, confidence: 0.5 },
    '점프수트': { category: '점프수트', x: 50, y: 45, confidence: 0.5 },
    '신발': { category: '신발', x: 50, y: 88, confidence: 0.5 },
    'shoes': { category: 'shoes', x: 50, y: 88, confidence: 0.5 },
    '운동화/스니커즈/슬립온': { category: '운동화/스니커즈/슬립온', x: 50, y: 88, confidence: 0.5 },
    '가방': { category: '가방', x: 25, y: 55, confidence: 0.5 },
    'bag': { category: 'bag', x: 25, y: 55, confidence: 0.5 },
    '숄더백': { category: '숄더백', x: 25, y: 45, confidence: 0.5 },
    '크로스백': { category: '크로스백', x: 25, y: 50, confidence: 0.5 },
    '쇼퍼백': { category: '쇼퍼백', x: 25, y: 50, confidence: 0.5 },
    '지갑': { category: '지갑', x: 75, y: 55, confidence: 0.5 },
    '액세서리': { category: '액세서리', x: 30, y: 20, confidence: 0.5 },
    'accessory': { category: 'accessory', x: 30, y: 20, confidence: 0.5 },
    '귀걸이': { category: '귀걸이', x: 35, y: 12, confidence: 0.5 },
    '펜던트': { category: '펜던트', x: 50, y: 18, confidence: 0.5 },
    '피어싱': { category: '피어싱', x: 38, y: 12, confidence: 0.5 },
    '장갑': { category: '장갑', x: 20, y: 65, confidence: 0.5 },
    '마스크': { category: '마스크', x: 50, y: 18, confidence: 0.5 },
    '모자': { category: '모자', x: 50, y: 5, confidence: 0.5 },
    'hat': { category: 'hat', x: 50, y: 5, confidence: 0.5 },
    '헤어': { category: '헤어', x: 50, y: 5, confidence: 0.5 },
    '패션잡화': { category: '패션잡화', x: 70, y: 50, confidence: 0.5 },
  };

  if (categories.length === 0) {
    return [defaults['상의'], defaults['하의'], defaults['신발']];
  }

  return categories
    .map(cat => defaults[cat] || { category: cat, x: 50, y: 50, confidence: 0.3 })
    .filter((pos, index, self) => index === self.findIndex(p => p.category === pos.category));
}
