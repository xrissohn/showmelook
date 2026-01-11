import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 최근 7일간의 프롬프트를 분석
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('Fetching recent prompts from recommendation_history...');
    
    const { data: recentPrompts, error: promptsError } = await supabaseAdmin
      .from('recommendation_history')
      .select('prompt, gender, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError);
      throw promptsError;
    }

    console.log(`Found ${recentPrompts?.length || 0} recent prompts`);

    // 프롬프트가 충분하지 않으면 전체 기간에서 가져옴
    let allPrompts = recentPrompts || [];
    if (allPrompts.length < 10) {
      const { data: morePrompts } = await supabaseAdmin
        .from('recommendation_history')
        .select('prompt, gender, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      allPrompts = morePrompts || [];
      console.log(`Extended to ${allPrompts.length} prompts from all time`);
    }

    // 프롬프트 빈도 계산
    const promptCounts: Record<string, { count: number; lastUsed: string }> = {};
    for (const p of allPrompts) {
      const prompt = p.prompt.trim();
      if (!promptCounts[prompt]) {
        promptCounts[prompt] = { count: 0, lastUsed: p.created_at };
      }
      promptCounts[prompt].count++;
      if (p.created_at > promptCounts[prompt].lastUsed) {
        promptCounts[prompt].lastUsed = p.created_at;
      }
    }

    // 상위 프롬프트 추출
    const topPrompts = Object.entries(promptCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([prompt, data]) => `${prompt} (${data.count}회)`);

    console.log('Top prompts:', topPrompts);

    // AI로 트렌드 키워드 분석
    const analysisPrompt = `당신은 패션 트렌드 분석가입니다. 아래는 사용자들이 최근 스타일 추천 서비스에서 많이 검색한 프롬프트 목록입니다.

최근 인기 검색어:
${topPrompts.join('\n')}

이 데이터를 분석하여, 사용자들에게 추천할 만한 6개의 트렌드 키워드를 생성해주세요.

요구사항:
1. 각 키워드는 한국어로 작성
2. 이모지 + 짧은 키워드(5-8자) + 상세 설명(15-25자) 형식
3. 실제 인기 있는 검색 패턴을 반영
4. 계절감이나 TPO(시간, 장소, 상황)를 고려
5. 다양한 스타일 카테고리를 포함

반드시 아래 JSON 형식으로만 응답하세요:
{
  "keywords": [
    {"emoji": "☕", "text": "카페 데이트룩", "desc": "여유로운 분위기의 데이트에 어울리는 편안한 코디"},
    ...
  ]
}`;

    console.log('Calling Lovable AI for trend analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', content);

    // JSON 파싱 (마크다운 코드블록 제거)
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.slice(7);
    }
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', cleanContent);
      // 폴백: 기본 키워드 반환
      parsedResult = {
        keywords: [
          { emoji: '☕', text: '편안한 카페 데이트룩', desc: '여유로운 분위기의 데이트에 어울리는 편안한 코디' },
          { emoji: '💼', text: '캐주얼 오피스룩', desc: '격식과 편안함을 동시에 잡는 스마트 캐주얼' },
          { emoji: '🌸', text: '봄나들이 페미닌 코디', desc: '화사하고 로맨틱한 봄 시즌 스타일' },
          { emoji: '🖤', text: '모던 시크 룩', desc: '세련되고 도시적인 올블랙 베이스 스타일' },
          { emoji: '🏃', text: '스포티 캐주얼', desc: '활동적이면서도 스타일리시한 애슬레저 룩' },
          { emoji: '✨', text: '파티 글램 룩', desc: '특별한 날을 위한 화려하고 섹시한 스타일' },
        ]
      };
    }

    console.log('Returning trend keywords:', parsedResult.keywords?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        keywords: parsedResult.keywords || [],
        analyzedCount: allPrompts.length,
        lastUpdated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-trends:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        // 에러 시에도 기본 키워드 제공
        keywords: [
          { emoji: '☕', text: '편안한 카페 데이트룩', desc: '여유로운 분위기의 데이트에 어울리는 편안한 코디' },
          { emoji: '💼', text: '캐주얼 오피스룩', desc: '격식과 편안함을 동시에 잡는 스마트 캐주얼' },
          { emoji: '🌸', text: '봄나들이 페미닌 코디', desc: '화사하고 로맨틱한 봄 시즌 스타일' },
          { emoji: '🖤', text: '모던 시크 룩', desc: '세련되고 도시적인 올블랙 베이스 스타일' },
          { emoji: '🏃', text: '스포티 캐주얼', desc: '활동적이면서도 스타일리시한 애슬레저 룩' },
          { emoji: '✨', text: '파티 글램 룩', desc: '특별한 날을 위한 화려하고 섹시한 스타일' },
        ]
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
