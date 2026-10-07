// '다른 ○○ 보기' 대체 후보 고르기: 같은 자리 · 성별/연령 · 가격대 · 스타일 태그 순
import {
  MIN_PRODUCT_PRICE,
  allowedProductGenders,
  isUsableCandidate,
  normalizeGender,
} from './productFilters';

export interface AltCandidate {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  sub_category?: string | null;
  style_tags: string[] | null;
  gender?: string | null;
  item_slot?: string | null;
  target_age?: string | null;
}

export interface AltCurrent {
  price: number;
  style_tags: string[] | null;
  item_slot?: string | null;
}

/** 현재 상품 가격의 ±50% (최저가는 ₩1,000). */
export function priceBand(price: number): { lo: number; hi: number } {
  const p = Number(price) > 0 ? Number(price) : MIN_PRODUCT_PRICE;
  return { lo: Math.max(MIN_PRODUCT_PRICE, Math.round(p * 0.5)), hi: Math.round(p * 1.5) };
}

const KIDS_RE = /키즈|아동|어린이|유아|베이비|아기|주니어|초등|소아|남아|여아|\bkids?\b|\bbaby\b|\bjunior\b|toddler|infant|children/i;

export function isKidsProduct(p: Pick<AltCandidate, 'name' | 'category' | 'brand' | 'gender' | 'target_age'>): boolean {
  if (normalizeGender(p.gender) === 'kids') return true;
  if (p.target_age && KIDS_RE.test(p.target_age)) return true;
  return KIDS_RE.test(`${p.name || ''} ${p.category || ''} ${p.brand || ''}`);
}

function tagOverlap(a: string[] | null | undefined, b: string[] | null | undefined): number {
  if (!a?.length || !b?.length) return 0;
  const common = a.filter((t) => b.includes(t)).length;
  return common / Math.max(a.length, b.length);
}

export interface RankOptions {
  current?: AltCurrent;
  selectedGender?: string | null;
  profileGender?: string | null;
  /** 아동 상품 요청일 때만 true (성별을 '키즈'로 고른 경우). */
  kidsRequest?: boolean;
  limit?: number;
}

/**
 * 후보를 걸러 점수순으로 정렬한다.
 * 제외: ₩1,000 미만, 카테고리·이름 불일치, 다른 자리(item_slot), 반대 성별, 아동 요청이 아닐 때의 아동 상품.
 * 점수: 같은 자리 +3 · 성별 일치 +2/유니섹스 +1 · 가격대 ±50% 안 +2 및 가까울수록 가산 · 스타일 태그 겹침 ×2.
 */
export function rankAlternatives(candidates: AltCandidate[], opts: RankOptions = {}): AltCandidate[] {
  const { current, kidsRequest = false, limit = 30 } = opts;
  const genders = kidsRequest ? null : allowedProductGenders(opts.selectedGender, opts.profileGender);
  const wantGender = normalizeGender(opts.selectedGender) ?? normalizeGender(opts.profileGender);
  const band = current ? priceBand(current.price) : null;

  const scored: Array<{ item: AltCandidate; score: number }> = [];
  for (const item of candidates) {
    if (!isUsableCandidate(item)) continue;
    if (!kidsRequest && isKidsProduct(item)) continue;

    const g = normalizeGender(item.gender);
    if (genders && g && !genders.includes(g)) continue; // 반대 성별 제외 (성별 모르는 상품은 남긴다)

    let score = 0;
    if (current?.item_slot && item.item_slot) {
      if (current.item_slot !== item.item_slot) continue;
      score += 3;
    }
    if (g && g === wantGender) score += 2;
    else if (g === 'unisex') score += 1;

    if (current && band && current.price > 0) {
      const inBand = item.price >= band.lo && item.price <= band.hi;
      if (inBand) score += 2;
      score -= Math.min(2, Math.abs(Math.log(item.price / current.price))) * 0.5;
    }
    score += tagOverlap(current?.style_tags, item.style_tags) * 2;
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
