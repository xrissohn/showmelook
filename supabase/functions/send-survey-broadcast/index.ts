import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SURVEY_KEY = "shomi_ab_v1";
const SURVEY_URL = "https://showmelook.com/survey/shomi";
const RESPONSE_BASE = `${SUPABASE_URL}/functions/v1/grant-survey-credit`;
const UNSUB_BASE = `${SUPABASE_URL}/functions/v1/survey-unsubscribe`;
const LOGO_URL = "https://mggedvvzpwxlgrhatrau.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-logo.png";
const IMG_A_URL = "https://mggedvvzpwxlgrhatrau.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-a.png";
const IMG_B_URL = "https://mggedvvzpwxlgrhatrau.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-b.png";

const DEFAULT_SUBJECT = "[쇼미룩] 쇼미 캐릭터 AB 테스트 — 참여하고 무료 10크레딧 받으세요";
const DEFAULT_BODY = `안녕하세요, 쇼미룩입니다.

가상 인플루언서 '쇼미' 캐릭터를 새로 디자인 중이에요.
두 가지 시안 중 어느 쪽이 더 마음에 드시는지 의견을 들려주세요.

설문에 참여해주신 모든 분께 무료 10크레딧을 즉시 지급해드립니다.`;

async function makeUnsubToken(userId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(userId));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${userId}.${sigB64}`;
}

async function makeSurveyToken(userId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = `survey:${SURVEY_KEY}:${userId}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${userId}.${sigB64}`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyTextToHtml(text: string) {
  // preserve paragraphs (double newline) and line breaks
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function buildEmailHtml(opts: { bodyText: string; unsubUrl: string; responseToken?: string }) {
  const bodyHtml = bodyTextToHtml(opts.bodyText || DEFAULT_BODY);
  const voteAUrl = opts.responseToken ? `${RESPONSE_BASE}?token=${encodeURIComponent(opts.responseToken)}&choice=A` : SURVEY_URL;
  const voteBUrl = opts.responseToken ? `${RESPONSE_BASE}?token=${encodeURIComponent(opts.responseToken)}&choice=B` : SURVEY_URL;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>쇼미 캐릭터 AB 테스트</title></head>
<body style="margin:0;padding:0;font-family:'Pretendard',-apple-system,'Segoe UI',sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
    <tr><td style="background:linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%);padding:36px 30px;text-align:center;">
      <img src="${LOGO_URL}" alt="쇼미룩" width="96" height="96" style="display:block;margin:0 auto 14px;width:96px;height:96px;border:0;outline:none;text-decoration:none;" />
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">쇼미 캐릭터 AB 테스트</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,.92);font-size:14px;">참여하시면 무료 10크레딧을 즉시 드려요</p>
    </td></tr>
    <tr><td style="padding:32px 30px;">
      ${bodyHtml}
      <p style="margin:20px 0 14px;font-size:15px;color:#111827;font-weight:700;line-height:1.6;text-align:center;">아래 두 시안 중 더 마음에 드는 쪽을 선택해주세요.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
        <td width="50%" valign="top" style="padding:0 6px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fafafa;">
            <tr><td style="padding:10px;text-align:center;"><img src="${IMG_A_URL}" alt="쇼미 캐릭터 시안 A" width="210" style="display:block;width:100%;max-width:210px;height:auto;margin:0 auto;border:0;border-radius:10px;" /></td></tr>
            <tr><td style="padding:0 12px 14px;text-align:center;"><a href="${voteAUrl}" style="display:block;background:#111827;color:#fff;text-decoration:none;padding:12px 10px;border-radius:8px;font-size:15px;font-weight:700;">A 시안 선택</a></td></tr>
          </table>
        </td>
        <td width="50%" valign="top" style="padding:0 0 0 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fafafa;">
            <tr><td style="padding:10px;text-align:center;"><img src="${IMG_B_URL}" alt="쇼미 캐릭터 시안 B" width="210" style="display:block;width:100%;max-width:210px;height:auto;margin:0 auto;border:0;border-radius:10px;" /></td></tr>
            <tr><td style="padding:0 12px 14px;text-align:center;"><a href="${voteBUrl}" style="display:block;background:linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%);color:#fff;text-decoration:none;padding:12px 10px;border-radius:8px;font-size:15px;font-weight:700;">B 시안 선택</a></td></tr>
          </table>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">버튼을 누르면 바로 응답이 저장되고 10크레딧이 지급됩니다.</p>
    </td></tr>
    <tr><td style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="쇼미룩" width="36" height="36" style="display:inline-block;margin:0 0 8px;width:36px;height:36px;border:0;" />
      <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">쇼미룩 · AI 가상 피팅 서비스</p>
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        이 메일을 받고 싶지 않으시면 <a href="${opts.unsubUrl}" style="color:#9ca3af;text-decoration:underline;">수신거부</a>하실 수 있습니다.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function sendOne(to: string, html: string, subject: string): Promise<{ ok: boolean; error?: string }> {
  const tryFrom = async (from: string) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: !!j?.id, error: j?.id ? undefined : (j?.message || `status ${r.status}`) };
  };
  let res = await tryFrom("쇼미룩 <noreply@showmelook.com>");
  if (!res.ok) res = await tryFrom("ShowMeLook <onboarding@resend.dev>");
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");

    const supaUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    let userId: string | undefined;
    const { data: userData } = await supaUser.auth.getUser();
    userId = userData?.user?.id;
    if (!userId) {
      const { data: claimsData } = await supaUser.auth.getClaims(token);
      userId = claimsData?.claims?.sub as string | undefined;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "test" | "preview" | "broadcast" | "render" = body.mode ?? "preview";
    const testEmail: string | undefined = body.testEmail;
    const subject: string = (typeof body.subject === "string" && body.subject.trim()) ? body.subject.trim() : DEFAULT_SUBJECT;
    const bodyText: string = (typeof body.bodyText === "string" && body.bodyText.trim()) ? body.bodyText : DEFAULT_BODY;

    // RENDER MODE — returns the HTML preview (no send)
    if (mode === "render") {
      const html = buildEmailHtml({ bodyText, unsubUrl: `${UNSUB_BASE}?token=preview` });
      return new Response(JSON.stringify({ subject, html }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // TEST MODE
    if (mode === "test") {
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "testEmail required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const unsubToken = await makeUnsubToken(userId);
      const responseToken = await makeSurveyToken(userId);
      const html = buildEmailHtml({ bodyText, responseToken, unsubUrl: `${UNSUB_BASE}?token=${unsubToken}` });
      const r = await sendOne(testEmail, html, subject);
      return new Response(JSON.stringify({ ok: r.ok, error: r.error }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build recipient list
    const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 10000 });
    if (authErr) throw authErr;

    const { data: optOuts } = await admin.from("profiles").select("user_id").eq("email_opt_out", true);
    const optOutSet = new Set((optOuts || []).map((r: any) => r.user_id));

    const { data: responded } = await admin.from("survey_responses").select("user_id").eq("survey_key", SURVEY_KEY);
    const respondedSet = new Set((responded || []).map((r: any) => r.user_id));

    const { data: alreadySent } = await admin.from("survey_email_sends").select("user_id").eq("survey_key", SURVEY_KEY).eq("status", "sent");
    const sentSet = new Set((alreadySent || []).map((r: any) => r.user_id));

    type Target = { user_id: string; email: string };
    const targets: Target[] = [];
    let skipped = 0;
    for (const u of authUsers.users) {
      if (!u.email) continue;
      if (optOutSet.has(u.id) || respondedSet.has(u.id) || sentSet.has(u.id)) { skipped++; continue; }
      targets.push({ user_id: u.id, email: u.email });
    }

    if (mode === "preview") {
      return new Response(JSON.stringify({
        totalUsers: authUsers.users.length,
        responded: respondedSet.size,
        alreadySent: sentSet.size,
        optOut: optOutSet.size,
        toSend: targets.length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // BROADCAST
    let sent = 0, failed = 0;
    const CHUNK = 10;
    for (let i = 0; i < targets.length; i += CHUNK) {
      const chunk = targets.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map(async (t) => {
        const unsubToken = await makeUnsubToken(t.user_id);
        const responseToken = await makeSurveyToken(t.user_id);
        const html = buildEmailHtml({ bodyText, responseToken, unsubUrl: `${UNSUB_BASE}?token=${unsubToken}` });
        const r = await sendOne(t.email, html, subject);
        return { target: t, r };
      }));
      const logRows = results.map(({ target, r }) => ({
        user_id: target.user_id,
        email: target.email,
        survey_key: SURVEY_KEY,
        status: r.ok ? "sent" : "failed",
        error: r.ok ? null : (r.error?.slice(0, 500) ?? "unknown"),
      }));
      await admin.from("survey_email_sends").upsert(logRows, { onConflict: "user_id,survey_key" });
      for (const { r } of results) r.ok ? sent++ : failed++;
      if (i + CHUNK < targets.length) await new Promise((res) => setTimeout(res, 1100));
    }

    return new Response(JSON.stringify({ total: targets.length, sent, failed, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-survey-broadcast error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
