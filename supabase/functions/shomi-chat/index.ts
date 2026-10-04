import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { KNOWLEDGE } from "./knowledge.ts";

const Body = z.object({
  language: z.enum(["ko", "en"]).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
});

const SYSTEM = (lang: string) => `너는 쇼미룩(ShowMeLook)의 패셔니스타 캐릭터 "쇼미(ShowMi)"야. 아래 지식의 캐릭터 설정대로 친근한 반말(MZ 캐주얼 톤)로, 짧고 따뜻하게 답해.
규칙:
- 쇼미룩 서비스·등급·사용법·스타일 가이드·쇼미 자신에 대한 질문은 아래 지식에 근거해서만 답하고, 모르는 건 지어내지 말고 모른다고 말한 뒤 관련 페이지(showmelook.com/...)를 안내해.
- 코디·스타일 조언은 자유롭게 하되, 직접 룩을 보고 싶으면 /style 에서 만들어보라고 권해.
- 투자·재무 세부사항, 내부 운영 정보, 개인 연락처는 공유하지 마.
- 답변은 3~6문장 이내, 필요하면 짧은 목록. 마크다운 굵게 정도만 사용.
- ${lang === "en" ? "Reply in English (casual, friendly)." : "사용자가 쓰는 언어로 답해(기본 한국어)."}

=== 지식 ===
${KNOWLEDGE}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status: number) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "잘못된 요청이에요." }, 400);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI 설정이 없어요." }, 500);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        stream: true,
        messages: [{ role: "system", content: SYSTEM(parsed.data.language ?? "ko") }, ...parsed.data.messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      console.error("shomi-chat gateway", upstream.status, text);
      const msg =
        upstream.status === 429
          ? "지금 질문이 많아서 잠시 후 다시 물어봐 줘!"
          : upstream.status === 402
          ? "AI 사용량이 소진됐어. 잠시 후 다시 시도해 줘."
          : "쇼미가 지금 답하기 어려워. 잠시 후 다시 시도해 줘.";
      return json({ error: msg }, upstream.status);
    }

    const out = new Headers({ ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase().startsWith("x-lovable-aig-")) out.set(k, v);
    });
    return new Response(upstream.body, { headers: out });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("shomi-chat error", e);
    return json({ error: "쇼미가 지금 답하기 어려워." }, 500);
  }
});
