import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 활성화된 보너스 크레딧 조회 (만료되지 않고, 잔여량이 있는 것)
    const { data: rewards, error } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('referrer_user_id', user_id)
      .eq('reward_type', 'bonus_credits')
      .eq('is_active', true)
      .gt('remaining_amount', 0)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('expires_at', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ success: false, error: '조회 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 총 보너스 크레딧 계산
    const total = rewards?.reduce((sum, r) => sum + (r.remaining_amount || 0), 0) || 0;

    // 상세 내역 포맷팅
    const details = rewards?.map(r => ({
      id: r.id,
      remaining: r.remaining_amount,
      expires_at: r.expires_at,
      is_permanent: r.is_permanent,
      referral_code: r.referral_code,
    })) || [];

    return new Response(
      JSON.stringify({ 
        success: true, 
        total,
        details,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get bonus credits error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다.', total: 0, details: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
