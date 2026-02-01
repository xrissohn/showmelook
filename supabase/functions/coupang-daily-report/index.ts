import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 쿠팡 파트너스 HMAC-SHA256 서명 생성
async function generateCoupangHmacSignature(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const [path, query = ""] = url.split("?");
  
  // GMT 시간 형식: yyMMdd'T'HHmmss'Z'
  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(2); // YYMMDDTHHmmssZ 형식
  
  const message = datetime + method + path + query;
  
  // HMAC-SHA256 서명 생성
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${hexSignature}`;
}

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

// 날짜를 yyyyMMdd 형식으로 변환
function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 날짜를 yyyy-MM-dd 형식으로 변환
function formatDateForDb(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CoupangReportItem {
  trackingCode: string;
  subId: string;
  click: number;
  order: number;
  cancel: number;
  gmv: number;
  commission: number;
}

interface CoupangApiResponse {
  rCode: string;
  rMessage: string;
  data: CoupangReportItem[];
}

interface ProcessResult {
  success: boolean;
  reportDate: string;
  totalRecords: number;
  processedRecords: number;
  matchedIntents: number;
  updatedStats: number;
  tierChanges: number;
  errors: string[];
}

// 쿠팡 일별 실적 API 호출
async function fetchCoupangDailyReport(
  accessKey: string,
  secretKey: string,
  startDate: string,
  endDate: string,
  page: number = 0
): Promise<{ success: boolean; data?: CoupangReportItem[]; error?: string; hasMore?: boolean }> {
  const apiPath = `/v2/providers/affiliate_open_api/apis/openapi/v1/reports/daily?startDate=${startDate}&endDate=${endDate}&page=${page}`;
  const authorization = await generateCoupangHmacSignature("GET", apiPath, accessKey, secretKey);
  
  try {
    console.log('[coupang-daily-report] Calling API:', apiPath);
    
    const response = await fetch(`https://api-gateway.coupang.com${apiPath}`, {
      method: "GET",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
      },
    });
    
    if (response.status === 429) {
      console.log('[coupang-daily-report] Rate limited, waiting 60s...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchCoupangDailyReport(accessKey, secretKey, startDate, endDate, page);
    }
    
    const data: CoupangApiResponse = await response.json();
    console.log('[coupang-daily-report] API response:', JSON.stringify(data));
    
    if (data.rCode === "0") {
      const hasMore = data.data && data.data.length >= 1000;
      return {
        success: true,
        data: data.data || [],
        hasMore,
      };
    }
    
    return { 
      success: false, 
      error: data.rMessage || 'Coupang API failed' 
    };
  } catch (error) {
    console.error('[coupang-daily-report] API error:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const accessKey = Deno.env.get('COUPANG_ACCESS_KEY');
  const secretKey = Deno.env.get('COUPANG_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // API 키 확인
    if (!accessKey || !secretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coupang API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청에서 날짜 파라미터 추출 (없으면 전날 사용)
    let targetDate: Date;
    try {
      const body = await req.json();
      if (body.date) {
        targetDate = new Date(body.date);
      } else {
        // 기본값: 전날 (D-1)
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
      }
    } catch {
      // JSON 파싱 실패 시 기본값 사용
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    }

    const apiDateFormat = formatDateForApi(targetDate);
    const dbDateFormat = formatDateForDb(targetDate);
    
    console.log('[coupang-daily-report] Fetching report for date:', apiDateFormat);

    const result: ProcessResult = {
      success: true,
      reportDate: dbDateFormat,
      totalRecords: 0,
      processedRecords: 0,
      matchedIntents: 0,
      updatedStats: 0,
      tierChanges: 0,
      errors: [],
    };

    // 페이지네이션으로 모든 데이터 가져오기
    let allRecords: CoupangReportItem[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const apiResult = await fetchCoupangDailyReport(accessKey, secretKey, apiDateFormat, apiDateFormat, page);
      
      if (!apiResult.success) {
        result.errors.push(`API error on page ${page}: ${apiResult.error}`);
        break;
      }

      if (apiResult.data && apiResult.data.length > 0) {
        allRecords = allRecords.concat(apiResult.data);
      }

      hasMore = apiResult.hasMore || false;
      page++;

      // 과도한 API 호출 방지
      if (page > 100) {
        result.errors.push('Too many pages, stopping at 100');
        break;
      }
    }

    result.totalRecords = allRecords.length;
    console.log('[coupang-daily-report] Total records fetched:', allRecords.length);

    // 각 레코드 처리
    for (const record of allRecords) {
      try {
        // 1. coupang_daily_reports에 저장 (upsert)
        const { error: upsertError } = await supabase
          .from('coupang_daily_reports')
          .upsert({
            report_date: dbDateFormat,
            tracking_code: record.trackingCode || null,
            sub_id: record.subId,
            click_count: record.click || 0,
            order_count: record.order || 0,
            cancel_count: record.cancel || 0,
            gmv: record.gmv || 0,
            commission: record.commission || 0,
            processed: false,
          }, {
            onConflict: 'report_date,sub_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error('[coupang-daily-report] Upsert error:', upsertError);
          result.errors.push(`Upsert error for ${record.subId}: ${upsertError.message}`);
          continue;
        }

        result.processedRecords++;

        // 2. sub_id로 purchase_intents와 매칭
        const { data: intent, error: intentError } = await supabase
          .from('purchase_intents')
          .select('*')
          .eq('tracking_id', record.subId)
          .eq('merchant_id', 'coupang')
          .maybeSingle();

        if (intentError) {
          console.error('[coupang-daily-report] Intent lookup error:', intentError);
          result.errors.push(`Intent lookup error for ${record.subId}: ${intentError.message}`);
          continue;
        }

        if (!intent) {
          // 매칭되는 purchase_intent 없음 (정상 - 다른 경로 구매)
          continue;
        }

        result.matchedIntents++;
        const userId = intent.user_id;

        // 3. 주문이 있고 아직 처리 안 된 경우 -> 구매 확정
        if (record.order > 0 && intent.status !== 'purchased') {
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
                related_order_id: `coupang_${dbDateFormat}_${record.subId}`,
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
        if ((record.cancel || 0) > 0 && intent.status === 'purchased' && intent.confirmation_status !== 'rolled_back') {
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
                  related_order_id: `coupang_${dbDateFormat}_${record.subId}`,
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
          .eq('report_date', dbDateFormat)
          .eq('sub_id', record.subId);

      } catch (recordError: unknown) {
        const errorMsg = recordError instanceof Error ? recordError.message : 'Unknown error';
        console.error('[coupang-daily-report] Record processing error:', errorMsg);
        result.errors.push(`Record error for ${record.subId}: ${errorMsg}`);
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
