import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * feedback-collect Edge Function
 * 
 * 사용자의 상품 상호작용을 수집하여 자체 학습 시스템에 활용
 * 
 * 수집 이벤트:
 * - view: 상품 노출
 * - click: 상품 클릭
 * - like: 좋아요
 * - cart: 장바구니 추가
 * - purchase: 구매 완료
 */

interface FeedbackRequest {
  productId: string;
  actionType: 'view' | 'click' | 'like' | 'cart' | 'purchase';
  recommendationId?: string;
  context?: {
    gender?: string;
    occasion?: string;
    concepts?: string[];
    budget?: number;
    position?: number; // 추천 목록에서의 위치
  };
}

interface BatchFeedbackRequest {
  feedbacks: FeedbackRequest[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth header에서 사용자 ID 추출 (익명 사용자도 허용)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    // 익명 사용자는 임시 ID 생성
    if (!userId) {
      userId = `anon_${crypto.randomUUID().slice(0, 8)}`;
    }

    const body = await req.json();
    
    // 단일 피드백 또는 배치 피드백 처리
    let feedbacks: FeedbackRequest[] = [];
    
    if (body.feedbacks && Array.isArray(body.feedbacks)) {
      feedbacks = body.feedbacks;
    } else if (body.productId && body.actionType) {
      feedbacks = [body as FeedbackRequest];
    } else {
      return new Response(JSON.stringify({ 
        error: 'productId and actionType are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[feedback-collect] Processing ${feedbacks.length} feedback(s) from ${userId}`);

    // 피드백 데이터 준비
    const feedbackRows = feedbacks.map(fb => ({
      user_id: userId,
      product_id: fb.productId,
      action_type: fb.actionType,
      recommendation_id: fb.recommendationId || null,
      context: fb.context || {},
      created_at: new Date().toISOString(),
    }));

    // 배치 삽입
    const { data, error } = await supabase
      .from('product_feedback')
      .insert(feedbackRows)
      .select('id');

    if (error) {
      console.error('[feedback-collect] Insert error:', error);
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[feedback-collect] Inserted ${data?.length || 0} feedback(s)`);

    // 구매/장바구니 이벤트 시 패턴 업데이트 트리거 (비동기)
    const highValueFeedbacks = feedbacks.filter(
      fb => fb.actionType === 'purchase' || fb.actionType === 'cart'
    );

    if (highValueFeedbacks.length > 0) {
      // 백그라운드에서 패턴 업데이트 (waitUntil)
      const updatePatterns = async () => {
        for (const fb of highValueFeedbacks) {
          if (fb.context?.occasion && fb.context?.concepts) {
            const patternKey = generatePatternKey(
              fb.context.gender || 'unisex',
              fb.context.occasion,
              fb.context.concepts,
              fb.context.budget || 200000
            );

            console.log(`[feedback-collect] Updating pattern: ${patternKey}`);

            // 패턴 조회 또는 생성
            const { data: pattern } = await supabase
              .from('recommendation_patterns')
              .select('*')
              .eq('pattern_key', patternKey)
              .single();

            if (pattern) {
              // 기존 패턴 업데이트
              const updatedUseCount = (pattern.use_count || 0) + 1;
              const currentCombos = (pattern.popular_combos || []) as any[];
              
              // 인기 조합에 상품 추가
              const existingCombo = currentCombos.find(
                (c: any) => c.product_ids?.includes(fb.productId)
              );
              
              if (existingCombo) {
                existingCombo.score = (existingCombo.score || 0) + (fb.actionType === 'purchase' ? 2 : 1);
              } else if (currentCombos.length < 20) {
                currentCombos.push({
                  product_ids: [fb.productId],
                  score: fb.actionType === 'purchase' ? 2 : 1,
                });
              }

              // 정렬 (점수 높은 순)
              currentCombos.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

              await supabase
                .from('recommendation_patterns')
                .update({
                  use_count: updatedUseCount,
                  popular_combos: currentCombos.slice(0, 20),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', pattern.id);
            } else {
              // 새 패턴 생성
              await supabase
                .from('recommendation_patterns')
                .insert({
                  pattern_key: patternKey,
                  use_count: 1,
                  popular_combos: [{
                    product_ids: [fb.productId],
                    score: fb.actionType === 'purchase' ? 2 : 1,
                  }],
                  concept_weights: fb.context.concepts?.reduce((acc, c) => {
                    acc[c] = 1.0;
                    return acc;
                  }, {} as Record<string, number>) || {},
                  avg_formality: 5,
                  success_rate: fb.actionType === 'purchase' ? 1.0 : 0.5,
                });
            }
          }
        }
      };

      // 백그라운드 실행 (Deno의 경우 별도 처리)
      updatePatterns().catch(err => {
        console.error('[feedback-collect] Pattern update error:', err);
      });
    }
    return new Response(JSON.stringify({
      success: true,
      inserted: data?.length || 0,
      patternUpdates: highValueFeedbacks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[feedback-collect] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 패턴 키 생성
function generatePatternKey(
  gender: string,
  occasion: string,
  concepts: string[],
  budget: number
): string {
  const budgetRange = Math.floor(budget / 100000) * 100000; // 10만원 단위
  const conceptsKey = concepts.sort().slice(0, 2).join('_');
  return `${gender}_${occasion}_${conceptsKey}_${budgetRange}`;
}
