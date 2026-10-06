// Budget helpers shared by style-recommend (Deno) and unit tests (Vitest). No runtime imports.

// ============= 💰 예산 (사용자 요청 문장에서 읽기) =============
// "20만원", "예산 20만", "200,000원", "30만원 이하", "10~20만원"(상한), "50만원대"(59.9만까지),
// "200k won", "$150" 등을 원 단위 상한으로 바꾼다. "50만원 이상"처럼 하한이면 상한 없음.
export const BUDGET_MIN = 10000;
export const BUDGET_MAX = 10000000;
export function parseBudgetFromRequest(text: string | undefined | null): number | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ');
  const plausible = (v: number) => (Number.isFinite(v) && v >= BUDGET_MIN && v <= BUDGET_MAX ? Math.round(v) : null);
  const after = (index: number, length: number, n: number) => t.slice(index + length, index + length + n);
  // "50만원 이상"처럼 하한이면 그 금액은 상한이 아니다 (다음 금액을 계속 찾는다)
  const isMinimum = (index: number, length: number) => /^\s*(이상|넘게|넘는|부터|over|\+)/i.test(after(index, length, 6));
  // "10만원짜리 니트"처럼 한 상품의 가격이면 예산이 아니다
  const isItemPrice = (index: number, length: number) => /^\s*짜리/.test(after(index, length, 4));
  // "30만원 대신 20만원"이면 앞 금액은 버린다
  const isReplaced = (index: number, length: number) => /^\s*대신/.test(after(index, length, 4));

  // 10~20만원, 10만~20만 원, 10만원~20만원, 10만원에서 20만원, 5만원-10만원 → 상한
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:만\s*)?(?:원\s*)?(?:~|-|–|에서)\s*(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (m) return plausible(parseFloat(m[2]) * 10000);

  // 50만원대 → 50~59.9만 (뒤에 '대신', '대학' 같은 다른 낱말이 오면 아님)
  m = t.match(/(\d+(?:\.\d+)?)\s*만\s*원?\s*대(?=$|[^가-힣]|로|의|에|면|까지|정도|이하|이내)/);
  if (m) {
    const v = parseFloat(m[1]) * 10000;
    return plausible(v + Math.pow(10, Math.floor(Math.log10(v))) - 1);
  }

  // 20만원 / 20만 원 / 예산 20만 / 20만 이하·이내·정도·까지
  const manRe = /(\d+(?:\.\d+)?)\s*만\s*(원|이하|이내|까지|정도|안쪽|내외|선|으로|대로|미만)?/g;
  let mm: RegExpExecArray | null;
  while ((mm = manRe.exec(t)) !== null) {
    const hasUnit = !!mm[2];
    const nearBudgetWord = /(예산|budget|최대|max)/i.test(t.slice(Math.max(0, mm.index - 8), mm.index));
    if (!hasUnit && !nearBudgetWord) continue;
    if (isItemPrice(mm.index, mm[0].length) || isReplaced(mm.index, mm[0].length) || isMinimum(mm.index, mm[0].length)) continue;
    return plausible(parseFloat(mm[1]) * 10000);
  }

  // 200,000원 / 200000원
  const wonRe = /(\d{1,3}(?:,\d{3})+|\d{5,})\s*원/g;
  let wm: RegExpExecArray | null;
  while ((wm = wonRe.exec(t)) !== null) {
    if (isItemPrice(wm.index, wm[0].length) || isReplaced(wm.index, wm[0].length) || isMinimum(wm.index, wm[0].length)) continue;
    return plausible(parseInt(wm[1].replace(/,/g, ''), 10));
  }

  // English: 200k won / 200,000 KRW / under ₩300,000 / $150 (≈ 1,350원/$)
  m = t.match(/(\d+(?:\.\d+)?)\s*k\s*(?:won|krw)\b/i);
  if (m) return plausible(parseFloat(m[1]) * 1000);
  m = t.match(/(?:₩\s*)(\d{1,3}(?:,\d{3})+|\d{4,})|(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:won|krw)\b/i);
  if (m) return plausible(parseInt((m[1] || m[2]).replace(/,/g, ''), 10));
  m = t.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (m) return plausible(parseFloat(m[1]) * 1350);

  return null;
}

// 카테고리별 가격 상한 비율 (합이 1을 넘지만, 최종 합계는 아래 교체 단계에서 맞춘다)
export const BUDGET_SHARE: Record<string, number> = { '상의': 0.35, '하의': 0.35, '신발': 0.35, '아우터': 0.45, '액세서리': 0.25 };
