// Internal only (service role). Sign-up sends the welcome email from complete-signup directly;
// this endpoint stays for internal re-sends and shares the same template.
import { sendWelcomeEmail } from "../_shared/welcomeEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const internal = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (internal !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ error: "Unauthorized", error_code: "unauthorized" }, 401);
    }

    const { email, fullName, language } = await req.json();
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "유효한 이메일이 필요합니다.", error_code: "invalid_email" }, 400);
    }

    const ok = await sendWelcomeEmail(email, typeof fullName === "string" ? fullName : "", language === "en" ? "en" : "ko");
    if (!ok) return json({ error: "환영 이메일 발송에 실패했습니다.", error_code: "email_send_failed" }, 500);
    return json({ success: true, message: "환영 이메일이 발송되었습니다." });
  } catch (error) {
    console.error("Error in send-welcome-email:", error);
    return json({ error: "서버 오류가 발생했습니다.", error_code: "server_error" }, 500);
  }
});
