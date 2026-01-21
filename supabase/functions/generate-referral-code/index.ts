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

    // 1. 기존 코드 확인
    const { data: existingCode } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (existingCode) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          code: existingCode.code,
          used_count: existingCode.used_count,
          max_uses: existingCode.max_uses,
          is_active: existingCode.is_active,
          created: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. 새 코드 생성 (8자리 영문+숫자)
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let newCode = '';
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (codeExists && attempts < maxAttempts) {
      newCode = generateCode();
      const { data: check } = await supabase
        .from('referral_codes')
        .select('id')
        .eq('code', newCode)
        .single();
      codeExists = !!check;
      attempts++;
    }

    if (codeExists) {
      return new Response(
        JSON.stringify({ success: false, error: '코드 생성에 실패했습니다. 다시 시도해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. 코드 저장
    const { data: insertedCode, error: insertError } = await supabase
      .from('referral_codes')
      .insert({
        user_id: user_id,
        code: newCode,
        used_count: 0,
        max_uses: 5,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: '코드 저장에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        code: insertedCode.code,
        used_count: insertedCode.used_count,
        max_uses: insertedCode.max_uses,
        is_active: insertedCode.is_active,
        created: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate referral code error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
