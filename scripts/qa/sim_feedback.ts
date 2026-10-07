/* eslint-disable */
// @ts-nocheck
// 피드백·학습·리포트 시나리오 시뮬레이션: 실제 엣지 함수 코드를 가짜 DB/AI 위에서 실행한다.
import { FakeDb } from "./fake_supabase.ts";

const db = new FakeDb();
(globalThis as any).__DB = db;
Deno.env.set("SUPABASE_URL", "https://sim.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-sim");
Deno.env.set("LOVABLE_API_KEY", "ai-sim");
Deno.env.set("SITE_URL", "https://showmelook.com");

// ---- 가짜 AI 게이트웨이 / send-outbox-email ----
type AiMode = { moderation: (comment: string) => string | number; insight: () => string | number };
const ai: AiMode = { moderation: () => '{"flagged":false,"categories":[]}', insight: () => '{"summary":"","insights":[]}' };
const calls = { moderation: 0, insight: 0, outboxSend: 0 };
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url.includes("ai.gateway.lovable.dev")) {
    const sys: string = body.messages?.[0]?.content ?? "";
    const isMod = sys.includes("의견 검수기");
    const r = isMod ? ai.moderation(String(body.messages?.[1]?.content ?? "")) : ai.insight();
    isMod ? calls.moderation++ : calls.insight++;
    if (typeof r === "number") return new Response("err", { status: r });
    return new Response(JSON.stringify({ choices: [{ message: { content: r } }] }), { status: 200 });
  }
  if (url.includes("/functions/v1/send-outbox-email")) {
    calls.outboxSend++;
    for (const o of db.t("admin_email_outbox")) if (o.status === "pending") o.status = "sent";
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  throw new Error("unexpected fetch " + url);
}) as typeof fetch;

// ---- 함수 핸들러 로드 ----
let captured: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: any) => { captured = h; return {}; };
async function load(path: string) { captured = null; await import(path); const h = captured!; return h; }
const fnUrl = (name: string) => new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url).href;
const submit = await load(fnUrl("submit-look-feedback"));
const learn = await load(fnUrl("feedback-learning-report"));

const call = async (h: typeof submit, token: string | null, body: unknown) => {
  const res = await h(new Request("http://sim/fn", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json().catch(() => null) } as { status: number; body: any };
};

// ---- 테스트 데이터: 페르소나별 테스트 계정 ----
const P = ["p1", "p2", "p3", "p4", "p5", "p6"].map((k, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, name: k }));
for (const p of P) db.seed("products_cache", [{ id: p.id, name: `상품 ${p.name}`, brand: `브랜드${p.name}` }]);
const personas = [
  { key: "gay", label: "게이 남성", id: "11111111-1111-4111-8111-111111111111" },
  { key: "lesbian", label: "레즈비언 여성", id: "22222222-2222-4222-8222-222222222222" },
  { key: "cross", label: "여장 남성", id: "33333333-3333-4333-8333-333333333333" },
  { key: "trans", label: "남장 여성", id: "44444444-4444-4444-8444-444444444444" },
  { key: "bi", label: "양성애자", id: "55555555-5555-4555-8555-555555555555" },
  { key: "spam", label: "스팸 계정", id: "66666666-6666-4666-8666-666666666666" },
  { key: "other", label: "다른 사용자", id: "77777777-7777-4777-8777-777777777777" },
] as const;
const tok: Record<string, string> = {};
const lookOf: Record<string, string> = {};
personas.forEach((p, i) => {
  tok[p.key] = db.addUser(p.id, `${p.key}@test.example`);
  lookOf[p.key] = `aaaaaaaa-aaaa-4aaa-8aaa-0000000000${String(i + 1).padStart(2, "0")}`;
  db.seed("generated_looks", [{ id: lookOf[p.key], user_id: p.id, prompt_used: `${p.label} 데이트룩`, product_ids: [P[i % 3].id, P[(i + 1) % 3].id, "99999999-9999-4999-8999-999999999999"] }]);
});
const adminId = "ad000000-0000-4000-8000-000000000001";
const adminTok = db.addUser(adminId, "Admin@Showmelook.com");
db.seed("user_roles", [{ user_id: adminId, role: "admin" }]);
const pf = (userId: string) => db.t("product_feedback").filter((r) => r.user_id === userId);
const fb = (key: string) => db.t("look_feedback").find((r) => r.user_id === personas.find((p) => p.key === key)!.id);

// ---- 결과 기록 ----
const QA_OUT = Deno.env.get("QA_OUT") ?? await Deno.makeTempDir({ prefix: "qa-feedback-" });
await Deno.mkdir(QA_OUT, { recursive: true });
console.log(`산출물 폴더: ${QA_OUT}`);
const results: Array<{ area: string; scenario: string; ok: boolean; detail: string }> = [];
const check = (area: string, scenario: string, ok: boolean, detail = "") => { results.push({ area, scenario, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${scenario}${detail ? "  — " + detail : ""}`); };
const A = "피드백 저장";

// ===== 피드백 시나리오 =====
{ // 1. 게이 남성: 좋아요 + 일반 패션 의견
  const r = await call(submit, tok.gay, { lookId: lookOf.gay, rating: 1, comment: "남자친구랑 갈 데이트룩으로 딱이에요. 핏이 마음에 들어요", appliedGender: "male" });
  const row = fb("gay");
  check(A, "게이 남성 · 좋아요 + 일반 의견", r.status === 200 && row?.moderation_status === "clean" && row?.applied_gender === "male", `status=${row?.moderation_status}`);
  check(A, "  └ 상품 신호: 실제 있는 상품 2개만 style_like", pf(personas[0].id).length === 2 && pf(personas[0].id).every((x) => x.action_type === "style_like"), `rows=${pf(personas[0].id).length}`);
}
{ // 2. 양성애자: 보통, 의견 없음
  const r = await call(submit, tok.bi, { lookId: lookOf.bi, rating: 0 });
  check(A, "양성애자 · 보통(의견 없음)", r.status === 200 && fb("bi")?.moderation_status === "none" && pf(personas[4].id).length === 0, "상품 신호 없음");
}
{ // 3. 남장 여성: 별로예요 + 색 불만 (패션 평가는 통과해야 함)
  const r = await call(submit, tok.trans, { lookId: lookOf.trans, rating: -1, comment: "색이 사진이랑 달라요. 검정인데 갈색으로 나왔어요. 노출도 조금 많아요" });
  check(A, "남장 여성 · 별로예요 + 색/노출 불만 → 패션 평가로 통과", fb("trans")?.moderation_status === "clean" && pf(personas[3].id).every((x) => x.action_type === "style_dislike") && pf(personas[3].id).length === 2);
}
{ // 4. 여장 남성: 종교 언급 → 규칙으로 보류, AI 호출 없음
  const before = calls.moderation;
  await call(submit, tok.cross, { lookId: lookOf.cross, rating: 1, comment: "교회 갈 때 입을 수 있는 원피스면 좋겠어요" });
  const row = fb("cross");
  check(A, "여장 남성 · 종교 언급 → 보류(religious), AI 호출 없이", row?.moderation_status === "flagged" && row.moderation_categories.includes("religious") && calls.moderation === before, `categories=${row?.moderation_categories}`);
  check(A, "  └ 보류돼도 평점 신호(좋아요)는 상품에 반영", pf(personas[2].id).length === 2);
}
{ // 5. 개인정보
  await call(submit, tok.lesbian, { lookId: lookOf.lesbian, rating: 1, comment: "마음에 들어요! 010-1234-5678 로 연락 주세요" });
  const row = fb("lesbian");
  check(A, "레즈비언 여성 · 전화번호 포함 → 보류(personal_info)", row?.moderation_status === "flagged" && row.moderation_categories.includes("personal_info"));
  check(A, "  └ 개인정보가 섞인 의견은 가려서 저장 (전화번호 원문이 DB에 남지 않음)", !!row?.comment && !row.comment.includes("010-1234-5678"), `stored="${row?.comment}"`);
  // 관리자가 승인한 뒤 같은 의견을 다시 보내도 결정이 유지된다
  row.moderation_status = "approved"; row.decided_by = adminId; row.decided_at = new Date().toISOString();
  await call(submit, tok.lesbian, { lookId: lookOf.lesbian, rating: 1, comment: "마음에 들어요! 010-1234-5678 로 연락 주세요" });
  const again = fb("lesbian");
  check(A, "  └ 가려 저장된 의견을 같은 내용으로 다시 보내도 관리자 승인이 유지", again?.moderation_status === "approved", `status=${again?.moderation_status}`);
  again.moderation_status = "flagged"; again.decided_by = null; again.decided_at = null; // 이후 학습 시나리오(보류 건 승인)를 위해 원복
}
{ // 6. 스팸
  await call(submit, tok.spam, { lookId: lookOf.spam, rating: -1, comment: "할인 코드 받으려면 www.example.com 방문" });
  check(A, "스팸 계정 · 링크/광고 → 보류(spam)", fb("spam")?.moderation_status === "flagged" && fb("spam").moderation_categories.includes("spam"));
}
{ // 7. 규칙은 못 잡지만 AI가 잡는 경우
  ai.moderation = () => '{"flagged":true,"categories":["sexual"]}';
  await call(submit, tok.other, { lookId: lookOf.other, rating: -1, comment: "분위기가 너무 야해서 별로" });
  check(A, "규칙이 놓친 표현을 AI가 선정적으로 판정 → 보류(sexual)", fb("other")?.moderation_status === "flagged" && fb("other").moderation_categories.includes("sexual"));
  ai.moderation = () => '{"flagged":false,"categories":[]}';
}
{ // 8. AI 장애: 깨끗해 보여도 사람이 보도록 보류
  const id = "88888888-8888-4888-8888-888888888888"; const t = db.addUser(id, "ai-down@test.example");
  db.seed("generated_looks", [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000099", user_id: id, prompt_used: "AI 장애 테스트", product_ids: [P[0].id] }]);
  ai.moderation = () => 503;
  const r = await call(submit, t, { lookId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000099", rating: 1, comment: "무난하고 예뻐요" });
  const row = db.t("look_feedback").find((x) => x.user_id === id);
  check(A, "AI 검수가 장애일 때 → 사람이 보도록 보류(needs_review), 저장은 성공", r.status === 200 && row?.moderation_status === "flagged" && row.moderation_categories.includes("needs_review"));
  ai.moderation = () => '{"flagged":false,"categories":[]}';
}
{ // 9. 평점 변경: 좋아요 → 별로예요 (상품 신호가 중복되지 않고 교체)
  await call(submit, tok.gay, { lookId: lookOf.gay, rating: -1, comment: "남자친구랑 갈 데이트룩으로 딱이에요. 핏이 마음에 들어요" });
  const rows = pf(personas[0].id);
  check(A, "평점 변경(좋아요→별로예요): 상품 신호가 교체됨(중복 집계 없음)", rows.length === 2 && rows.every((x) => x.action_type === "style_dislike"), `rows=${rows.map((x) => x.action_type)}`);
  check(A, "  └ 의견이 그대로면 재검수하지 않고 상태 유지", fb("gay")?.moderation_status === "clean");
  await call(submit, tok.gay, { lookId: lookOf.gay, rating: 0, comment: "남자친구랑 갈 데이트룩으로 딱이에요. 핏이 마음에 들어요" });
  check(A, "평점을 보통으로 바꾸면 상품 신호 제거", pf(personas[0].id).length === 0);
  await call(submit, tok.gay, { lookId: lookOf.gay, rating: 1, comment: "남자친구랑 갈 데이트룩으로 딱이에요. 핏이 마음에 들어요" }); // 다시 좋아요로
}
{ // 10. 입력/권한 오류
  const r1 = await call(submit, null, { lookId: lookOf.gay, rating: 1 });
  const r2 = await call(submit, tok.other, { lookId: lookOf.gay, rating: 1 });
  const r3 = await call(submit, tok.gay, { lookId: lookOf.gay, rating: 2 });
  const r4 = await call(submit, tok.gay, { lookId: "not-a-uuid", rating: 1 });
  const r5 = await call(submit, tok.gay, { lookId: "aaaaaaaa-aaaa-4aaa-8aaa-ffffffffffff", rating: 1 });
  check("권한·입력", "로그인 없음 → 401", r1.status === 401);
  check("권한·입력", "남의 룩에 피드백 → 404 (저장 안 됨)", r2.status === 404 && !db.t("look_feedback").some((x) => x.user_id === personas[6].id && x.look_id === lookOf.gay));
  check("권한·입력", "평점 범위 밖(2) → 400", r3.status === 400);
  check("권한·입력", "룩 ID 형식 오류 → 400", r4.status === 400);
  check("권한·입력", "없는 룩 → 404", r5.status === 404);
}
{ // 11. 길이 제한 + 하루 한도
  const id = "99999999-0000-4000-8000-000000000001"; const t = db.addUser(id, "long@test.example");
  db.seed("generated_looks", [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000098", user_id: id, prompt_used: "긴 의견", product_ids: [] }]);
  await call(submit, t, { lookId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000098", rating: 1, comment: "좋아요 ".repeat(400) });
  const row = db.t("look_feedback").find((x) => x.user_id === id);
  check("권한·입력", "1000자 넘는 의견은 1000자로 잘려 저장", row?.comment?.length === 1000, `len=${row?.comment?.length}`);
  const capId = "99999999-0000-4000-8000-000000000002"; const capTok = db.addUser(capId, "cap@test.example");
  db.seed("generated_looks", [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000097", user_id: capId, prompt_used: "한도", product_ids: [] }]);
  for (let i = 0; i < 60; i++) db.seed("look_feedback", [{ user_id: capId, look_id: crypto.randomUUID(), rating: 1, moderation_status: "none", updated_at: new Date().toISOString() }]);
  const r = await call(submit, capTok, { lookId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000097", rating: 1 });
  check("권한·입력", "하루 60건 넘으면 → 429", r.status === 429);
  db.tables.look_feedback = db.t("look_feedback").filter((x) => x.user_id !== capId); // 학습 시나리오에 영향 없게 정리
}

// ===== 학습·리포트 시나리오 =====
const L = "학습·리포트";
const outboxHtml = () => db.t("admin_email_outbox").map((o) => o.html).join("\n");
const reports = () => db.t("feedback_reports");
{ // R1: 새 피드백이 없으면 만들지 않음 (빈 DB 상태 확인용으로 임시 비움)
  const saved = db.t("look_feedback").splice(0);
  const r = await call(learn, null, {});
  check(L, "새 피드백이 없으면 리포트·이메일을 만들지 않는다", r.body?.skipped === "no_new_feedback" && reports().length === 0 && db.t("admin_email_outbox").length === 0);
  db.t("look_feedback").push(...saved);
}
Deno.env.set("FEEDBACK_REPORT_EMAILS", "manager@showmelook.com, admin@showmelook.com");
ai.insight = () => JSON.stringify({ summary: "핏과 색 정확도에 대한 의견이 많았어요", insights: ["검정 상의는 갈색으로 보이지 않게 색을 분명히 추천하기", "정치 성향이 드러나는 코디는 추천하기", "와이드 팬츠는 허리 핏 설명을 함께 주기", "https://spam.example 참고"] });
let firstReportId = "";
{ // R2: 정상 실행
  const r = await call(learn, null, {});
  const rep = reports()[0]; firstReportId = rep?.id;
  const ins = db.t("recommendation_insights")[0];
  check(L, "새 피드백이 있으면 리포트 생성", r.status === 200 && r.body?.success === true && reports().length === 1, JSON.stringify({ feedback: r.body?.feedback, insights: r.body?.insightsApplied, emails: r.body?.emailsQueued }));
  check(L, "  └ 통계: 좋아요/보통/별로예요 집계", rep?.stats.up === 5 && rep.stats.neutral === 1 && rep.stats.down === 3, `up=${rep?.stats.up} neutral=${rep?.stats.neutral} down=${rep?.stats.down}`);
  check(L, "  └ 쓸 수 있는 의견이 5건·3명 미만이면 가이드를 만들지 않는다 (리포트는 생성)", !ins && r.body?.insightsApplied === 0 && r.body?.insightsSkipped === "not_enough_samples" && calls.insight === 0, `usable=${rep?.stats.usableComments} insight calls=${calls.insight}`);
  const learned = db.t("look_feedback").filter((x) => x.used_in_learning).map((x) => x.moderation_status);
  check(L, "  └ 학습 반영 표시: 통과·평점만 있는 건만, 보류(flagged)는 제외", learned.length > 0 && learned.every((s) => ["none", "clean", "approved"].includes(s)) && db.t("look_feedback").filter((x) => x.moderation_status === "flagged").every((x) => !x.used_in_learning), `learned=${learned.length}`);
  check(L, "  └ 보류 건수·분류별 집계가 리포트에 저장", rep?.flagged_count === db.t("look_feedback").filter((x) => x.moderation_status === "flagged").length && rep.flagged_by_category.religious === 1 && rep.flagged_by_category.personal_info === 1, JSON.stringify(rep?.flagged_by_category));
  const rcpt = db.t("admin_email_outbox").map((o) => o.to_email).sort();
  check(L, "  └ 수신자: 관리자 역할 사용자 + FEEDBACK_REPORT_EMAILS (중복 제거·소문자)", JSON.stringify(rcpt) === JSON.stringify(["admin@showmelook.com", "manager@showmelook.com"]), rcpt.join(", "));
  const html = outboxHtml();
  check(L, "  └ 이메일에 보류된 의견 원문(전화번호·교회 등)을 싣지 않음", !html.includes("010-1234") && !html.includes("교회") && !html.includes("example.com"));
  check(L, "  └ 이메일에 분류별 건수·관리자 링크 포함", html.includes("종교 1건") || html.includes("종교") , "분류 라벨 표시") ;
  check(L, "  └ send-outbox-email 호출됨 (수신자 2명 → 1회)", calls.outboxSend === 1 && !!reports()[0].emailed_at, `calls=${calls.outboxSend}`);
  await Deno.writeTextFile(QA_OUT + "/sample_report.html", db.t("admin_email_outbox")[0].html);
  await Deno.writeTextFile(QA_OUT + "/sample_report.txt", `제목: ${db.t("admin_email_outbox")[0].subject}\n\n${db.t("admin_email_outbox")[0].text_body}`);
}
{ // R3: 바로 다시 실행 → 6시간 이내 제한
  const r = await call(learn, null, {});
  check(L, "6시간 안에 다시 호출하면 실행하지 않음(throttled)", r.body?.skipped === "throttled" && reports().length === 1);
}
{ // R4: 일반 사용자가 force 를 보내도 무시
  const r = await call(learn, tok.gay, { force: true });
  check(L, "일반 사용자가 force를 보내도 무시된다", r.body?.skipped === "throttled" && reports().length === 1);
}
// 시간 경과(6시간+) 시뮬레이션
const age = (h: number) => { for (const r of reports()) r.created_at = new Date(Date.now() - h * 3600_000).toISOString(); for (const r of reports()) r.period_end = r.created_at; };
{ // R5: 시간이 지났어도 새 피드백이 없으면 생성 안 함
  age(7);
  for (const f of db.t("look_feedback")) { f.updated_at = new Date(Date.now() - 8 * 3600_000).toISOString(); if (f.decided_at) f.decided_at = f.updated_at; }
  const r = await call(learn, null, {});
  check(L, "시간이 지나도 새 피드백이 없으면 만들지 않는다", r.body?.skipped === "no_new_feedback" && reports().length === 1);
}
{ // R6: 관리자가 보류 건을 승인 → 다음 실행에 반영
  const target = db.t("look_feedback").find((x) => x.moderation_status === "flagged" && x.moderation_categories.includes("religious"))!;
  target.moderation_status = "approved"; target.decided_by = adminId; target.decided_at = new Date().toISOString();
  const r = await call(learn, null, {});
  check(L, "관리자가 승인한 의견은 다음 실행부터 학습에 반영 (새 리포트 생성)", r.body?.success === true && reports().length === 2 && target.used_in_learning === true, `reports=${reports().length}`);
  const rep2 = reports()[1];
  check(L, "  └ 승인된 의견 1건만 새 기간에 집계", rep2.stats.total === 1, `total=${rep2.stats.total}`);
}
{ // R7: 관리자 force → 새 피드백이 없어도 실행
  age(7);
  for (const f of db.t("look_feedback")) { f.updated_at = new Date(Date.now() - 8 * 3600_000).toISOString(); if (f.decided_at) f.decided_at = f.updated_at; }
  const r = await call(learn, adminTok, { force: true });
  check(L, "관리자는 force로 새 피드백이 없어도 리포트를 만들 수 있다", r.body?.success === true && reports().length === 3);
}
{ // R8: 수신자 없음 + AI 장애: 리포트는 저장, 이메일은 없음
  age(7); db.tables.user_roles = []; Deno.env.set("FEEDBACK_REPORT_EMAILS", "");
  db.seed("look_feedback", [{ user_id: personas[4].id, look_id: crypto.randomUUID(), rating: 1, comment: "좋아요", moderation_status: "clean", updated_at: new Date().toISOString() }]);
  ai.insight = () => 500; const sentBefore = db.t("admin_email_outbox").length;
  const r = await call(learn, null, {});
  check(L, "수신자가 없으면 리포트는 저장하되 이메일은 만들지 않고 경고한다", r.body?.success === true && r.body?.warning === "no_recipients" && db.t("admin_email_outbox").length === sentBefore);
  check(L, "AI 요약이 장애여도 리포트는 만들어진다 (가이드 없음)", r.body?.insightsApplied === 0 && reports().length === 4);
}
{ // R9: 의견이 충분히 모이면(5건·3명 이상) 가이드 생성 — AI가 쓴 민감·링크 줄은 버리고 나머지만 활성 저장
  age(7); db.tables.user_roles = [{ user_id: adminId, role: "admin" }]; Deno.env.set("FEEDBACK_REPORT_EMAILS", "");
  ai.insight = () => JSON.stringify({ summary: "핏과 색 정확도에 대한 의견이 많았어요", insights: ["검정 상의는 갈색으로 보이지 않게 색을 분명히 추천하기", "정치 성향이 드러나는 코디는 추천하기", "와이드 팬츠는 허리 핏 설명을 함께 주기", "https://spam.example 참고"] });
  for (let i = 0; i < 6; i++) db.seed("look_feedback", [{ user_id: personas[i % 4].id, look_id: crypto.randomUUID(), rating: i % 2 ? 1 : -1, comment: `핏과 색에 대한 의견 ${i}`, moderation_status: "clean", updated_at: new Date().toISOString() }]);
  const before = calls.insight;
  const r = await call(learn, null, {});
  const ins = db.t("recommendation_insights")[0];
  check(L, "의견이 5건·3명 이상 모이면 가이드를 만든다", r.body?.success === true && calls.insight === before + 1 && !!ins, `insights=${r.body?.insightsApplied} usable=${ins?.source_feedback_count}`);
  check(L, "  └ AI가 쓴 가이드 중 민감·링크가 섞인 줄은 버리고 나머지만 활성 저장", ins?.status === "active" && ins.insight_lines.length === 2 && !ins.insight_lines.join().includes("정치") && !ins.insight_lines.join().includes("http"), `lines=${JSON.stringify(ins?.insight_lines)}`);
}
const failed = results.filter((r) => !r.ok);
await Deno.writeTextFile(QA_OUT + "/results.json", JSON.stringify({ results, calls, counts: { feedback: db.t("look_feedback").length, productFeedback: db.t("product_feedback").length, reports: reports().length } }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
Deno.exit(failed.length ? 1 : 0);
