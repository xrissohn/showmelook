import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REWARD_TYPE = 'gallery_public';
const REWARD_AMOUNT = 1;
const MAX_REWARDS_PER_USER = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: '인증이 필요합니다.' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let userId: string | null = null;
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (!userErr && userData?.user) {
      userId = userData.user.id;
    } else {
      const { data: claimsData } = await authClient.auth.getClaims(token);
      userId = (claimsData?.claims?.sub as string) ?? null;
    }
    if (!userId) return json({ success: false, error: '유효하지 않은 인증 토큰입니다.' }, 401);

    const body = await req.json().catch(() => ({}));
    const lookId = typeof body?.lookId === 'string' ? body.lookId : '';
    if (!/^[0-9a-f-]{36}$/i.test(lookId)) {
      return json({ success: false, error: '잘못된 요청입니다.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 본인 소유 + 실제로 공개 상태인지 확인
    const { data: look, error: lookErr } = await admin
      .from('generated_looks')
      .select('id, user_id, is_public')
      .eq('id', lookId)
      .maybeSingle();

    if (lookErr) {
      console.error('look lookup error', lookErr);
      return json({ success: false, error: '조회 중 오류가 발생했습니다.' }, 500);
    }
    if (!look || look.user_id !== userId) {
      return json({ success: false, error: '해당 룩을 찾을 수 없습니다.' }, 404);
    }
    if (!look.is_public) {
      return json({ success: false, error: '공개 상태가 아닙니다.' }, 400);
    }

    const rewardCode = `GALLERY:${lookId}`;

    const { data: existing } = await admin
      .from('referral_rewards')
      .select('id')
      .eq('referrer_user_id', userId)
      .eq('reward_type', REWARD_TYPE)
      .eq('referral_code', rewardCode)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json({ success: true, granted: false, already: true });
    }

    const { count } = await admin
      .from('referral_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId)
      .eq('reward_type', REWARD_TYPE);

    if ((count ?? 0) >= MAX_REWARDS_PER_USER) {
      return json({ success: true, granted: false, limitReached: true, max: MAX_REWARDS_PER_USER });
    }

    const { error: insertErr } = await admin.from('referral_rewards').insert({
      referrer_user_id: userId,
      referee_user_id: userId,
      referral_code: rewardCode,
      reward_type: REWARD_TYPE,
      amount: REWARD_AMOUNT,
      remaining_amount: REWARD_AMOUNT,
      is_permanent: true,
      is_active: true,
    });

    if (insertErr) {
      console.error('reward insert error', insertErr);
      return json({ success: false, error: '크레딧 지급 중 오류가 발생했습니다.' }, 500);
    }

    return json({ success: true, granted: true, credits: REWARD_AMOUNT });
  } catch (error) {
    console.error('grant-gallery-credit error', error);
    return json({ success: false, error: '서버 오류가 발생했습니다.' }, 500);
  }
});
