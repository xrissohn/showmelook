import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplyReferralRequest {
  referral_code: string;
  new_user_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require an authenticated JWT and derive the referee user id from it.
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let new_user_id: string | null = null;
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && userData?.user) new_user_id = userData.user.id;
    } catch (_) { /* fall through */ }
    if (!new_user_id) {
      try {
        const { data: claimsData } = await (supabase.auth as any).getClaims(token);
        new_user_id = claimsData?.claims?.sub || null;
      } catch (_) { /* ignore */ }
    }
    if (!new_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 인증입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { referral_code, new_user_name }: ApplyReferralRequest = await req.json();

    if (!referral_code) {
      return new Response(
        JSON.stringify({ success: false, error: '필수 정보가 누락되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. 코드 유효성 검증
    const { data: codeData, error: codeError } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', referral_code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 추천 코드입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. 자기 추천 방지
    if (codeData.user_id === new_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: '본인의 추천 코드는 사용할 수 없습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. 사용 횟수 체크
    if (codeData.used_count >= codeData.max_uses) {
      return new Response(
        JSON.stringify({ success: false, error: '이 추천 코드의 사용 횟수가 초과되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. 이미 추천 받은 사용자인지 체크
    const { data: existingReward } = await supabase
      .from('referral_rewards')
      .select('id')
      .eq('referee_user_id', new_user_id)
      .single();

    if (existingReward) {
      return new Response(
        JSON.stringify({ success: false, error: '이미 추천 코드를 사용한 계정입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. 추천인 플랜 확인
    const { data: referrerSubscription } = await supabase
      .from('user_subscriptions')
      .select('plan')
      .eq('user_id', codeData.user_id)
      .single();

    const referrerPlan = referrerSubscription?.plan || 'free';
    
    // 리워드 타입 결정: Premium은 프로필 슬롯, 나머지는 보너스 크레딧
    const rewardType = referrerPlan === 'premium' ? 'profile_slot' : 'bonus_credits';
    const isPermanent = rewardType === 'profile_slot';
    const expiresAt = isPermanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 6. 추천인 리워드 생성
    const { error: referrerRewardError } = await supabase
      .from('referral_rewards')
      .insert({
        referrer_user_id: codeData.user_id,
        referee_user_id: new_user_id,
        referral_code: referral_code.toUpperCase(),
        reward_type: rewardType,
        amount: rewardType === 'bonus_credits' ? 5 : 1,
        remaining_amount: rewardType === 'bonus_credits' ? 5 : 1,
        expires_at: expiresAt,
        is_permanent: isPermanent,
        is_active: true,
      });

    if (referrerRewardError) {
      console.error('Referrer reward error:', referrerRewardError);
      return new Response(
        JSON.stringify({ success: false, error: '리워드 생성 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. 피추천인도 동일한 리워드 받음 (피추천인에게는 referrer_user_id 없음 처리를 위해 새 row)
    // 피추천인의 리워드는 referee_user_id가 아닌 referrer_user_id로 저장 (본인이 받는 것이므로)
    const { error: refereeRewardError } = await supabase
      .from('referral_rewards')
      .upsert({
        referrer_user_id: new_user_id, // 피추천인 본인이 받는 리워드
        referee_user_id: codeData.user_id, // 추천인 정보 (참조용)
        referral_code: `WELCOME_${referral_code.toUpperCase()}`, // 웰컴 보너스 구분
        reward_type: 'bonus_credits', // 피추천인은 항상 보너스 크레딧
        amount: 5,
        remaining_amount: 5,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_permanent: false,
        is_active: true,
      }, {
        onConflict: 'referee_user_id',
        ignoreDuplicates: true
      });

    if (refereeRewardError) {
      console.error('Referee reward error:', refereeRewardError);
      // 피추천인 리워드 실패해도 추천인 리워드는 성공했으므로 계속 진행
    }

    // 8. 추천 코드 사용 횟수 증가
    await supabase
      .from('referral_codes')
      .update({ used_count: codeData.used_count + 1 })
      .eq('id', codeData.id);

    // 9. 추천인에게 이메일 알림 발송
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', codeData.user_id)
      .single();

    // 추천인 이메일 조회
    const { data: referrerAuth } = await supabase.auth.admin.getUserById(codeData.user_id);
    const referrerEmail = referrerAuth?.user?.email;
    const referrerName = referrerProfile?.full_name || '회원';

    if (referrerEmail) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-referral-success-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            referrer_email: referrerEmail,
            referrer_name: referrerName,
            referee_name: new_user_name || '새 회원',
            reward_type: rewardType,
          }),
        });
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // 이메일 실패해도 전체 프로세스는 성공
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reward_type: rewardType,
        message: rewardType === 'profile_slot' 
          ? '추천 코드가 적용되었습니다! 프로필 슬롯 1개가 추가되었습니다.' 
          : '추천 코드가 적용되었습니다! 보너스 5회가 추가되었습니다.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apply referral error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
