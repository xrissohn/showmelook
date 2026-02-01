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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token and get user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 인증 토큰입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    
    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 가장 먼저 만료되는 활성 보너스 찾기
    const { data: rewards, error: queryError } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('referrer_user_id', userId)
      .eq('reward_type', 'bonus_credits')
      .eq('is_active', true)
      .gt('remaining_amount', 0)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('expires_at', { ascending: true, nullsFirst: false })
      .limit(1);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(
        JSON.stringify({ success: false, error: '조회 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rewards || rewards.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '사용 가능한 보너스 크레딧이 없습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reward = rewards[0];
    const newRemaining = reward.remaining_amount - 1;
    const newIsActive = newRemaining > 0;

    // 보너스 차감
    const { error: updateError } = await supabase
      .from('referral_rewards')
      .update({
        remaining_amount: newRemaining,
        is_active: newIsActive,
      })
      .eq('id', reward.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: '보너스 차감 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 남은 총 보너스 조회
    const { data: remainingRewards } = await supabase
      .from('referral_rewards')
      .select('remaining_amount')
      .eq('referrer_user_id', userId)
      .eq('reward_type', 'bonus_credits')
      .eq('is_active', true)
      .gt('remaining_amount', 0)
      .or('expires_at.is.null,expires_at.gt.now()');

    const totalRemaining = remainingRewards?.reduce((sum, r) => sum + (r.remaining_amount || 0), 0) || 0;

    return new Response(
      JSON.stringify({ 
        success: true, 
        consumed: 1,
        remaining_total: totalRemaining,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Consume bonus credit error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
