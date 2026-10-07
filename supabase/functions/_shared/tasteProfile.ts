// A user's taste, learned from their own look feedback (thumbs up / down). Shared by
// style-recommend (Deno), the loading-ad personalization (web) and unit tests. No runtime imports.

export interface TasteProduct {
  id: string;
  brand?: string | null;
  category?: string | null;
  style_tags?: string[] | null;
  price?: number | null;
}

/** rating: 1 = 좋아요, 0 = 보통, -1 = 별로예요. at: 피드백 시각(오래된 신호는 영향이 줄어든다). */
export interface TasteSignal {
  rating: number;
  products: TasteProduct[];
  at?: string | number | Date | null;
}

export interface TasteProfile {
  signalCount: number;
  likedProductIds: Set<string>;
  dislikedProductIds: Set<string>;
  likedBrands: Map<string, number>;
  dislikedBrands: Map<string, number>;
  likedTags: Map<string, number>;
  dislikedTags: Map<string, number>;
  likedPrices: number[];
}

const HALF_LIFE_DAYS = 60;
const DAY_MS = 86_400_000;

export const normalizeKey = (v: string | null | undefined): string => (v ?? '').normalize('NFKC').trim().toLowerCase();

/** '여성>상의>니트' 같은 카테고리 경로형 태그는 취향 신호로 쓰지 않는다. */
const usableTags = (tags: string[] | null | undefined): string[] =>
  (tags ?? []).map(normalizeKey).filter((t) => t.length > 0 && !t.includes('>'));

function recencyWeight(at: TasteSignal['at'], now: number): number {
  if (at === null || at === undefined) return 1;
  const t = at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return 1;
  const days = Math.max(0, (now - t) / DAY_MS);
  return Math.max(0.15, Math.pow(0.5, days / HALF_LIFE_DAYS));
}

const bump = (m: Map<string, number>, key: string, w: number) => {
  if (key) m.set(key, (m.get(key) ?? 0) + w);
};

export function emptyTasteProfile(): TasteProfile {
  return {
    signalCount: 0,
    likedProductIds: new Set(),
    dislikedProductIds: new Set(),
    likedBrands: new Map(),
    dislikedBrands: new Map(),
    likedTags: new Map(),
    dislikedTags: new Map(),
    likedPrices: [],
  };
}

export function buildTasteProfile(signals: TasteSignal[], now: number = Date.now()): TasteProfile {
  const profile = emptyTasteProfile();
  for (const s of signals) {
    if (s.rating !== 1 && s.rating !== -1) continue; // '보통'은 방향이 없다
    const w = recencyWeight(s.at, now);
    const liked = s.rating === 1;
    profile.signalCount += 1;
    for (const p of s.products) {
      (liked ? profile.likedProductIds : profile.dislikedProductIds).add(p.id);
      bump(liked ? profile.likedBrands : profile.dislikedBrands, normalizeKey(p.brand), w);
      for (const tag of usableTags(p.style_tags)) bump(liked ? profile.likedTags : profile.dislikedTags, tag, w);
      if (liked && typeof p.price === 'number' && p.price > 0) profile.likedPrices.push(p.price);
    }
  }
  return profile;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 상품 순위에 더하는 취향 점수. 싫어한 상품은 크게 깎고, 좋아한 브랜드·스타일은 조금 올린다. */
export function tasteBonus(p: TasteProduct, profile: TasteProfile): number {
  if (profile.signalCount === 0) return 0;
  if (profile.dislikedProductIds.has(p.id)) return -0.5;
  const brand = normalizeKey(p.brand);
  let score = 0;
  if (brand) {
    score += clamp((profile.likedBrands.get(brand) ?? 0) * 0.08, 0, 0.2);
    score -= clamp((profile.dislikedBrands.get(brand) ?? 0) * 0.12, 0, 0.3);
  }
  let liked = 0;
  let disliked = 0;
  for (const tag of usableTags(p.style_tags)) {
    liked += profile.likedTags.get(tag) ?? 0;
    disliked += profile.dislikedTags.get(tag) ?? 0;
  }
  score += clamp(liked * 0.03, 0, 0.2);
  score -= clamp(disliked * 0.05, 0, 0.3);
  return clamp(score, -0.5, 0.35);
}

/** 좋아한 상품의 가격 중앙값. 신호가 없으면 null. */
export function preferredPrice(profile: TasteProfile): number | null {
  const prices = [...profile.likedPrices].sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
}
