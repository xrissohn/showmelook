import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferralSuccessEmailRequest {
  referrer_email: string;
  referrer_name: string;
  referee_name: string;
  reward_type: 'bonus_credits' | 'profile_slot';
}

const getEmailTemplate = (referrerName: string, refereeName: string, rewardType: string): string => {
  const rewardDescription = rewardType === 'profile_slot' 
    ? '프로필 슬롯 1개가 영구적으로 추가되었습니다!' 
    : '보너스 생성 5회가 추가되었습니다! (30일간 유효)';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>추천 성공 알림</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🎉 추천 성공!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937; font-weight: 600;">
                안녕하세요, ${referrerName}님!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                축하합니다! <strong>${refereeName}</strong>님이 회원님의 추천 코드로 가입했습니다.
              </p>
              
              <!-- Reward Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background: linear-gradient(135deg, #f3e8ff 0%, #fce7f3 100%); border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #7c3aed; font-weight: 600; text-transform: uppercase;">
                      리워드 획득
                    </p>
                    <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 700;">
                      ${rewardDescription}
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                친구 추천을 통해 더 많은 리워드를 받아보세요!<br>
                추천 코드는 마이페이지에서 확인할 수 있습니다.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <a href="https://showmelook.com/mypage" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      마이페이지 가기
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">
                쇼미룩 - AI가 만들어주는 나만의 스타일
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 ShowMeLook. All rights reserved.
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
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internal = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (internal !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { referrer_email, referrer_name, referee_name, reward_type }: ReferralSuccessEmailRequest = await req.json();

    if (!referrer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referrer_email)) {
      return new Response(
        JSON.stringify({ success: false, error: '유효한 이메일이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = getEmailTemplate(referrer_name, referee_name, reward_type);

    // Try primary sender using Resend API directly
    const sendEmail = async (from: string) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [referrer_email],
          subject: "🎉 친구가 추천 코드로 가입했어요!",
          html,
        }),
      });
      return response.json();
    };

    let emailResponse = await sendEmail("쇼미룩 <noreply@showmelook.com>");

    // Fallback sender if primary fails
    if (!emailResponse?.id) {
      emailResponse = await sendEmail("ShowMeLook <onboarding@resend.dev>");
    }

    console.log("Referral success email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Send referral email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
