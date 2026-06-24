import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
}

function getWelcomeTemplate(fullName: string): string {
  const displayName = fullName || "고객";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>쇼미룩에 오신 것을 환영합니다!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 520px; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.15);">
          <tr>
            <td align="center" style="padding: 40px 24px 24px;">
              <p style="margin: 0 0 8px; font-size: 32px;">🎉</p>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #d4af37;">쇼미룩</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.7);">ShowMeLook</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 24px;">
              <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #fff; text-align: center;">
                ${displayName}님, 환영합니다!
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; color: rgba(255,255,255,0.85); text-align: center; line-height: 1.6;">
                AI가 만들어주는 나만의 스타일을 경험해보세요.
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <span style="font-size: 20px;">✓</span>
                    <strong style="color: #d4af37; margin-left: 8px;">체형 맞춤 추천</strong>
                    <span style="color: rgba(255,255,255,0.7); display: block; margin-left: 28px; font-size: 14px;">키, 몸무게, 체형에 맞는 스타일 제안</span>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <span style="font-size: 20px;">✓</span>
                    <strong style="color: #d4af37; margin-left: 8px;">실제 구매 연결</strong>
                    <span style="color: rgba(255,255,255,0.7); display: block; margin-left: 28px; font-size: 14px;">추천 상품을 바로 구매할 수 있어요</span>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <span style="font-size: 20px;">✓</span>
                    <strong style="color: #d4af37; margin-left: 8px;">가족 프로필</strong>
                    <span style="color: rgba(255,255,255,0.7); display: block; margin-left: 28px; font-size: 14px;">가족 구성원의 스타일도 함께 관리</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="https://showmelook.lovable.app/style" 
                       style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #1a1a2e; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                      스타일 만들러 가기 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.6;">
                궁금한 점이 있으시면 언제든 문의해주세요.<br>
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
    const internal = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (internal !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, fullName }: WelcomeEmailRequest = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "유효한 이메일이 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = "[쇼미룩] 환영합니다! AI 스타일 추천을 시작해보세요 🎉";
    
    let result = await sendEmail(email, subject, getWelcomeTemplate(fullName), "쇼미룩 <noreply@showmelook.com>");
    
    if (!result.success) {
      console.log("Primary email failed, trying fallback:", result.error);
      result = await sendEmail(email, subject, getWelcomeTemplate(fullName), "쇼미룩 <onboarding@resend.dev>");
      
      if (!result.success) {
        console.error("Fallback email also failed:", result.error);
        return new Response(
          JSON.stringify({ error: "환영 이메일 발송에 실패했습니다." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Welcome email sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "환영 이메일이 발송되었습니다." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in send-welcome-email:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
