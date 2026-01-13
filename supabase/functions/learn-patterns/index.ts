import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * learn-patterns Edge Function
 * 
 * 피드백 데이터를 분석하여 추천 패턴을 학습하고 업데이트합니다.
 * 스케줄: 매일 1회 실행 권장
 * 
 * 학습 내용:
 * 1. 인기 상품 조합 (자주 함께 선택되는 상품들)
 * 2. 컨셉별 가중치 (어떤 컨셉이 구매로 이어지는지)
 * 3. 성공률 (추천 → 구매 전환율)
 * 4. DNA 부스트 점수 (인기 상품 우선 추천)
 */

interface PatternStats {
  patternKey: string;
  totalViews: number;
  totalClicks: number;
  totalCarts: number;
  totalPurchases: number;
  topProducts: { productId: string; score: number }[];
  conceptWeights: Record<string, number>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { daysToAnalyze = 7, updateDnaBoost = true } = await req.json().catch(() => ({}));

    console.log(`[learn-patterns] Starting pattern learning (last ${daysToAnalyze} days)`);

    // 1. 지난 N일간의 피드백 가져오기
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysToAnalyze);

    const { data: feedbacks, error: feedbackError } = await supabase
      .from('product_feedback')
      .select('*')
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('[learn-patterns] Feedback fetch error:', feedbackError);
      return new Response(JSON.stringify({ error: feedbackError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[learn-patterns] Analyzing ${feedbacks?.length || 0} feedbacks`);

    if (!feedbacks || feedbacks.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No feedbacks to analyze',
        stats: { analyzed: 0, patternsUpdated: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. 패턴별 통계 계산
    const patternStats: Record<string, PatternStats> = {};
    const productScores: Record<string, { views: number; clicks: number; carts: number; purchases: number }> = {};

    for (const fb of feedbacks) {
      const context = fb.context || {};
      const patternKey = generatePatternKey(
        context.gender || 'unisex',
        context.occasion || 'daily',
        context.concepts || ['캐주얼'],
        context.budget || 200000
      );

      // 패턴 통계 초기화
      if (!patternStats[patternKey]) {
        patternStats[patternKey] = {
          patternKey,
          totalViews: 0,
          totalClicks: 0,
          totalCarts: 0,
          totalPurchases: 0,
          topProducts: [],
          conceptWeights: {},
        };
      }

      const stats = patternStats[patternKey];

      // 액션 타입별 카운트
      switch (fb.action_type) {
        case 'view':
          stats.totalViews++;
          break;
        case 'click':
          stats.totalClicks++;
          break;
        case 'cart':
          stats.totalCarts++;
          break;
        case 'purchase':
          stats.totalPurchases++;
          break;
      }

      // 상품별 점수 (가중치: view=1, click=2, cart=5, purchase=10)
      if (fb.product_id) {
        if (!productScores[fb.product_id]) {
          productScores[fb.product_id] = { views: 0, clicks: 0, carts: 0, purchases: 0 };
        }

        switch (fb.action_type) {
          case 'view':
            productScores[fb.product_id].views++;
            break;
          case 'click':
            productScores[fb.product_id].clicks++;
            break;
          case 'cart':
            productScores[fb.product_id].carts++;
            break;
          case 'purchase':
            productScores[fb.product_id].purchases++;
            break;
        }

        // 패턴 내 인기 상품 추적
        const existingProduct = stats.topProducts.find(p => p.productId === fb.product_id);
        const actionScore = getActionScore(fb.action_type);
        
        if (existingProduct) {
          existingProduct.score += actionScore;
        } else {
          stats.topProducts.push({ productId: fb.product_id, score: actionScore });
        }

        // 컨셉 가중치 업데이트 (구매/장바구니 시 해당 컨셉 가중치 증가)
        if (fb.action_type === 'purchase' || fb.action_type === 'cart') {
          const concepts = context.concepts || [];
          for (const concept of concepts) {
            stats.conceptWeights[concept] = (stats.conceptWeights[concept] || 0) + actionScore;
          }
        }
      }
    }

    console.log(`[learn-patterns] Calculated stats for ${Object.keys(patternStats).length} patterns`);

    // 3. recommendation_patterns 테이블 업데이트
    let patternsUpdated = 0;

    for (const [key, stats] of Object.entries(patternStats)) {
      // 인기 상품 정렬 (점수 높은 순, 상위 20개)
      stats.topProducts.sort((a, b) => b.score - a.score);
      const topProducts = stats.topProducts.slice(0, 20);

      // 성공률 계산 (구매 / (클릭 + 1))
      const successRate = stats.totalPurchases / (stats.totalClicks + 1);

      // 컨셉 가중치 정규화
      const maxWeight = Math.max(...Object.values(stats.conceptWeights), 1);
      const normalizedWeights: Record<string, number> = {};
      for (const [concept, weight] of Object.entries(stats.conceptWeights)) {
        normalizedWeights[concept] = Number((weight / maxWeight).toFixed(2));
      }

      // Upsert 패턴
      const { error: upsertError } = await supabase
        .from('recommendation_patterns')
        .upsert({
          pattern_key: key,
          popular_combos: topProducts.map(p => ({
            product_ids: [p.productId],
            score: p.score,
          })),
          concept_weights: normalizedWeights,
          use_count: stats.totalViews + stats.totalClicks + stats.totalCarts + stats.totalPurchases,
          success_rate: Number(successRate.toFixed(3)),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'pattern_key' });

      if (upsertError) {
        console.error(`[learn-patterns] Pattern upsert error for ${key}:`, upsertError);
      } else {
        patternsUpdated++;
      }
    }

    console.log(`[learn-patterns] Updated ${patternsUpdated} patterns`);

    // 4. DNA 부스트 점수 업데이트 (인기 상품)
    let dnaBoostUpdated = 0;

    if (updateDnaBoost && Object.keys(productScores).length > 0) {
      console.log(`[learn-patterns] Updating DNA boost for ${Object.keys(productScores).length} products`);

      // 전체 점수 계산 및 정규화
      const scoredProducts = Object.entries(productScores).map(([productId, scores]) => ({
        productId,
        totalScore: scores.views * 1 + scores.clicks * 2 + scores.carts * 5 + scores.purchases * 10,
      }));

      scoredProducts.sort((a, b) => b.totalScore - a.totalScore);
      const maxScore = scoredProducts[0]?.totalScore || 1;

      // 상위 100개 상품에 부스트 점수 적용
      const topBoostProducts = scoredProducts.slice(0, 100);

      for (const { productId, totalScore } of topBoostProducts) {
        const boostScore = Number((totalScore / maxScore).toFixed(2));
        
        // dna_meta 내 boost_score 업데이트
        const { data: product } = await supabase
          .from('products_cache')
          .select('dna_meta')
          .eq('id', productId)
          .single();

        if (product) {
          const updatedMeta = {
            ...(product.dna_meta || {}),
            boost_score: boostScore,
            boost_updated_at: new Date().toISOString(),
          };

          const { error: updateError } = await supabase
            .from('products_cache')
            .update({ dna_meta: updatedMeta })
            .eq('id', productId);

          if (!updateError) {
            dnaBoostUpdated++;
          }
        }
      }

      console.log(`[learn-patterns] Updated DNA boost for ${dnaBoostUpdated} products`);
    }

    // 5. 오래된 패턴 정리 (30일 이상 미사용)
    const oldPatternDate = new Date();
    oldPatternDate.setDate(oldPatternDate.getDate() - 30);

    const { data: deletedPatterns } = await supabase
      .from('recommendation_patterns')
      .delete()
      .lt('updated_at', oldPatternDate.toISOString())
      .lt('use_count', 5)
      .select('id');

    console.log(`[learn-patterns] Cleaned up ${deletedPatterns?.length || 0} old patterns`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        feedbacksAnalyzed: feedbacks.length,
        patternsUpdated,
        dnaBoostUpdated,
        patternsDeleted: deletedPatterns?.length || 0,
        topPatterns: Object.entries(patternStats)
          .sort((a, b) => b[1].totalPurchases - a[1].totalPurchases)
          .slice(0, 5)
          .map(([key, stats]) => ({
            key,
            purchases: stats.totalPurchases,
            successRate: (stats.totalPurchases / (stats.totalClicks + 1)).toFixed(2),
          })),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[learn-patterns] Error:', error);
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
  const budgetRange = Math.floor(budget / 100000) * 100000;
  const conceptsKey = concepts.sort().slice(0, 2).join('_');
  return `${gender}_${occasion}_${conceptsKey}_${budgetRange}`;
}

// 액션별 점수
function getActionScore(actionType: string): number {
  switch (actionType) {
    case 'view': return 1;
    case 'click': return 2;
    case 'cart': return 5;
    case 'purchase': return 10;
    default: return 1;
  }
}
