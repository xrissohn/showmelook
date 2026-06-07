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

    // Verify the token using getUser (most reliable for Edge Functions)
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Try getUser first (validates against server)
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      // Fallback: try getClaims for offline token validation
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          console.log('Auth failed - both getUser and getClaims failed');
          // Return empty result instead of 401 for graceful handling
          return new Response(
            JSON.stringify({ success: true, total: 0, details: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Use claims sub as userId
        var userId = claimsData.claims.sub as string;
      } catch (e) {
        console.log('Auth token expired or invalid, returning empty result');
        return new Response(
          JSON.stringify({ success: true, total: 0, details: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      var userId = user.id;
    }
    
    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 활성화된 보너스 크레딧 조회 (추천인/피추천인 모두 포함)
    // referrer_user_id: 본인이 받은 보너스 (추천인으로서 또는 피추천인 웰컴 보너스)
    // 모든 보상 내역 조회 (활성 + 만료/소진 포함, 본인이 받은 모든 크레딧)
    const { data: rewards, error } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ success: false, error: '조회 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const isActiveRow = (r: any) =>
      r.is_active && (r.remaining_amount ?? 0) > 0 &&
      (!r.expires_at || new Date(r.expires_at).getTime() > now);

    const total = (rewards || []).filter(isActiveRow)
      .reduce((sum, r) => sum + (r.remaining_amount || 0), 0);

    const details = (rewards || []).map((r: any) => ({
      id: r.id,
      amount: r.amount,
      remaining: r.remaining_amount,
      expires_at: r.expires_at,
      is_permanent: r.is_permanent,
      is_active: isActiveRow(r),
      reward_type: r.reward_type,
      referral_code: r.referral_code,
      referee_user_id: r.referee_user_id,
      created_at: r.created_at,
    }));

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
