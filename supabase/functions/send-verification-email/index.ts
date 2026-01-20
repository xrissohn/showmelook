import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  purpose: "signup" | "password_reset";
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailTemplate(code: string, purpose: "signup" | "password_reset"): string {
  const title = purpose === "signup" ? "회원가입 인증코드" : "비밀번호 재설정 인증코드";
  const description = purpose === "signup" 
    ? "쇼미룩 회원가입을 위한 인증코드입니다." 
    : "비밀번호 재설정을 위한 인증코드입니다.";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.15);">
          <tr>
            <td align="center" style="padding: 32px 24px 24px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #d4af37;">쇼미룩</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.7);">ShowMeLook</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <p style="margin: 0 0 24px; font-size: 16px; color: rgba(255,255,255,0.9); text-align: center; line-height: 1.6;">
                ${description}
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 24px; background: rgba(212, 175, 55, 0.1); border: 2px dashed rgba(212, 175, 55, 0.3); border-radius: 12px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px;">인증코드</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; color: #d4af37; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 14px; color: rgba(255,255,255,0.6); text-align: center;">
                이 코드는 <strong style="color: #d4af37;">5분 후</strong> 만료됩니다.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.6;">
                본인이 요청하지 않았다면 이 이메일을 무시해주세요.<br>
                © 2025 쇼미룩. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmail(to: string, subject: string, html: string, fromEmail: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return { success: false, error: errorData.message || "Email send failed" };
  }

  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, purpose }: VerificationRequest = await req.json();

    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: "이메일과 용도가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 이메일 형식입니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentRequests, error: countError } = await supabaseAdmin
      .from("email_verifications")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .gte("created_at", fiveMinutesAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
      return new Response(
        JSON.stringify({ error: "서버 오류가 발생했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (recentRequests && recentRequests.length >= 3) {
      return new Response(
        JSON.stringify({ error: "너무 많은 요청입니다. 5분 후 다시 시도해주세요." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("email_verifications")
      .insert({
        email: email.toLowerCase(),
        verification_code: code,
        purpose,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "인증코드 저장에 실패했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = purpose === "signup" 
      ? "[쇼미룩] 회원가입 인증코드" 
      : "[쇼미룩] 비밀번호 재설정 인증코드";

    // Try primary email first
    let result = await sendEmail(email, subject, getEmailTemplate(code, purpose), "쇼미룩 <noreply@showmelook.com>");
    
    if (!result.success) {
      console.log("Primary email failed, trying fallback:", result.error);
      // Try fallback
      result = await sendEmail(email, subject, getEmailTemplate(code, purpose), "쇼미룩 <onboarding@resend.dev>");
      
      if (!result.success) {
        console.error("Fallback email also failed:", result.error);
        return new Response(
          JSON.stringify({ error: "이메일 발송에 실패했습니다." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Verification code sent to ${email} for ${purpose}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "인증코드가 발송되었습니다.",
        expiresAt 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
