import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 등급 계산 함수 (DB 함수와 동일 로직)
function calculateUserTier(totalAmount: number): string {
  if (totalAmount >= 1000000) return 'platinum';
  if (totalAmount >= 300000) return 'gold';
  if (totalAmount >= 100000) return 'silver';
  if (totalAmount >= 1) return 'bronze';
  return 'free';
}

// 모델 프로필 슬롯 계산
function calculateModelProfileSlots(totalAmount: number): number {
  if (totalAmount >= 1000000) {
    return Math.floor(totalAmount / 1000000);
  }
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // LinkPrice에서 전달하는 Query Parameters
    const url = new URL(req.url);
    const lpinfo = url.searchParams.get('lpinfo'); // tracking_id
    const orderId = url.searchParams.get('order_id');
    const priceStr = url.searchParams.get('price');
    const payoutStr = url.searchParams.get('payout');
    const status = url.searchParams.get('status'); // confirmed | cancelled

    console.log('[linkprice-postback] Received:', { lpinfo, orderId, priceStr, payoutStr, status });

    if (!lpinfo) {
      return new Response(
        JSON.stringify({ error: 'lpinfo (tracking_id) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. purchase_intents에서 해당 tracking_id 조회
    const { data: intent, error: intentError } = await supabase
      .from('purchase_intents')
      .select('*')
      .eq('tracking_id', lpinfo)
      .maybeSingle();

    if (intentError) {
      console.error('[linkprice-postback] Error fetching intent:', intentError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: intentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!intent) {
      console.warn('[linkprice-postback] No matching purchase intent found for lpinfo:', lpinfo);
      // 매칭되지 않아도 에러가 아닌 성공으로 처리 (중복 방지)
      return new Response(
        JSON.stringify({ success: true, message: 'No matching intent, ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = intent.user_id;
    const actualAmount = priceStr ? parseInt(priceStr, 10) : intent.product_price || 0;
    const commission = payoutStr ? parseFloat(payoutStr) : null;

    // 2. 상태에 따라 처리
    if (status === 'confirmed') {
      // ===== 구매 확정 처리 =====
      console.log('[linkprice-postback] Processing confirmed purchase for user:', userId);

      // 2-1. purchase_intents 업데이트
      await supabase
        .from('purchase_intents')
        .update({
          status: 'purchased',
          purchased_at: new Date().toISOString(),
          order_id: orderId,
          actual_amount: actualAmount,
          commission: commission,
          tier_applied_at: new Date().toISOString(),
          confirmation_status: 'pending_confirmation',
        })
        .eq('id', intent.id);

      // 2-2. user_purchase_stats 조회 또는 생성
      const { data: existingStats } = await supabase
        .from('user_purchase_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const currentTotal = existingStats?.total_purchased_amount || 0;
      const newTotal = currentTotal + actualAmount;
      const currentTier = existingStats?.current_tier || 'free';
      const newTier = calculateUserTier(newTotal);
      const newSlots = calculateModelProfileSlots(newTotal);

      // 2-3. user_purchase_stats 업데이트 또는 생성
      if (existingStats) {
        await supabase
          .from('user_purchase_stats')
          .update({
            total_purchased_amount: newTotal,
            total_purchases: (existingStats.total_purchases || 0) + 1,
            current_tier: newTier,
            model_profile_slots: newSlots,
            tier_updated_at: new Date().toISOString(),
            last_tier_change_at: currentTier !== newTier ? new Date().toISOString() : existingStats.last_tier_change_at,
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('user_purchase_stats')
          .insert({
            user_id: userId,
            total_purchased_amount: newTotal,
            total_purchases: 1,
            first_purchase_at: new Date().toISOString(),
            current_tier: newTier,
            model_profile_slots: newSlots,
            tier_updated_at: new Date().toISOString(),
            last_tier_change_at: new Date().toISOString(),
          });
      }

      // 2-4. 등급 변동 시 tier_change_history 기록
      if (currentTier !== newTier) {
        await supabase
          .from('tier_change_history')
          .insert({
            user_id: userId,
            previous_tier: currentTier,
            new_tier: newTier,
            change_reason: 'purchase',
            amount_change: actualAmount,
            related_order_id: orderId,
          });
        console.log('[linkprice-postback] Tier upgraded:', currentTier, '->', newTier);
      }

      // 2-5. user_subscriptions 플랜 업데이트
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from('user_subscriptions')
          .update({ plan: newTier })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan: newTier,
            daily_limit: newTier === 'platinum' ? -1 : newTier === 'gold' ? 20 : newTier === 'silver' ? 10 : 5,
            monthly_limit: newTier === 'free' ? 25 : -1,
          });
      }

      console.log('[linkprice-postback] Purchase confirmed successfully');
      return new Response(
        JSON.stringify({
          success: true,
          action: 'confirmed',
          user_id: userId,
          amount: actualAmount,
          previous_tier: currentTier,
          new_tier: newTier,
          model_profile_slots: newSlots,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (status === 'cancelled') {
      // ===== 환불/취소 처리 =====
      console.log('[linkprice-postback] Processing cancellation for user:', userId);

      // 이전 구매 금액 확인
      const previousAmount = intent.actual_amount || intent.product_price || 0;

      // 3-1. purchase_intents 업데이트
      await supabase
        .from('purchase_intents')
        .update({
          status: 'cancelled',
          confirmation_status: 'rolled_back',
          rolled_back_at: new Date().toISOString(),
        })
        .eq('id', intent.id);

      // 3-2. user_purchase_stats 조회
      const { data: existingStats } = await supabase
        .from('user_purchase_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingStats) {
        console.warn('[linkprice-postback] No purchase stats found for user:', userId);
        return new Response(
          JSON.stringify({ success: true, message: 'No stats to rollback' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentTotal = existingStats.total_purchased_amount || 0;
      const newTotal = Math.max(0, currentTotal - previousAmount);
      const currentTier = existingStats.current_tier || 'free';
      const newTier = calculateUserTier(newTotal);
      const oldSlots = existingStats.model_profile_slots || 0;
      const newSlots = calculateModelProfileSlots(newTotal);

      // 3-3. user_purchase_stats 업데이트
      await supabase
        .from('user_purchase_stats')
        .update({
          total_purchased_amount: newTotal,
          total_purchases: Math.max(0, (existingStats.total_purchases || 0) - 1),
          current_tier: newTier,
          model_profile_slots: newSlots,
          tier_updated_at: new Date().toISOString(),
          last_tier_change_at: currentTier !== newTier ? new Date().toISOString() : existingStats.last_tier_change_at,
        })
        .eq('user_id', userId);

      // 3-4. 등급 다운그레이드 시 tier_change_history 기록
      if (currentTier !== newTier) {
        await supabase
          .from('tier_change_history')
          .insert({
            user_id: userId,
            previous_tier: currentTier,
            new_tier: newTier,
            change_reason: 'refund',
            amount_change: -previousAmount,
            related_order_id: orderId,
          });
        console.log('[linkprice-postback] Tier downgraded:', currentTier, '->', newTier);
      }

      // 3-5. 모델 프로필 슬롯 감소 시 유예 기간 생성
      if (newSlots < oldSlots) {
        // 현재 모델 프로필 수 확인
        const { count: profileCount } = await supabase
          .from('family_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('owner_user_id', userId);

        if (profileCount && profileCount > newSlots) {
          // 유예 기간 생성 (3일)
          const gracePeriodEndsAt = new Date();
          gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 3);

          // 초과 프로필 ID 조회 (가장 오래된 것부터)
          const { data: excessProfiles } = await supabase
            .from('family_profiles')
            .select('id')
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: true })
            .range(newSlots, 100);

          if (excessProfiles && excessProfiles.length > 0) {
            const excessProfileIds = excessProfiles.map(p => p.id);

            // 기존 유예 기간 확인
            const { data: existingGrace } = await supabase
              .from('profile_deletion_grace')
              .select('id')
              .eq('user_id', userId)
              .is('deleted_at', null)
              .maybeSingle();

            if (existingGrace) {
              await supabase
                .from('profile_deletion_grace')
                .update({
                  profile_ids: excessProfileIds,
                  grace_period_ends_at: gracePeriodEndsAt.toISOString(),
                })
                .eq('id', existingGrace.id);
            } else {
              await supabase
                .from('profile_deletion_grace')
                .insert({
                  user_id: userId,
                  profile_ids: excessProfileIds,
                  grace_period_ends_at: gracePeriodEndsAt.toISOString(),
                });
            }
            console.log('[linkprice-postback] Grace period created for', excessProfileIds.length, 'profiles');
          }
        }
      }

      // 3-6. user_subscriptions 플랜 업데이트
      await supabase
        .from('user_subscriptions')
        .update({ plan: newTier })
        .eq('user_id', userId);

      console.log('[linkprice-postback] Cancellation processed successfully');
      return new Response(
        JSON.stringify({
          success: true,
          action: 'cancelled',
          user_id: userId,
          refunded_amount: previousAmount,
          previous_tier: currentTier,
          new_tier: newTier,
          previous_slots: oldSlots,
          new_slots: newSlots,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // 알 수 없는 상태
      console.warn('[linkprice-postback] Unknown status:', status);
      return new Response(
        JSON.stringify({ error: 'Unknown status', status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('[linkprice-postback] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
