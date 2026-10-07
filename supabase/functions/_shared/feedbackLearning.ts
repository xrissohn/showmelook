// Feedback learning: moderation of free-text look feedback, aggregation, insight sanitizing and the
// admin report email. Shared by submit-look-feedback / feedback-learning-report / style-recommend
// (Deno) and unit tests (Vitest). No runtime imports.
//
// Sensitive comments (sexual, religious, political, hateful, violent, illegal, personal info, abusive,
// spam) are NOT used for learning. They are held and summarized for the admins, who decide.
// Fashion critique that merely sounds close ("노출이 많아요", "누드톤") must not be flagged.

export type ModerationCategory =
  | 'sexual'
  | 'religious'
  | 'political'
  | 'hate'
  | 'violence_self_harm'
  | 'illegal'
  | 'personal_info'
  | 'profanity'
  | 'spam'
  | 'needs_review'; // AI review was unavailable, so a person should look

export const MODERATION_LABELS_KO: Record<ModerationCategory, string> = {
  sexual: '선정적',
  religious: '종교',
  political: '정치',
  hate: '혐오·차별',
  violence_self_harm: '폭력·자해',
  illegal: '불법',
  personal_info: '개인정보',
  profanity: '욕설',
  spam: '스팸·광고',
  needs_review: '검토 필요',
};

const RULES: Array<{ category: ModerationCategory; re: RegExp }> = [
  { category: 'sexual', re: /섹스|성관계|성행위|야동|포르노|음란|자위|성기|젖꼭지|강간|\bsex\b|\bporn|nsfw|\bnaked\b|\bhorny\b/i },
  { category: 'religious', re: /종교|기독교|천주교|개신교|불교|이슬람|무슬림|하나님|예수|부처님?|알라신|교회|성당|사찰|신앙|히잡|religio|christian|muslim|islam|buddhis|\bchurch\b|\bjesus\b|\bgod\b/i },
  { category: 'political', re: /대통령|정당|국회의원|선거|여당|야당|정치|좌파|우파|민주당|국민의힘|탄핵|독재|politic|election|president|democrat|republican|\btrump\b|\bbiden\b/i },
  { category: 'hate', re: /병신|장애인\s*(새끼|같)|틀딱|한남|김치녀|된장녀|메갈|일베|짱깨|쪽발이|똥꼬충|호모\s*새끼|게이\s*새끼|레즈\s*새끼|트랜스\s*새끼|혐오|인종차별|\bnigg|faggot|\bretard|tranny|\bchink\b/i },
  { category: 'violence_self_harm', re: /죽여|죽이고|죽어버|죽고\s*싶|자살|자해|살인|테러|폭행|목을\s*매|\bkill\s+(you|them|him|her)|suicide|self-?harm|murder/i },
  { category: 'illegal', re: /마약|대마초|필로폰|도박|몰카|해킹|위조|불법\s*촬영|\bdrugs?\b|\bhack(ing)?\b|counterfeit/i },
  { category: 'personal_info', re: /01[016789][- .]?\d{3,4}[- .]?\d{4}|\d{6}\s*-\s*[1-4]\d{6}|[\w.+-]+@[\w-]+\.[\w.-]+|\b(?:\d{4}[- ]?){3}\d{4}\b|계좌\s*번호|카드\s*번호|주소는|사는\s*곳은/i },
  { category: 'profanity', re: /씨발|시발|씹|좆|존나|지랄|개새끼|염병|엿\s*먹|\bfuck|\bshit\b|\bbitch\b|\basshole\b/i },
  { category: 'spam', re: /https?:\/\/|www\.|\.com\b|카톡\s*(?:아이디|문의)|텔레그램|오픈\s*채팅|(.)\1{9,}|할인\s*코드|무료\s*체험|부업|재택\s*알바/i },
];

/** 규칙으로 걸러낸 분류. 하나도 없으면 빈 배열. */
export function classifyCommentLocal(text: string | null | undefined): ModerationCategory[] {
  if (!text) return [];
  const t = String(text).normalize('NFKC');
  const found: ModerationCategory[] = [];
  for (const { category, re } of RULES) if (re.test(t) && !found.includes(category)) found.push(category);
  return found;
}

/** AI·학습에 보내기 전에 연락처·주소·URL 같은 개인정보를 가린다. */
export function redactPersonalInfo(text: string): string {
  return String(text)
    .replace(/01[016789][- .]?\d{3,4}[- .]?\d{4}/g, '[전화번호]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[이메일]')
    .replace(/\d{6}\s*-\s*[1-4]\d{6}/g, '[주민번호]')
    .replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[카드번호]')
    .replace(/https?:\/\/\S+|www\.\S+/g, '[링크]');
}

export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategory[];
}

const VALID = new Set<string>(Object.keys(MODERATION_LABELS_KO));

/** AI 분류 응답({"flagged":bool,"categories":[...]})을 안전하게 읽는다. 읽지 못하면 null. */
export function parseAiModeration(raw: string | null | undefined): ModerationResult | null {
  if (!raw) return null;
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { flagged?: unknown; categories?: unknown };
    const cats = Array.isArray(o.categories) ? o.categories.filter((c): c is ModerationCategory => typeof c === 'string' && VALID.has(c) && c !== 'needs_review') : [];
    const flagged = o.flagged === true || cats.length > 0;
    return { flagged, categories: flagged ? Array.from(new Set(cats)) : [] };
  } catch {
    return null;
  }
}

/**
 * 규칙 + AI 결과를 합친 최종 판정. AI를 쓰지 못했고(null) 규칙에도 안 걸렸으면
 * 사람이 보도록 needs_review 로 보류한다(학습에는 쓰지 않는다).
 */
export function mergeModeration(local: ModerationCategory[], ai: ModerationResult | null): ModerationResult {
  const categories = Array.from(new Set([...local, ...(ai?.categories ?? [])]));
  if (categories.length > 0) return { flagged: true, categories };
  if (ai === null) return { flagged: true, categories: ['needs_review'] };
  return { flagged: ai.flagged, categories: [] };
}

// ===== 집계 · 인사이트 정리 · 관리자 리포트 =====
// Aggregation, insight sanitizing and the admin report email for the feedback learning loop.
// Shared by feedback-learning-report (Deno) and unit tests (Vitest). No runtime imports.

export interface FeedbackRow {
  rating: number;
  comment?: string | null;
  style_concept?: string | null;
  moderation_status: string;
  moderation_categories?: string[] | null;
}

export interface FeedbackStats {
  total: number;
  up: number;
  neutral: number;
  down: number;
  positiveRate: number; // 0~1, 방향이 있는 피드백(좋아요+별로예요) 중 좋아요 비율
  withComment: number;
  usableComments: number; // clean 또는 관리자가 승인한 것
  flaggedComments: number; // 보류 중(관리자 결정 대기)
  rejectedComments: number;
  flaggedByCategory: Record<string, number>;
  topLiked: Array<{ concept: string; up: number; down: number }>;
  topDisliked: Array<{ concept: string; up: number; down: number }>;
}

export const isUsableComment = (r: FeedbackRow): boolean =>
  !!r.comment && r.comment.trim().length > 0 && (r.moderation_status === 'clean' || r.moderation_status === 'approved');

export function aggregateFeedback(rows: FeedbackRow[]): FeedbackStats {
  let up = 0, neutral = 0, down = 0, withComment = 0, usable = 0, flagged = 0, rejected = 0;
  const byCategory: Record<string, number> = {};
  const concepts = new Map<string, { up: number; down: number }>();
  for (const r of rows) {
    if (r.rating > 0) up++; else if (r.rating < 0) down++; else neutral++;
    if (r.comment && r.comment.trim()) withComment++;
    if (isUsableComment(r)) usable++;
    if (r.moderation_status === 'flagged') {
      flagged++;
      for (const c of r.moderation_categories ?? []) byCategory[c] = (byCategory[c] ?? 0) + 1;
    }
    if (r.moderation_status === 'rejected') rejected++;
    const concept = (r.style_concept ?? '').trim();
    if (concept && r.rating !== 0) {
      const e = concepts.get(concept) ?? { up: 0, down: 0 };
      if (r.rating > 0) e.up++; else e.down++;
      concepts.set(concept, e);
    }
  }
  const list = [...concepts.entries()].map(([concept, v]) => ({ concept, ...v }));
  const topLiked = list.filter((c) => c.up > c.down).sort((a, b) => b.up - b.down - (a.up - a.down)).slice(0, 3);
  const topDisliked = list.filter((c) => c.down > c.up).sort((a, b) => b.down - b.up - (a.down - a.up)).slice(0, 3);
  const directional = up + down;
  return {
    total: rows.length, up, neutral, down,
    positiveRate: directional ? up / directional : 0,
    withComment, usableComments: usable, flaggedComments: flagged, rejectedComments: rejected,
    flaggedByCategory: byCategory, topLiked, topDisliked,
  };
}

// ---- AI가 쓴 인사이트 정리 ----
const MAX_INSIGHT_LINES = 5;
const MAX_LINE = 140;
const MAX_SUMMARY = 400;

/** 추천 가이드로 쓸 한 줄만 남긴다: 민감·개인정보·링크가 섞인 줄은 버린다. */
export function sanitizeInsightLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const out: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    const line = raw.replace(/^[\s\-*•\d.)]+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE);
    if (line.length < 6) continue;
    if (classifyCommentLocal(line).length > 0) continue;
    if (out.includes(line)) continue;
    out.push(line);
    if (out.length >= MAX_INSIGHT_LINES) break;
  }
  return out;
}

export function sanitizeSummary(text: unknown): string {
  if (typeof text !== 'string') return '';
  const t = text.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY);
  return classifyCommentLocal(t).length > 0 ? '' : t;
}

/** AI 응답({"summary": "...", "insights": ["..."]})을 읽는다. 읽지 못하면 null. */
export function parseInsightResponse(raw: string | null | undefined): { summary: string; insights: string[] } | null {
  if (!raw) return null;
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { summary?: unknown; insights?: unknown };
    return { summary: sanitizeSummary(o.summary), insights: sanitizeInsightLines(o.insights) };
  } catch {
    return null;
  }
}

/** style-recommend 프롬프트에 붙이는 블록. 활성 인사이트가 없으면 빈 문자열. */
export function buildInsightPromptBlock(activeLines: string[][]): string {
  const lines: string[] = [];
  for (const group of activeLines) for (const l of sanitizeInsightLines(group)) if (!lines.includes(l)) lines.push(l);
  const top = lines.slice(0, 8);
  if (top.length === 0) return '';
  return `\n## 사용자 피드백에서 학습한 추천 가이드 (참고용 — 사용자의 이번 요청이 항상 우선)\n${top.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---- 관리자 리포트 이메일 ----
export interface ReportInput {
  periodStart: string;
  periodEnd: string;
  stats: FeedbackStats;
  summary: string;
  insightLines: string[];
  pendingFlaggedTotal: number; // 지금까지 결정 대기 중인 전체 건수
  adminUrl: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
const pct = (n: number) => `${Math.round(n * 100)}%`;
const catLabel = (c: string) => MODERATION_LABELS_KO[c as ModerationCategory] ?? c;

export function buildReportEmail(r: ReportInput): { subject: string; html: string; text: string } {
  const s = r.stats;
  const flagged = Object.entries(s.flaggedByCategory).map(([c, n]) => `${catLabel(c)} ${n}건`).join(', ');
  const subject = `[쇼미룩] 피드백 학습 리포트 · 👍${s.up} 😐${s.neutral} 👎${s.down}` + (r.pendingFlaggedTotal > 0 ? ` · 결정 필요 ${r.pendingFlaggedTotal}건` : '');
  const concepts = (list: FeedbackStats['topLiked']) => (list.length ? list.map((c) => `${c.concept} (👍${c.up}/👎${c.down})`).join(', ') : '없음');

  const textLines = [
    `피드백 학습 리포트 (${kst(r.periodStart)} ~ ${kst(r.periodEnd)} KST)`,
    `- 피드백 ${s.total}건: 좋아요 ${s.up} · 보통 ${s.neutral} · 별로예요 ${s.down} (좋아요 비율 ${pct(s.positiveRate)})`,
    `- 의견 ${s.withComment}건: 학습에 사용 ${s.usableComments}건 · 보류 ${s.flaggedComments}건 · 제외 ${s.rejectedComments}건`,
    `- 반응이 좋았던 스타일: ${concepts(s.topLiked)}`,
    `- 아쉬움이 컸던 스타일: ${concepts(s.topDisliked)}`,
    r.summary ? `- 요약: ${r.summary}` : '',
    r.insightLines.length ? `이번에 추천에 반영한 가이드:\n${r.insightLines.map((l) => `  · ${l}`).join('\n')}` : '이번에는 새로 반영한 가이드가 없습니다.',
    r.pendingFlaggedTotal > 0 ? `결정이 필요한 의견 ${r.pendingFlaggedTotal}건 (이번 기간 ${s.flaggedComments}건${flagged ? ': ' + flagged : ''}) — 관리자 화면에서 승인/제외해 주세요: ${r.adminUrl}` : '결정이 필요한 의견은 없습니다.',
    `관리자 화면: ${r.adminUrl}`,
  ].filter(Boolean);

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;color:#1e1b4b">
<h2 style="margin:0 0 4px">피드백 학습 리포트</h2>
<p style="margin:0 0 16px;color:#6b7280;font-size:13px">${esc(kst(r.periodStart))} ~ ${esc(kst(r.periodEnd))} (KST)</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:6px 0">전체 피드백</td><td style="text-align:right"><b>${s.total}</b>건</td></tr>
<tr><td style="padding:6px 0">👍 좋아요 / 😐 보통 / 👎 별로예요</td><td style="text-align:right"><b>${s.up}</b> / ${s.neutral} / ${s.down}</td></tr>
<tr><td style="padding:6px 0">좋아요 비율</td><td style="text-align:right"><b>${pct(s.positiveRate)}</b></td></tr>
<tr><td style="padding:6px 0">의견 (학습 사용 / 보류 / 제외)</td><td style="text-align:right">${s.usableComments} / ${s.flaggedComments} / ${s.rejectedComments}</td></tr>
</table>
<p style="font-size:14px;margin:16px 0 4px"><b>반응이 좋았던 스타일</b><br>${esc(concepts(s.topLiked))}</p>
<p style="font-size:14px;margin:8px 0"><b>아쉬움이 컸던 스타일</b><br>${esc(concepts(s.topDisliked))}</p>
${r.summary ? `<p style="font-size:14px;margin:12px 0"><b>요약</b><br>${esc(r.summary)}</p>` : ''}
<p style="font-size:14px;margin:12px 0 4px"><b>이번에 추천에 반영한 가이드</b></p>
${r.insightLines.length ? `<ul style="font-size:14px;margin:0;padding-left:18px">${r.insightLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p style="font-size:14px;margin:0;color:#6b7280">이번에는 새로 반영한 가이드가 없습니다.</p>'}
${r.pendingFlaggedTotal > 0 ? `<div style="margin:18px 0;padding:12px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;font-size:14px"><b>결정이 필요한 의견 ${r.pendingFlaggedTotal}건</b><br>${flagged ? esc(`이번 기간: ${flagged}`) + '<br>' : ''}선정적·종교·정치·혐오 등 민감한 내용이라 학습에 쓰지 않고 보류했습니다. 관리자 화면에서 승인하거나 제외해 주세요. (이메일에는 원문을 싣지 않습니다.)</div>` : ''}
<p style="margin-top:18px"><a href="${esc(r.adminUrl)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px">관리자 화면 열기</a></p>
</div>`;
  return { subject, html, text: textLines.join('\n') };
}
