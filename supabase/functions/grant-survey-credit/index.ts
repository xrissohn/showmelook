import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SURVEY_KEY = 'shomi_ab_v1';
const REWARD_TYPE = 'survey_shomi_ab';
const REWARD_AMOUNT = 10;
const HMAC_SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const htmlHeaders = { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' };
const APP_URL = 'https://showmelook.com/survey/shomi';

function redirectToApp(status: 'completed' | 'already' | 'invalid' | 'error', message?: string, choice?: string) {
  const url = new URL(APP_URL);
  url.searchParams.set('status', status);
  if (choice) url.searchParams.set('choice', choice);
  if (message) url.searchParams.set('message', message);
  return Response.redirect(url.toString(), 303);
}

async function verifySurveyToken(token: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [userId, sigB64] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const payload = `survey:${SURVEY_KEY}:${userId}`;
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return expectedB64 === sigB64 ? userId : null;
}

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,'Pretendard','Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:40px 20px;color:#1f2937}.card{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 12px rgba(0,0,0,.08);text-align:center}h1{font-size:22px;margin:0 0 12px}p{font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 20px}a{display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600}</style>
</head><body><div class="card">${body}</div></body></html>`;
}

async function ensureSurveyReward(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: existing, error: existingErr } = await admin
    .from('referral_rewards')
    .select('id')
    .eq('referrer_user_id', userId)
    .eq('reward_type', REWARD_TYPE)
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    console.error('reward lookup error', existingErr);
    return false;
  }

  if (existing) return true;

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
    return false;
  }

  return true;
}

async function saveResponseAndReward(admin: ReturnType<typeof createClient>, userId: string, choice: 'A' | 'B', feedback: string | null) {
  const { error: insertErr } = await admin.from('survey_responses').insert({
    user_id: userId,
    survey_key: SURVEY_KEY,
    choice,
    feedback,
  });

  if (insertErr) {
    if ((insertErr as any).code === '23505') {
      const rewarded = await ensureSurveyReward(admin, userId);
      return { success: false, already: true, rewarded, error: '이미 참여하셨습니다.' };
    }
    console.error('insert error', insertErr);
    return { success: false, already: false, error: '저장 중 오류가 발생했습니다.' };
  }

  const rewarded = await ensureSurveyReward(admin, userId);
  if (!rewarded) return { success: false, already: false, error: '크레딧 지급 중 오류가 발생했습니다.' };

  return { success: true, credits: REWARD_AMOUNT };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token') || '';
      const choice = url.searchParams.get('choice');
      const confirm = url.searchParams.get('confirm');

      if (choice !== 'A' && choice !== 'B') {
        return redirectToApp('invalid', '잘못된 설문 선택입니다.');
      }
      const tokenUserId = await verifySurveyToken(token);
      if (!tokenUserId) {
        return redirectToApp('invalid', '유효하지 않은 설문 링크입니다.');
      }

      // STEP 1: First GET (from email click OR scanner prefetch) — render a
      // confirmation page that auto-POSTs via JS. Email link-scanners do NOT
      // execute JS, so they cannot accidentally cast a vote.
      if (confirm !== '1') {
        const confirmUrl = `${req.url}${req.url.includes('?') ? '&' : '?'}confirm=1`;
        const page = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>응답 확인 중...</title>
<style>body{font-family:-apple-system,'Pretendard','Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:40px 20px;color:#1f2937;text-align:center}.card{max-width:480px;margin:60px auto;background:#fff;border-radius:16px;padding:40px 28px;box-shadow:0 4px 12px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 10px}p{color:#6b7280;font-size:14px;margin:0 0 22px}a.btn{display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700}.spin{display:inline-block;width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#8b5cf6;border-radius:50%;animation:s 0.9s linear infinite;margin:0 0 18px}@keyframes s{to{transform:rotate(360deg)}}</style>
</head><body><div class="card">
<div class="spin"></div>
<h1>시안 ${choice} 응답을 저장하는 중...</h1>
<p>잠시만 기다려주세요. 자동으로 이동하지 않으면 아래 버튼을 눌러주세요.</p>
<a class="btn" href="${confirmUrl}">시안 ${choice} 확정하기</a>
</div>
<script>setTimeout(function(){location.replace(${JSON.stringify(confirmUrl)})},250);</script>
</body></html>`;
        return new Response(page, { status: 200, headers: htmlHeaders });
      }

      // STEP 2: confirmed via JS — actually save the response.
      const result = await saveResponseAndReward(admin, tokenUserId, choice, null);
      if (result.already) {
        // Look up the actual stored choice so we never show the wrong one.
        const { data: existing } = await admin
          .from('survey_responses')
          .select('choice')
          .eq('user_id', tokenUserId)
          .eq('survey_key', SURVEY_KEY)
          .maybeSingle();
        const actualChoice = (existing?.choice as string | undefined) || choice;
        return redirectToApp('already', undefined, actualChoice);
      }
      if (!result.success) {
        return redirectToApp('error', result.error, choice);
      }
      return redirectToApp('completed', undefined, choice);
    }

    // POST handler: accept either authenticated user OR HMAC-signed survey token
    const body = await req.json().catch(() => ({}));
    const choice = body?.choice;
    const feedback = typeof body?.feedback === 'string' ? body.feedback.slice(0, 1000) : null;
    const feedbackOnly = body?.feedbackOnly === true;
    const tokenFromBody = typeof body?.token === 'string' ? body.token : null;

    let userId: string | null = null;

    // Path A: HMAC token from email link (no auth header required)
    if (tokenFromBody) {
      userId = await verifySurveyToken(tokenFromBody);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: '유효하지 않은 설문 링크입니다.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Path B: standard auth header (logged-in user submitting via UI)
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
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        userId = user.id;
      } else {
        try {
          const { data: claimsData } = await authClient.auth.getClaims(token);
          userId = (claimsData?.claims?.sub as string) || null;
        } catch (_) { /* ignore */ }
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: '유효하지 않은 토큰입니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // Feedback-only update: user already submitted via email, just add free-text opinion
    if (feedbackOnly) {
      if (!feedback || !feedback.trim()) {
        return new Response(JSON.stringify({ success: false, error: '의견을 입력해주세요.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: existing, error: findErr } = await admin
        .from('survey_responses')
        .select('id')
        .eq('user_id', userId)
        .eq('survey_key', SURVEY_KEY)
        .maybeSingle();
      if (findErr || !existing) {
        return new Response(JSON.stringify({ success: false, error: '먼저 시안을 선택해주세요.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: updErr } = await admin
        .from('survey_responses')
        .update({ feedback })
        .eq('id', existing.id);
      if (updErr) {
        console.error('feedback update error', updErr);
        return new Response(JSON.stringify({ success: false, error: '의견 저장 중 오류가 발생했습니다.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, feedbackSaved: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (choice !== 'A' && choice !== 'B') {
      return new Response(JSON.stringify({ success: false, error: '선택지가 올바르지 않습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await saveResponseAndReward(admin, userId, choice, feedback);
    if (result.already) {
      return new Response(JSON.stringify(result), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('grant-survey-credit error', e);
    return new Response(JSON.stringify({ success: false, error: '서버 오류' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
