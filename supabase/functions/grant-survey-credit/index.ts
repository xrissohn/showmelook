import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SURVEY_KEY = 'shomi_ab_v1';
const REWARD_TYPE = 'survey_shomi_ab';
const REWARD_AMOUNT = 10;

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
      return new Response(JSON.stringify({ success: false, error: '인증이 필요합니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');

    let userId: string | null = null;
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      userId = user.id;
    } else {
      try {
        const { data: claimsData } = await authClient.auth.getClaims(token);
        userId = (claimsData?.claims?.sub as string) || null;
      } catch (_) { /* ignore */ }
    }

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: '유효하지 않은 토큰입니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const choice = body?.choice;
    const feedback = typeof body?.feedback === 'string' ? body.feedback.slice(0, 1000) : null;
    if (choice !== 'A' && choice !== 'B') {
      return new Response(JSON.stringify({ success: false, error: '선택지가 올바르지 않습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Insert survey response (unique on user_id prevents dupes)
    const { error: insertErr } = await admin.from('survey_responses').insert({
      user_id: userId,
      survey_key: SURVEY_KEY,
      choice,
      feedback,
    });

    if (insertErr) {
      // Already submitted
      if ((insertErr as any).code === '23505') {
        return new Response(JSON.stringify({ success: false, error: '이미 참여하셨습니다.', already: true }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('insert error', insertErr);
      return new Response(JSON.stringify({ success: false, error: '저장 중 오류가 발생했습니다.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotent reward: skip if a survey reward already exists
    const { data: existing } = await admin
      .from('referral_rewards')
      .select('id')
      .eq('referrer_user_id', userId)
      .eq('reward_type', REWARD_TYPE)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error: rewardErr } = await admin.from('referral_rewards').insert({
        referrer_user_id: userId,
        referee_user_id: userId,
        referral_code: 'SURVEY_SHOMI',
        reward_type: REWARD_TYPE,
        amount: REWARD_AMOUNT,
        remaining_amount: REWARD_AMOUNT,
        is_permanent: true,
        is_active: true,
      });
      if (rewardErr) {
        console.error('reward error', rewardErr);
      }
    }

    return new Response(JSON.stringify({ success: true, credits: REWARD_AMOUNT }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('grant-survey-credit error', e);
    return new Response(JSON.stringify({ success: false, error: '서버 오류' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
