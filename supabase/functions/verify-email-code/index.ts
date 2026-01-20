import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  code: string;
  purpose: "signup" | "password_reset";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, purpose }: VerifyRequest = await req.json();

    if (!email || !code || !purpose) {
      return new Response(
        JSON.stringify({ error: "이메일, 인증코드, 용도가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 인증코드 형식입니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the most recent unverified code
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("email_verifications")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({ error: "인증코드를 찾을 수 없습니다. 새로운 코드를 요청해주세요." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "인증코드가 만료되었습니다. 새로운 코드를 요청해주세요." }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check attempt count
    if (verification.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "시도 횟수를 초과했습니다. 새로운 코드를 요청해주세요." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Increment attempt count
    await supabaseAdmin
      .from("email_verifications")
      .update({ attempts: verification.attempts + 1 })
      .eq("id", verification.id);

    // Verify the code
    if (verification.verification_code !== code) {
      const remainingAttempts = 4 - verification.attempts;
      return new Response(
        JSON.stringify({ 
          error: `인증코드가 일치하지 않습니다. (남은 시도: ${remainingAttempts}회)`,
          remainingAttempts 
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from("email_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "인증 처리에 실패했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Email verified: ${email} for ${purpose}`);

    return new Response(
      JSON.stringify({ 
        verified: true, 
        message: "이메일이 인증되었습니다.",
        verificationId: verification.id
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in verify-email-code:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
