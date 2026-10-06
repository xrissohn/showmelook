// Welcome email sent by the server after sign-up (Resend).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export type WelcomeLang = "ko" | "en";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const COPY = {
  ko: {
    subject: "[쇼미룩] 환영합니다! AI 스타일 추천을 시작해보세요 🎉",
    hello: (n: string) => `${n}님, 환영합니다!`,
    fallbackName: "고객",
    intro: "AI가 만들어주는 나만의 스타일을 경험해보세요.",
    features: [
      ["체형 맞춤 추천", "키, 몸무게, 체형에 맞는 스타일 제안"],
      ["실제 구매 연결", "추천 상품을 바로 구매할 수 있어요"],
      ["가족 프로필", "가족 구성원의 스타일도 함께 관리"],
    ],
    cta: "스타일 만들러 가기 →",
    footer: "궁금한 점이 있으시면 언제든 문의해주세요.",
    brand: "쇼미룩",
  },
  en: {
    subject: "[ShowMeLook] Welcome! Start your AI styling 🎉",
    hello: (n: string) => `Welcome, ${n}!`,
    fallbackName: "there",
    intro: "Discover outfits styled just for you by AI.",
    features: [
      ["Body-fit recommendations", "Styles matched to your height, weight and shape"],
      ["Shop the look", "Buy recommended items right away"],
      ["Family profiles", "Manage styles for your whole family"],
    ],
    cta: "Create my style →",
    footer: "Questions? Reach out anytime.",
    brand: "ShowMeLook",
  },
};

export function welcomeTemplate(fullName: string, lang: WelcomeLang): { subject: string; html: string } {
  const c = COPY[lang] ?? COPY.ko;
  const name = esc((fullName || "").trim().slice(0, 100) || c.fallbackName);
  const year = new Date().getFullYear();
  const features = c.features.map(([t, d]) => `
                <tr><td style="padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                  <span style="font-size: 20px;">✓</span>
                  <strong style="color: #d4af37; margin-left: 8px;">${t}</strong>
                  <span style="color: rgba(255,255,255,0.7); display: block; margin-left: 28px; font-size: 14px;">${d}</span>
                </td></tr><tr><td style="height: 8px;"></td></tr>`).join("");
  const html = `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#ffffff;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" style="width:100%;max-width:520px;border-collapse:collapse;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:40px 24px 24px;">
        <p style="margin:0 0 8px;font-size:32px;">🎉</p>
        <h1 style="margin:0;font-size:28px;font-weight:700;color:#d4af37;">쇼미룩</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">ShowMeLook</p>
      </td></tr>
      <tr><td style="padding:0 24px;">
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#fff;text-align:center;">${c.hello(name)}</h2>
        <p style="margin:0 0 24px;font-size:16px;color:rgba(255,255,255,0.85);text-align:center;line-height:1.6;">${c.intro}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;">${features}</table>
        <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:8px 0 24px;">
          <a href="https://showmelook.com/style" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#d4af37 0%,#f4d03f 100%);color:#1a1a2e;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">${c.cta}</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:24px;"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.6;">${c.footer}<br>© ${year} ${c.brand}. All rights reserved.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject: c.subject, html };
}

export async function sendWelcomeEmail(email: string, fullName: string, lang: WelcomeLang): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const { subject, html } = welcomeTemplate(fullName, lang);
  const from = lang === "en" ? "ShowMeLook" : "쇼미룩";
  for (const addr of ["noreply@showmelook.com", "onboarding@resend.dev"]) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${from} <${addr}>`, to: [email], subject, html }),
      });
      if (res.ok) return true;
      console.log("welcome email failed via", addr, (await res.json().catch(() => ({})))?.message);
    } catch (e) {
      console.log("welcome email error via", addr, e);
    }
  }
  return false;
}
