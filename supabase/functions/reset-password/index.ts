import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  verificationId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, newPassword, verificationId }: ResetPasswordRequest = await req.json();

    if (!email || !newPassword || !verificationId) {
      return new Response(
        JSON.stringify({ error: "이메일, 새 비밀번호, 인증 ID가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password length
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "비밀번호는 최소 6자 이상이어야 합니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the verification record exists and is verified
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from("email_verifications")
      .select("*")
      .eq("id", verificationId)
      .eq("email", email.toLowerCase())
      .eq("purpose", "password_reset")
      .not("verified_at", "is", null)
      .single();

    if (verifyError || !verification) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 인증 정보입니다. 다시 시도해주세요." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if verification is not too old (within 10 minutes of verification)
    const verifiedAt = new Date(verification.verified_at);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (verifiedAt < tenMinutesAgo) {
      return new Response(
        JSON.stringify({ error: "인증이 만료되었습니다. 다시 시도해주세요." }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find user by email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("User lookup error:", userError);
      return new Response(
        JSON.stringify({ error: "사용자를 찾을 수 없습니다." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "해당 이메일로 가입된 계정이 없습니다." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password using Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "비밀번호 변경에 실패했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Delete used verification records for this email
    await supabaseAdmin
      .from("email_verifications")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("purpose", "password_reset");

    console.log(`Password reset successful for ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "비밀번호가 성공적으로 변경되었습니다." 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in reset-password:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
