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

interface ManualReportItem {
  report_date: string; // yyyy-MM-dd 형식
  sub_id: string;
  tracking_code?: string;
  click_count?: number;
  order_count: number;
  cancel_count?: number;
  gmv: number;
  commission?: number;
}

interface ProcessResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  matchedIntents: number;
  updatedStats: number;
  tierChanges: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { records } = await req.json() as { records: ManualReportItem[] };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'records array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[coupang-daily-report] Processing', records.length, 'records');

    const result: ProcessResult = {
      success: true,
      totalRecords: records.length,
      processedRecords: 0,
      matchedIntents: 0,
      updatedStats: 0,
      tierChanges: 0,
      errors: [],
    };

    for (const record of records) {
      try {
        // 1. coupang_daily_reports에 저장 (upsert)
        const { error: upsertError } = await supabase
          .from('coupang_daily_reports')
          .upsert({
            report_date: record.report_date,
            tracking_code: record.tracking_code || null,
            sub_id: record.sub_id,
            click_count: record.click_count || 0,
            order_count: record.order_count,
            cancel_count: record.cancel_count || 0,
            gmv: record.gmv,
            commission: record.commission || 0,
            processed: false,
          }, {
            onConflict: 'report_date,sub_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('[coupang-daily-report] Upsert error:', upsertError);
          result.errors.push(`Upsert error for ${record.sub_id}: ${upsertError.message}`);
          continue;
        }

        result.processedRecords++;

        // 2. sub_id로 purchase_intents와 매칭
        const { data: intent, error: intentError } = await supabase
          .from('purchase_intents')
          .select('*')
          .eq('tracking_id', record.sub_id)
          .eq('merchant_id', 'coupang')
          .maybeSingle();

        if (intentError) {
          console.error('[coupang-daily-report] Intent lookup error:', intentError);
          result.errors.push(`Intent lookup error for ${record.sub_id}: ${intentError.message}`);
          continue;
        }

        if (!intent) {
          // 매칭되는 purchase_intent 없음 (정상 - 다른 경로 구매)
          continue;
        }

        result.matchedIntents++;
        const userId = intent.user_id;

        // 3. 주문이 있고 아직 처리 안 된 경우 -> 구매 확정
        if (record.order_count > 0 && intent.status !== 'purchased') {
          console.log('[coupang-daily-report] Confirming purchase for user:', userId);

          // purchase_intents 업데이트
          await supabase
            .from('purchase_intents')
            .update({
              status: 'purchased',
              purchased_at: new Date().toISOString(),
              actual_amount: record.gmv,
              commission: record.commission || 0,
              tier_applied_at: new Date().toISOString(),
              confirmation_status: 'confirmed',
            })
            .eq('id', intent.id);

          // user_purchase_stats 조회 또는 생성
          const { data: existingStats } = await supabase
            .from('user_purchase_stats')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          const currentTotal = existingStats?.total_purchased_amount || 0;
          const newTotal = currentTotal + record.gmv;
          const currentTier = existingStats?.current_tier || 'free';
          const newTier = calculateUserTier(newTotal);
          const newSlots = calculateModelProfileSlots(newTotal);

          // user_purchase_stats 업데이트 또는 생성
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

          result.updatedStats++;

          // 등급 변동 시 tier_change_history 기록
          if (currentTier !== newTier) {
            await supabase
              .from('tier_change_history')
              .insert({
                user_id: userId,
                previous_tier: currentTier,
                new_tier: newTier,
                change_reason: 'coupang_purchase',
                amount_change: record.gmv,
                related_order_id: `coupang_${record.report_date}_${record.sub_id}`,
              });
            result.tierChanges++;
            console.log('[coupang-daily-report] Tier upgraded:', currentTier, '->', newTier);
          }

          // user_subscriptions 플랜 업데이트
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
          }
        }

        // 4. 취소가 있는 경우 -> 환불 처리
        if ((record.cancel_count || 0) > 0 && intent.status === 'purchased' && intent.confirmation_status !== 'rolled_back') {
          console.log('[coupang-daily-report] Processing cancellation for user:', userId);

          const previousAmount = intent.actual_amount || record.gmv;

          // purchase_intents 업데이트
          await supabase
            .from('purchase_intents')
            .update({
              status: 'cancelled',
              confirmation_status: 'rolled_back',
              rolled_back_at: new Date().toISOString(),
            })
            .eq('id', intent.id);

          // user_purchase_stats 조회
          const { data: existingStats } = await supabase
            .from('user_purchase_stats')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingStats) {
            const currentTotal = existingStats.total_purchased_amount || 0;
            const newTotal = Math.max(0, currentTotal - previousAmount);
            const currentTier = existingStats.current_tier || 'free';
            const newTier = calculateUserTier(newTotal);
            const newSlots = calculateModelProfileSlots(newTotal);

            // user_purchase_stats 업데이트
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

            result.updatedStats++;

            // 등급 다운그레이드 시 tier_change_history 기록
            if (currentTier !== newTier) {
              await supabase
                .from('tier_change_history')
                .insert({
                  user_id: userId,
                  previous_tier: currentTier,
                  new_tier: newTier,
                  change_reason: 'coupang_refund',
                  amount_change: -previousAmount,
                  related_order_id: `coupang_${record.report_date}_${record.sub_id}`,
                });
              result.tierChanges++;
              console.log('[coupang-daily-report] Tier downgraded:', currentTier, '->', newTier);
            }

            // user_subscriptions 플랜 업데이트
            await supabase
              .from('user_subscriptions')
              .update({ plan: newTier })
              .eq('user_id', userId);
          }
        }

        // 5. 레코드를 처리 완료로 표시
        await supabase
          .from('coupang_daily_reports')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('report_date', record.report_date)
          .eq('sub_id', record.sub_id);

      } catch (recordError: unknown) {
        const errorMsg = recordError instanceof Error ? recordError.message : 'Unknown error';
        console.error('[coupang-daily-report] Record processing error:', errorMsg);
        result.errors.push(`Record error for ${record.sub_id}: ${errorMsg}`);
      }
    }

    console.log('[coupang-daily-report] Processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[coupang-daily-report] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error', 
        message: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
