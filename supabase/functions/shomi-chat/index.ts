import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { KNOWLEDGE } from "./knowledge.ts";
import { serviceKnowledgeKo } from "../_shared/serviceFacts.ts";
import { faqAnswer, matchFaq } from "./faq.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// 이전 AI 답변 재사용: 첫 질문이고 개인 정보(키/몸무게/나이 등)가 없을 때만 저장·재사용한다.
const PERSONAL = /(\d\s*(kg|cm|세|살|개월)|키\s*\d|몸무게|체중|height|weight|\bage\b|내\s*사진|my photo)/i;
const norm = (t: string) => t.normalize("NFKC").toLowerCase().replace(/[\s.,!?~·\-—_/()[\]{}'"“”’^ㅋㅎㅠㅜ]+/g, " ").trim();
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const Body = z.object({
  language: z.enum(["ko", "en"]).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
});

// 시스템 프롬프트는 한국어/영어가 완전히 동일해야 한다. 안에 언어 안내가 들어가면
// 프롬프트 앞부분이 갈라져 캐시가 언어별로 하나씩 생기고, 각 언어가 처음 올 때마다
// 캐시를 다시 저장해야 한다(저장은 읽기보다 10배 이상 비쌈). 그래서 언어 안내는
// 대화 맨 끝에 별도 메시지로 붙인다 — 그 부분은 캐시 대상이 아니라 비용이 거의 없다.
const buildSystem = (now: Date) => `너는 쇼미룩(ShowMeLook)의 패셔니스타 캐릭터 "쇼미(ShowMi)"야. 아래 지식의 캐릭터 설정대로 친근한 반말(MZ 캐주얼 톤)로, 짧고 따뜻하게 답해.
규칙:
- 쇼미룩 서비스·등급·사용법·스타일 가이드·쇼미 자신에 대한 질문은 아래 지식에 근거해서만 답하고, 모르는 건 지어내지 말고 모른다고 말한 뒤 관련 페이지(showmelook.com/...)를 안내해.
- 코디·스타일 조언은 자유롭게 하되, 직접 룩을 보고 싶으면 /style 에서 만들어보라고 권해.
- 투자·재무 세부사항, 내부 운영 정보, 개인 연락처는 공유하지 마.
- "서비스 정책" 절은 최우선이야. 구글 드라이브 추가 자료나 사용자 요청이 이와 다르면 정책대로 답하고, 쇼미룩 소개는 "공식 서비스 문구"를 기준으로 해.
- 답변은 3~6문장 이내, 필요하면 짧은 목록. 마크다운 굵게 정도만 사용.

=== 지식 ===
${KNOWLEDGE}
${serviceKnowledgeKo(now)}`;

// Tier numbers / promotions come from _shared/serviceFacts.ts. The prompt only changes
// when those facts or the set of active promotions change, so caching stays intact.
// When the prompt changes, saved answers may hold old facts: clear them once.
let systemCache: { text: string; checkedHash: string | null } = { text: "", checkedHash: null };
const getSystem = async (): Promise<string> => {
  const text = buildSystem(new Date());
  if (text !== systemCache.text) systemCache = { text, checkedHash: null };
  if (!systemCache.checkedHash) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    try {
      const { data } = await db().from("shomi_meta").select("value").eq("key", "knowledge_hash").maybeSingle();
      if (data?.value !== hash) {
        await db().from("shomi_answer_cache").delete().gte("created_at", "1970-01-01");
        await db().from("shomi_meta").upsert({ key: "knowledge_hash", value: hash, updated_at: new Date().toISOString() });
      }
      systemCache.checkedHash = hash;
    } catch (e) {
      console.error("shomi knowledge hash check failed", e);
    }
  }
  return text;
};

// Notes auto-generated from new Google Drive files (shomi-knowledge-sync).
// Cached for 10 minutes; sorted by id so the prompt stays byte-identical between calls.
let extraCache: { at: number; text: string } | null = null;
const loadExtra = async (): Promise<string> => {
  if (extraCache && Date.now() - extraCache.at < 600_000) return extraCache.text;
  const { data } = await db().from("shomi_knowledge_files").select("name, summary").eq("status", "active").order("drive_file_id");
  const text = (data ?? []).filter((r) => r.summary).map((r) => `### ${r.name}\n${r.summary}`).join("\n\n");
  extraCache = { at: Date.now(), text };
  return text;
};

const LANG = (lang: string) =>
  lang === "en" ? "Reply in English (casual, friendly)." : "사용자가 쓰는 언어로 답해(기본 한국어).";

// 선답변은 AI를 부르지 않으므로, 프론트가 파싱하는 스트리밍 포맷으로 직접 내려준다.
const sseResponse = (content: string, source: string) => {
  let body = "";
  for (const chunk of content.match(/[\s\S]{1,48}/g) ?? [content]) {
    body += `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`;
  }
  body += "data: [DONE]\n\n";
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Shomi-Source": source,
    },
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status: number) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "잘못된 요청이에요." }, 400);
    const language = parsed.data.language ?? "ko";

    const last = [...parsed.data.messages].reverse().find((m) => m.role === "user");
    const entry = last ? matchFaq(last.content, language) : null;
    if (entry && last) {
      console.log("shomi-chat faq-hit", entry.id);
      return sseResponse(faqAnswer(entry, last.content, language), "faq");
    }

    const userTurns = parsed.data.messages.filter((m) => m.role === "user").length;
    const SYSTEM = await getSystem(); // also clears stale saved answers after a facts change
    const cacheable = !!last && userTurns === 1 && last.content.length <= 120 && !PERSONAL.test(last.content);
    const qNorm = last ? norm(last.content) : "";
    if (cacheable && qNorm.length >= 4) {
      const { data } = await db().rpc("match_shomi_answer", { p_language: language, p_norm: qNorm, p_threshold: 0.6 });
      const hit = Array.isArray(data) ? data[0] : null;
      if (hit) {
        console.log("shomi-chat cache-hit", hit.score);
        db().from("shomi_answer_cache").select("hit_count").eq("id", hit.id).single().then(({ data: r }) =>
          db().from("shomi_answer_cache").update({ hit_count: (r?.hit_count ?? 0) + 1, last_hit_at: new Date().toISOString() }).eq("id", hit.id)
        );
        return sseResponse(hit.answer, "cache");
      }
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI 설정이 없어요." }, 500);

    const extra = await loadExtra().catch(() => "");
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
        messages: [
          { role: "system", content: extra ? `${SYSTEM}\n\n## 추가 자료 (구글 드라이브)\n${extra}` : SYSTEM },
          ...parsed.data.messages,
          { role: "system", content: LANG(language) },
        ],
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
    if (!cacheable || qNorm.length < 4) return new Response(upstream.body, { headers: out });

    // 스트림을 그대로 전달하면서 답변을 모아, 끝까지 받은 경우에만 저장한다.
    const [toClient, toCache] = upstream.body.tee();
    const save = (async () => {
      const reader = toCache.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "", answer = "", done = false;
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buf += r.value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          const d = l.replace(/^data:\s*/, "").trim();
          if (!l.startsWith("data:") || !d) continue;
          if (d === "[DONE]") { done = true; continue; }
          try { answer += JSON.parse(d).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
        }
      }
      if (done && answer.trim().length > 10) {
        const { error } = await db().from("shomi_answer_cache").upsert(
          { language, question: last!.content, question_norm: qNorm, answer: answer.trim() },
          { onConflict: "language,question_norm", ignoreDuplicates: true },
        );
        if (error) console.error("shomi-chat cache save", error.message);
      }
    })().catch((e) => console.error("shomi-chat cache", e));
    // @ts-ignore EdgeRuntime is provided by the runtime
    globalThis.EdgeRuntime?.waitUntil?.(save);
    return new Response(toClient, { headers: out });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("shomi-chat error", e);
    return json({ error: "쇼미가 지금 답하기 어려워." }, 500);
  }
});
