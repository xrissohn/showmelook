// Shomi chat helpers shared by shomi-chat (Deno) and unit tests (Vitest). No runtime imports.

// ---- 한 단어 '추천' 같은 모호한 추천 요청 ----
// 이런 질문은 FAQ·AI 답변 캐시에 걸리면 엉뚱한 일반 답이 나가므로, 되묻고 /style 로 안내한다(AI 호출 없음).
const compact = (t: string) => t.normalize("NFKC").toLowerCase().replace(/[^0-9a-zㄱ-힝]+/g, "");
const VAGUE_RECOMMEND = new RegExp(
  "^(" +
    "(옷|코디|스타일|룩|패션|아이템)?(좀)?추천(해줘|해주세요|해줄래|해줄수있어|해봐|부탁|해|좀)?" +
    "|뭐입지|뭐입을까|뭐입어|뭐입고갈까|오늘뭐입지" +
    "|recommend|recommendation|recommendations|suggest|suggestions|recommendme|suggestme|recommendsomething|whattowear" +
    ")(요|야)?$",
);
export function isVagueRecommend(text: string): boolean {
  return VAGUE_RECOMMEND.test(compact(text));
}

export const RECOMMEND_CLARIFY = {
  ko: "추천해 줄게! 근데 어떤 상황이야? 🤔 데이트·출근·여행처럼 입을 자리랑 원하는 분위기(미니멀, 캐주얼 등), 예산을 알려주면 딱 맞게 말해줄게. 내 몸에 입힌 룩을 바로 보고 싶다면 /style 에서 만들어 봐!",
  en: "Happy to! What's the occasion? 🤔 Tell me where you're going (date, work, trip), the vibe you want (minimal, casual…) and your budget, and I'll tailor it. Or see a look on your own body right away at /style!",
};

// ---- FAQ 키워드 매칭: 아주 짧은 질문은 키워드가 질문 대부분을 차지할 때만 인정 ----
export const SHORT_QUERY_MAX = 4;
export const SHORT_QUERY_MIN_COVERAGE = 0.6;
export function shortQueryCoverageOk(queryLen: number, matchedLen: number): boolean {
  if (queryLen > SHORT_QUERY_MAX) return true;
  return queryLen > 0 && matchedLen / queryLen >= SHORT_QUERY_MIN_COVERAGE;
}

// ---- 답변 캐시: 짧은 질문은 거의 같은 문장일 때만 재사용 ----
export function cacheThreshold(normQuestionLen: number): number {
  return normQuestionLen < 8 ? 0.9 : 0.6;
}

// ---- 로그인 사용자 맥락 (프로필 + 최근 추천) ----
export interface ChatProfile {
  gender?: string | null;
  body_type?: string | null;
  style_preferences?: string[] | null;
}
export interface ChatRecommendation {
  prompt?: string | null;
  style_concept?: string | null;
}

const clean = (s: string | null | undefined, max: number) =>
  (s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * 대화 뒤에 붙는 별도 system 메시지 본문. 시스템 프롬프트에는 넣지 않는다(프롬프트 캐시 유지).
 * 키·몸무게·나이 같은 수치는 넣지 않고 성별·체형·선호 스타일과 최근 추천 최대 3개만 쓴다.
 * 맥락이 하나도 없으면 빈 문자열.
 */
export function buildUserContext(
  profile: ChatProfile | null | undefined,
  recs: ChatRecommendation[] | null | undefined,
): string {
  const parts: string[] = [];
  if (profile) {
    const bits = [
      profile.gender ? `성별 ${clean(profile.gender, 20)}` : "",
      profile.body_type ? `체형 ${clean(profile.body_type, 30)}` : "",
      profile.style_preferences?.length ? `선호 스타일 ${profile.style_preferences.slice(0, 5).map((s) => clean(s, 20)).join(", ")}` : "",
    ].filter(Boolean);
    if (bits.length) parts.push(`프로필: ${bits.join(" / ")}`);
  }
  const recLines = (recs ?? [])
    .map((r) => ({ prompt: clean(r.prompt, 60), concept: clean(r.style_concept, 40) }))
    .filter((r) => r.prompt || r.concept) // 빈 행은 먼저 거르고
    .slice(0, 3) // 쓸 만한 최근 3개만
    .map((r, i) => `${i + 1}) ${r.prompt ? `요청 "${r.prompt}"` : ""}${r.prompt && r.concept ? " → " : ""}${r.concept ? `컨셉 "${r.concept}"` : ""}`);
  if (recLines.length) parts.push(`최근 추천:\n${recLines.join("\n")}`);
  if (parts.length === 0) return "";
  return `[이 사용자에 대한 참고 정보 — 로그인한 사용자 본인의 데이터]\n${parts.join("\n")}\n질문과 관련 있을 때만 자연스럽게 활용해. 프로필을 그대로 읊거나 몸에 대한 평가를 하지 말고, 정보에 없는 건 지어내지 마.`;
}
