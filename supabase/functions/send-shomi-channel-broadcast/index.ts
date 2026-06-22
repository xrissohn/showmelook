import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const CAMPAIGN_KEY = "shomi_channel_v1";
const UNSUB_BASE = `${SUPABASE_URL}/functions/v1/survey-unsubscribe`;
const HERO_URL = "https://mggedvvzpwxlgrhatrau.supabase.co/storage/v1/object/public/generated-looks/channel%2Fshomi-hero.png";
const LOGO_URL = "https://mggedvvzpwxlgrhatrau.supabase.co/storage/v1/object/public/generated-looks/survey/shomi-logo.png";

const CHANNELS = {
  instagram: "https://www.instagram.com/showmi.look",
  youtube: "https://www.youtube.com/@showmi_tv",
  tiktok: "https://www.tiktok.com/@showmi.look",
  threads: "https://www.threads.net/@showmi.look",
};
const SITE_URL = "https://showmelook.com";

const DEFAULT_SUBJECT = "[쇼미룩] 쇼미룩의 모델 '쇼미'를 소개합니다 ✨ 채널 4곳도 함께 오픈!";
const DEFAULT_BODY = `안녕하세요, 쇼미룩입니다.

쇼미룩을 대표하는 가상 모델 '쇼미'가 새롭게 선정됐어요.
성수동 감성의 일상룩, 트렌디한 코디, 스타일 팁을
쇼미와 함께 더 가깝게 만나보실 수 있도록
인스타그램 · 유튜브 · 틱톡 · 스레드 4개 채널을 동시에 오픈했습니다.

룩이 고민될 땐 언제든 쇼미에게 물어봐 주세요.
쇼미룩 AI가 당신에게 어울리는 코디를 추천해드립니다.`;

async function makeUnsubToken(userId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(userId));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${userId}.${sigB64}`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyTextToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;color:#1f2937;line-height:1.75;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function buildEmailHtml(opts: { bodyText: string; subject: string; unsubUrl: string }) {
  const bodyHtml = bodyTextToHtml(opts.bodyText || DEFAULT_BODY);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(opts.subject)}</title></head>
<body style="margin:0;padding:0;font-family:'Pretendard',-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(30,27,75,0.08);">
    <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#7c3aed 50%,#ec4899 100%);padding:28px 30px;text-align:center;">
      <p style="margin:0;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.85);font-weight:600;">SHOWMELOOK · 쇼미</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.4px;">쇼미룩의 새 모델, '쇼미'</h1>
    </td></tr>

    <tr><td style="padding:0;background:#fdf2f7;">
      <img src="${HERO_URL}" alt="쇼미룩의 가상 모델 쇼미" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;" />
    </td></tr>

    <tr><td style="padding:32px 32px 8px;">
      <h2 style="margin:0 0 14px;font-size:20px;font-weight:800;color:#1e1b4b;letter-spacing:-0.3px;line-height:1.4;">
        쇼미의 스타일 채널이 오픈됐어요 <span style="color:#ec4899;">✨</span>
      </h2>
      ${bodyHtml}
    </td></tr>

    <tr><td style="padding:8px 32px 4px;">
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;font-weight:600;text-align:center;letter-spacing:0.3px;">
        쇼미를 4개 채널에서 만나보세요
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr>
          <td width="50%" style="padding:0 5px 10px 0;">
            <a href="${CHANNELS.instagram}" style="display:block;background:linear-gradient(135deg,#feda75 0%,#d62976 50%,#4f5bd5 100%);color:#ffffff;text-decoration:none;text-align:center;padding:13px 10px;border-radius:12px;font-size:14px;font-weight:700;">
              📷 Instagram
            </a>
          </td>
          <td width="50%" style="padding:0 0 10px 5px;">
            <a href="${CHANNELS.youtube}" style="display:block;background:#FF0000;color:#ffffff;text-decoration:none;text-align:center;padding:13px 10px;border-radius:12px;font-size:14px;font-weight:700;">
              ▶ YouTube
            </a>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:0 5px 0 0;">
            <a href="${CHANNELS.tiktok}" style="display:block;background:#000000;color:#ffffff;text-decoration:none;text-align:center;padding:13px 10px;border-radius:12px;font-size:14px;font-weight:700;">
              🎵 TikTok
            </a>
          </td>
          <td width="50%" style="padding:0 0 0 5px;">
            <a href="${CHANNELS.threads}" style="display:block;background:#101010;color:#ffffff;text-decoration:none;text-align:center;padding:13px 10px;border-radius:12px;font-size:14px;font-weight:700;">
              @ Threads
            </a>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 32px 32px;text-align:center;">
      <a href="${SITE_URL}" style="display:inline-block;background:#1e1b4b;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:700;">
        쇼미룩에서 내 룩 추천받기 →
      </a>
    </td></tr>

    <tr><td style="background:#f9fafb;padding:22px 30px;text-align:center;border-top:1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="쇼미룩" width="32" height="32" style="display:inline-block;margin:0 0 8px;width:32px;height:32px;border:0;" />
      <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">쇼미룩 · AI 가상 피팅 서비스</p>
      <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
        이 메일을 받고 싶지 않으시면 <a href="${opts.unsubUrl}" style="color:#9ca3af;text-decoration:underline;">수신거부</a>하실 수 있습니다.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function sendOne(to: string, html: string, subject: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "쇼미룩 <noreply@showmelook.com>", to: [to], subject, html }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j?.id, error: j?.id ? undefined : (j?.message || `status ${r.status}`) };
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
    const includeAlreadySent = body.includeAlreadySent === true;

    // RENDER MODE
    if (mode === "render") {
      const html = buildEmailHtml({ bodyText, subject, unsubUrl: `${UNSUB_BASE}?token=preview` });
      return new Response(JSON.stringify({ subject, html }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // TEST MODE — send to one address
    if (mode === "test") {
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "testEmail required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const unsubToken = await makeUnsubToken(userId);
      const html = buildEmailHtml({ bodyText, subject, unsubUrl: `${UNSUB_BASE}?token=${unsubToken}` });
      const r = await sendOne(testEmail, html, subject);
      return new Response(JSON.stringify({ ok: r.ok, error: r.error }), { status: r.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List users
    const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 5000 });
    if (listErr) throw listErr;

    const { data: optOuts } = await admin.from("profiles").select("user_id").eq("email_opt_out", true);
    const optOutSet = new Set((optOuts || []).map((r: any) => r.user_id));

    const { data: alreadySent } = await admin
      .from("channel_email_sends")
      .select("user_id")
      .eq("campaign_key", CAMPAIGN_KEY)
      .eq("status", "sent");
    const sentSet = new Set((alreadySent || []).map((r: any) => r.user_id));

    type Target = { user_id: string; email: string };
    const targets: Target[] = [];
    let skipped = 0;
    for (const u of authUsers.users) {
      if (!u.email) continue;
      if (optOutSet.has(u.id) || (!includeAlreadySent && sentSet.has(u.id))) { skipped++; continue; }
      targets.push({ user_id: u.id, email: u.email });
    }

    if (mode === "preview") {
      return new Response(JSON.stringify({
        totalUsers: authUsers.users.length,
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
        const html = buildEmailHtml({ bodyText, subject, unsubUrl: `${UNSUB_BASE}?token=${unsubToken}` });
        const r = await sendOne(t.email, html, subject);
        return { target: t, r };
      }));
      const logRows = results.map(({ target, r }) => ({
        user_id: target.user_id,
        email: target.email,
        campaign_key: CAMPAIGN_KEY,
        status: r.ok ? "sent" : "failed",
        error: r.ok ? null : (r.error?.slice(0, 500) ?? "unknown"),
      }));
      await admin.from("channel_email_sends").upsert(logRows, { onConflict: "user_id,campaign_key" });
      for (const { r } of results) r.ok ? sent++ : failed++;
      if (i + CHUNK < targets.length) await new Promise((res) => setTimeout(res, 1100));
    }

    return new Response(JSON.stringify({ total: targets.length, sent, failed, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-shomi-channel-broadcast error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
