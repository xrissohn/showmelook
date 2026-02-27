// analyze-image-positions - AI를 통한 이미지 내 의류 위치 분석
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClothingPosition {
  category: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  confidence: number; // 0-1
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

    const categoryList = categories && categories.length > 0 
      ? categories.join(', ') 
      : '상의, 하의, 아우터, 신발, 가방, 액세서리';

    const prompt = `You are a fashion image analysis expert. Analyze this fashion/outfit image and locate each clothing item or accessory.

For each of these categories: ${categoryList}

Find the CENTER POINT of where that item appears in the image. Return coordinates as percentages:
- x: 0 = left edge, 100 = right edge
- y: 0 = top edge, 100 = bottom edge

POSITIONING GUIDELINES:
- 상의/top: Usually around y=25-35 (upper torso area), x=45-55 (center)
- 아우터/outer: Overlaps with top but slightly wider, y=20-35, x=45-55
- 하의/bottom: Usually around y=55-70 (hip to knee area), x=45-55
- 원피스/dress: Spans from y=30 to y=65, x=45-55
- 신발/shoes: Near bottom y=85-95, x=45-55
- 가방/bag: Often to the side y=40-60, x=20-35 or x=65-80
- 액세서리/accessory: Varies - watches on wrist, necklaces near neck y=15-25
- 모자/hat: Top of image y=5-15, x=45-55

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

    // JSON 파싱
    let positions: ClothingPosition[] = [];
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        positions = JSON.parse(jsonMatch[0]);
        
        // 유효성 검증
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

    // 결과가 없으면 기본 위치 사용
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

// 기본 위치 (AI 분석 실패 시 fallback)
function getDefaultPositions(categories: string[]): ClothingPosition[] {
  const defaults: Record<string, ClothingPosition> = {
    '상의': { category: '상의', x: 50, y: 25, confidence: 0.5 },
    'top': { category: 'top', x: 50, y: 25, confidence: 0.5 },
    '아우터': { category: '아우터', x: 50, y: 20, confidence: 0.5 },
    'outer': { category: 'outer', x: 50, y: 20, confidence: 0.5 },
    '하의': { category: '하의', x: 50, y: 60, confidence: 0.5 },
    'bottom': { category: 'bottom', x: 50, y: 60, confidence: 0.5 },
    '원피스': { category: '원피스', x: 50, y: 45, confidence: 0.5 },
    '신발': { category: '신발', x: 50, y: 90, confidence: 0.5 },
    'shoes': { category: 'shoes', x: 50, y: 90, confidence: 0.5 },
    '가방': { category: '가방', x: 80, y: 50, confidence: 0.5 },
    'bag': { category: 'bag', x: 80, y: 50, confidence: 0.5 },
    '액세서리': { category: '액세서리', x: 20, y: 30, confidence: 0.5 },
    'accessory': { category: 'accessory', x: 20, y: 30, confidence: 0.5 },
  };

  if (categories.length === 0) {
    return [
      defaults['상의'],
      defaults['하의'],
      defaults['신발'],
    ];
  }

  return categories
    .map(cat => defaults[cat] || { category: cat, x: 50, y: 50, confidence: 0.3 })
    .filter((pos, index, self) => 
      index === self.findIndex(p => p.category === pos.category)
    );
}
