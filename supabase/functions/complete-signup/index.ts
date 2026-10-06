import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkPassword } from "../_shared/passwordPolicy.ts";
import { sendWelcomeEmail } from "../_shared/welcomeEmail.ts";
import { applyReferralForNewUser } from "../_shared/referral.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fail = (error_code: string, message: string, status: number, extra: Record<string, unknown> = {}) =>
  json({ success: false, error_code, message, error: message, ...extra }, status);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const VERIFICATION_WINDOW_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Method not allowed", 405);

  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body?.password;
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 100) : "";
    const verificationId = typeof body?.verificationId === "string" ? body.verificationId : "";
    const referralCode = typeof body?.referralCode === "string" ? body.referralCode.slice(0, 32) : "";
    const language = body?.language === "en" ? "en" : "ko";

    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      return fail("invalid_email", "유효하지 않은 이메일 형식입니다.", 400);
    }
    if (!verificationId || !UUID_RE.test(verificationId)) {
      return fail("verification_required", "이메일 인증이 필요합니다. 다시 인증해주세요.", 400);
    }
    if (checkPassword(password)) {
      return fail("weak_password", "비밀번호는 6자 이상이어야 합니다.", 400, { reasons: ["length"] });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existingId, error: lookupErr } = await admin.rpc("get_auth_user_id_by_email", { _email: email });
    if (lookupErr) {
      console.error("lookup error", lookupErr);
      return fail("server_error", "서버 오류가 발생했습니다.", 500);
    }
    if (existingId) return fail("user_already_exists", "이미 가입된 이메일입니다.", 409);

    // Consume the verification atomically (one use only, verified within 30 minutes).
    const since = new Date(Date.now() - VERIFICATION_WINDOW_MS).toISOString();
    const { data: consumed, error: consumeErr } = await admin
      .from("email_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", verificationId)
      .eq("email", email)
      .eq("purpose", "signup")
      .is("consumed_at", null)
      .gte("verified_at", since)
      .select("id");
    if (consumeErr) {
      console.error("consume error", consumeErr);
      return fail("server_error", "서버 오류가 발생했습니다.", 500);
    }
    if (!consumed?.length) {
      return fail("verification_required", "이메일 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.", 400);
    }

    const release = () =>
      admin.from("email_verifications").update({ consumed_at: null }).eq("id", verificationId);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created?.user) {
      await release();
      // deno-lint-ignore no-explicit-any
      const code = (createErr as any)?.code as string | undefined;
      if (code === "email_exists" || code === "user_already_exists" || /already been registered/i.test(createErr?.message ?? "")) {
        return fail("user_already_exists", "이미 가입된 이메일입니다.", 409);
      }
      if (code === "weak_password" || /password/i.test(createErr?.message ?? "")) {
        // deno-lint-ignore no-explicit-any
        const reasons = (createErr as any)?.reasons ?? (createErr as any)?.weak_password?.reasons ?? [];
        return fail("weak_password", "더 안전한 비밀번호를 사용해주세요.", 400, { reasons });
      }
      console.error("createUser error", createErr);
      return fail("server_error", "계정 생성에 실패했습니다.", 500);
    }

    const userId = created.user.id;
    let referral: unknown = null;
    if (referralCode) {
      try {
        referral = await applyReferralForNewUser(admin, userId, referralCode, fullName);
      } catch (e) {
        console.error("referral failed", e);
      }
    }

    const welcomeSent = await sendWelcomeEmail(email, fullName, language).catch(() => false);

    return json({ success: true, referral, welcome_email_sent: welcomeSent });
  } catch (e) {
    console.error("complete-signup error", e);
    return fail("server_error", "서버 오류가 발생했습니다.", 500);
  }
});
