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
  
  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(2);
  
  const message = datetime + method + path + query;
  
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

// 등급 계산 함수
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

interface ManualReportItem {
  report_date: string;
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
  reportDate: string;
  mode: string;
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
  const basePath = `/v2/providers/affiliate_open_api/apis/openapi/v1/reports/daily`;
  const queryString = `startDate=${startDate}&endDate=${endDate}&page=${page}`;
  const fullPath = `${basePath}?${queryString}`;
  
  const authorization = await generateCoupangHmacSignature("GET", fullPath, accessKey, secretKey);
  
  try {
    console.log('[coupang-daily-report] Calling API:', fullPath);
    
    const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
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
    
    // deno-lint-ignore no-explicit-any
    const data: any = await response.json();
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
      error: data.rMessage || data.message || 'Coupang API failed' 
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
  // deno-lint-ignore no-explicit-any
  const supabase = createClient(supabaseUrl, supabaseKey) as any;

  // Authentication: allow service role key (cron) or admin JWT
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  let authorized = false;
  if (authHeader && authHeader === supabaseKey) {
    authorized = true;
  } else if (authHeader) {
    try {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${authHeader}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (roleRow) authorized = true;
      }
    } catch (e) {
      console.error('[coupang-daily-report] Auth check failed:', e);
    }
  }
  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }


  try {
    let body: { date?: string; records?: ManualReportItem[] } = {};
    try {
      body = await req.json();
    } catch {
      // 빈 본문
    }

    const isManualMode = body.records && Array.isArray(body.records) && body.records.length > 0;
    
    let targetDate: Date;
    let dbDateFormat: string;

    const result: ProcessResult = {
      success: true,
      reportDate: '',
      mode: isManualMode ? 'manual' : 'api',
      totalRecords: 0,
      processedRecords: 0,
      matchedIntents: 0,
      updatedStats: 0,
      tierChanges: 0,
      errors: [],
    };

    // 공통 레코드 처리 함수
    const processRecord = async (
      record: { subId: string; order: number; cancel: number; gmv: number; commission: number; trackingCode?: string },
      recordDateFormat: string
    ): Promise<void> => {
      // 1. coupang_daily_reports에 저장 (upsert)
      const { error: upsertError } = await supabase
        .from('coupang_daily_reports')
        .upsert({
          report_date: recordDateFormat,
          tracking_code: record.trackingCode || null,
          sub_id: record.subId,
          click_count: 0,
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
        return;
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
        return;
      }

      if (!intent) {
        return;
      }

      result.matchedIntents++;
      const userId = intent.user_id;

      // 3. 주문이 있고 아직 처리 안 된 경우 -> 구매 확정
      if (record.order > 0 && intent.status !== 'purchased') {
        console.log('[coupang-daily-report] Confirming purchase for user:', userId);

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

        if (currentTier !== newTier) {
          await supabase
            .from('tier_change_history')
            .insert({
              user_id: userId,
              previous_tier: currentTier,
              new_tier: newTier,
              change_reason: 'coupang_purchase',
              amount_change: record.gmv,
              related_order_id: `coupang_${recordDateFormat}_${record.subId}`,
            });
          result.tierChanges++;
          console.log('[coupang-daily-report] Tier upgraded:', currentTier, '->', newTier);
        }

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

        await supabase
          .from('purchase_intents')
          .update({
            status: 'cancelled',
            confirmation_status: 'rolled_back',
            rolled_back_at: new Date().toISOString(),
          })
          .eq('id', intent.id);

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

          if (currentTier !== newTier) {
            await supabase
              .from('tier_change_history')
              .insert({
                user_id: userId,
                previous_tier: currentTier,
                new_tier: newTier,
                change_reason: 'coupang_refund',
                amount_change: -previousAmount,
                related_order_id: `coupang_${recordDateFormat}_${record.subId}`,
              });
            result.tierChanges++;
            console.log('[coupang-daily-report] Tier downgraded:', currentTier, '->', newTier);
          }

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
        .eq('report_date', recordDateFormat)
        .eq('sub_id', record.subId);
    };

    if (isManualMode) {
      // 수동 입력 모드
      console.log('[coupang-daily-report] Manual mode: processing', body.records!.length, 'records');
      
      const manualRecords = body.records!;
      result.totalRecords = manualRecords.length;
      result.reportDate = manualRecords[0].report_date;

      for (const manualRecord of manualRecords) {
        try {
          const record = {
            trackingCode: manualRecord.tracking_code || '',
            subId: manualRecord.sub_id,
            order: manualRecord.order_count,
            cancel: manualRecord.cancel_count || 0,
            gmv: manualRecord.gmv,
            commission: manualRecord.commission || 0,
          };
          
          await processRecord(record, manualRecord.report_date);
        } catch (recordError: unknown) {
          const errorMsg = recordError instanceof Error ? recordError.message : 'Unknown error';
          console.error('[coupang-daily-report] Record error:', errorMsg);
          result.errors.push(`Record error for ${manualRecord.sub_id}: ${errorMsg}`);
        }
      }

    } else {
      // API 자동 조회 모드
      if (!accessKey || !secretKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coupang API keys not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.date) {
        targetDate = new Date(body.date);
      } else {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
      }

      const apiDateFormat = formatDateForApi(targetDate);
      dbDateFormat = formatDateForDb(targetDate);
      result.reportDate = dbDateFormat;
      
      console.log('[coupang-daily-report] API mode: fetching report for date:', apiDateFormat);

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

        if (page > 100) {
          result.errors.push('Too many pages, stopping at 100');
          break;
        }
      }

      result.totalRecords = allRecords.length;
      console.log('[coupang-daily-report] Total records fetched:', allRecords.length);

      for (const record of allRecords) {
        try {
          await processRecord(record, dbDateFormat);
        } catch (recordError: unknown) {
          const errorMsg = recordError instanceof Error ? recordError.message : 'Unknown error';
          console.error('[coupang-daily-report] Record error:', errorMsg);
          result.errors.push(`Record error for ${record.subId}: ${errorMsg}`);
        }
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
