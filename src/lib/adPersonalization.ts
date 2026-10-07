// 생성하는 동안 보여주는 제품 광고를 사용자의 취향에 맞춰 고른다.
// 신호: ① 좋아요/별로예요 피드백 ② 좋아요 표시한 상품 ③ 프로필 선호 스타일 ④ 지금 하는 요청 문장 ⑤ 예산/좋아한 가격대.
// 취향 쏠림을 막으려고 일부는 탐색용으로 남기고, 브랜드·카테고리가 한쪽에 몰리지 않게 한다.
import {
  buildTasteProfile,
  emptyTasteProfile,
  normalizeKey,
  preferredPrice,
  tasteBonus,
  type TasteProduct,
  type TasteSignal,
} from '../../supabase/functions/_shared/tasteProfile';

export interface AdCandidate extends TasteProduct {
  name: string;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  [extra: string]: unknown;
}

export interface AdTasteInput {
  /** 프로필의 선호 스타일 (id 또는 한글 이름) */
  stylePreferences?: string[] | null;
  /** 사용자가 좋아요 표시한 상품 */
  likedProducts?: TasteProduct[];
  /** 룩 피드백(좋아요/보통/별로예요)에서 온 신호 */
  feedbackSignals?: TasteSignal[];
  /** 지금 하고 있는 요청 문장 */
  requestText?: string | null;
  /** 요청 문장에서 읽은 예산 */
  budget?: number | null;
}

const STYLE_KEYWORDS: Record<string, string[]> = {
  minimal: ['미니멀', 'minimal'],
  street: ['스트릿', 'street'],
  classic: ['클래식', 'classic', '포멀', '정장'],
  casual: ['캐주얼', 'casual', '데일리'],
  sporty: ['스포티', 'sporty', '스포츠', '운동', '러닝'],
  bohemian: ['보헤미안', 'bohemian', '보호', '에스닉'],
};
const labelToId: Record<string, string> = { 미니멀: 'minimal', 스트릿: 'street', 클래식: 'classic', 캐주얼: 'casual', 스포티: 'sporty', 보헤미안: 'bohemian' };

const STOP_WORDS = new Set(['추천', '추천해줘', '추천해', '코디', '코디해줘', '옷', '룩', '스타일', '알려줘', '해줘', '보여줘', '입고', '싶어', '싶어요', '좀', '으로', '이랑', '하고', '에게', '한테', '입을', '입는', 'recommend', 'outfit', 'look', 'style', 'please', 'want']);

/** 요청 문장에서 상품 이름·태그와 맞춰 볼 키워드를 뽑는다 (조사·불용어 제외, 2자 이상). */
export function requestKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  const words = String(text).normalize('NFKC').toLowerCase().split(/[^0-9a-z가-힣]+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return Array.from(new Set(words)).slice(0, 12);
}

function preferenceKeywords(prefs: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const p of prefs ?? []) {
    const id = STYLE_KEYWORDS[p] ? p : labelToId[p];
    for (const k of id ? STYLE_KEYWORDS[id] : [normalizeKey(p)]) if (k) out.push(k.toLowerCase());
  }
  return Array.from(new Set(out));
}

const haystack = (c: AdCandidate) => `${c.name} ${c.brand ?? ''} ${c.category} ${(c.style_tags ?? []).filter((t) => !t.includes('>')).join(' ')}`.toLowerCase();

export interface RankOptions {
  limit?: number;
  /** 취향과 무관하게 섞어 넣는 탐색용 자리 수 */
  exploreSlots?: number;
  maxPerBrand?: number;
  maxPerCategory?: number;
  rng?: () => number;
}

export function scoreAd(c: AdCandidate, taste: AdTasteInput, ctx?: { profile: ReturnType<typeof buildTasteProfile>; prefKeys: string[]; reqKeys: string[]; targetPrice: number | null }): number {
  const profile = ctx?.profile ?? buildTasteProfile(buildSignals(taste));
  const prefKeys = ctx?.prefKeys ?? preferenceKeywords(taste.stylePreferences);
  const reqKeys = ctx?.reqKeys ?? requestKeywords(taste.requestText);
  const targetPrice = ctx?.targetPrice ?? (taste.budget ? Math.round(taste.budget / 3) : preferredPrice(profile));
  const hay = haystack(c);

  let score = tasteBonus(c, profile);
  score += Math.min(0.5, prefKeys.filter((k) => hay.includes(k)).length * 0.25);
  score += Math.min(0.4, reqKeys.filter((k) => hay.includes(k)).length * 0.2);
  if (targetPrice && c.price > 0) score += Math.max(0, 1 - Math.abs(Math.log(c.price / targetPrice))) * 0.2;
  return score;
}

function buildSignals(taste: AdTasteInput): TasteSignal[] {
  const signals: TasteSignal[] = [...(taste.feedbackSignals ?? [])];
  if (taste.likedProducts?.length) signals.push({ rating: 1, products: taste.likedProducts });
  return signals;
}

/**
 * 후보를 취향 점수순으로 고르되, 브랜드·카테고리가 몰리지 않게 하고 일부는 탐색용으로 남긴다.
 * 싫어한 상품은 나오지 않는다. 신호가 전혀 없으면 후보를 섞어서 보여준다.
 */
export function rankAdProducts(candidates: AdCandidate[], taste: AdTasteInput, opts: RankOptions = {}): AdCandidate[] {
  const { limit = 10, exploreSlots = 2, maxPerBrand = 2, maxPerCategory = 4, rng = Math.random } = opts;
  const profile = buildTasteProfile(buildSignals(taste));
  const prefKeys = preferenceKeywords(taste.stylePreferences);
  const reqKeys = requestKeywords(taste.requestText);
  const targetPrice = taste.budget ? Math.round(taste.budget / 3) : preferredPrice(profile);

  const pool = candidates.filter((c) => !profile.dislikedProductIds.has(c.id));
  const hasSignal = profile.signalCount > 0 || prefKeys.length > 0 || reqKeys.length > 0 || !!targetPrice;
  const shuffled = [...pool].sort(() => rng() - 0.5);
  if (!hasSignal) return shuffled.slice(0, limit);

  const scored = shuffled
    .map((c) => ({ c, s: scoreAd(c, taste, { profile, prefKeys, reqKeys, targetPrice }) + rng() * 0.05 })) // 같은 점수끼리는 매번 조금씩 다르게
    .sort((a, b) => b.s - a.s);

  const picked: AdCandidate[] = [];
  const brandCount = new Map<string, number>();
  const catCount = new Map<string, number>();
  // relaxCategory: 후보가 모자랄 때 카테고리 상한만 푼다. 브랜드 상한은 끝까지 지킨다.
  const take = (c: AdCandidate, relaxCategory = false): boolean => {
    const b = normalizeKey(c.brand) || c.id;
    const cat = normalizeKey(c.category);
    if ((brandCount.get(b) ?? 0) >= maxPerBrand) return false;
    if (!relaxCategory && (catCount.get(cat) ?? 0) >= maxPerCategory) return false;
    brandCount.set(b, (brandCount.get(b) ?? 0) + 1);
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    picked.push(c);
    return true;
  };

  const personalSlots = Math.max(0, limit - exploreSlots);
  for (const { c } of scored) {
    if (picked.length >= personalSlots) break;
    take(c);
  }
  // 탐색용: 아직 안 고른 것 중 취향 점수가 아주 낮지는 않은 것을 섞어서 (취향 쏠림 방지)
  const rest = scored.filter(({ c }) => !picked.includes(c) && tasteBonus(c, profile) > -0.2).map(({ c }) => c).sort(() => rng() - 0.5);
  for (const c of rest) {
    if (picked.length >= limit) break;
    take(c);
  }
  // 한도 때문에 모자라면: 카테고리 상한만 풀어서 채우고, 그래도 모자라면(후보가 정말 적을 때) 그대로 채운다
  for (const { c } of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) take(c, true);
  }
  for (const { c } of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  // 개인화 상위 → 탐색 순서가 티 나지 않게 한 번 섞되, 가장 취향에 맞는 1개는 맨 앞에 둔다
  const [first, ...others] = picked;
  return first ? [first, ...others.sort(() => rng() - 0.5)] : [];
}

export { emptyTasteProfile };
