import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sigB64] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, enc.encode(userId));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return expectedB64 === sigB64 ? userId : null;
}

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,'Pretendard','Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:40px 20px;color:#1f2937}
.card{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 12px rgba(0,0,0,.08);text-align:center}
h1{font-size:22px;margin:0 0 12px}p{font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 20px}
a{display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600}</style>
</head><body><div class="card">${body}</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(htmlPage("오류", `<h1>잘못된 요청</h1><p>유효하지 않은 링크입니다.</p>`), {
        status: 400, headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const userId = await verifyToken(token);
    if (!userId) {
      return new Response(htmlPage("오류", `<h1>유효하지 않은 링크</h1><p>토큰이 만료되었거나 잘못되었습니다.</p>`), {
        status: 400, headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("profiles").update({ email_opt_out: true }).eq("user_id", userId);

    return new Response(htmlPage("수신거부 완료", `
      <h1>✓ 수신거부 처리되었습니다</h1>
      <p>앞으로 쇼미룩 마케팅 메일을 보내드리지 않습니다.<br>다시 받고 싶으시면 마이페이지에서 설정하실 수 있어요.</p>
      <a href="https://showmelook.com">쇼미룩으로 돌아가기</a>`), {
      status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("survey-unsubscribe error:", e);
    return new Response(htmlPage("오류", `<h1>처리 실패</h1><p>잠시 후 다시 시도해주세요.</p>`), {
      status: 500, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
