import { describe, expect, it } from 'vitest';
import { buildTasteProfile, preferredPrice, tasteBonus } from '../../supabase/functions/_shared/tasteProfile';

const NOW = Date.parse('2026-10-07T00:00:00Z');
const prod = (id: string, brand: string, tags: string[], price = 50000) => ({ id, brand, style_tags: tags, price });

describe('취향 프로필 (좋아요/별로예요 피드백에서 학습)', () => {
  const profile = buildTasteProfile(
    [
      { rating: 1, at: '2026-10-06T00:00:00Z', products: [prod('a', '무신사 스탠다드', ['미니멀', '캐주얼'], 40000), prod('b', '무신사 스탠다드', ['미니멀'], 60000)] },
      { rating: -1, at: '2026-10-06T00:00:00Z', products: [prod('c', '스트릿브랜드', ['스트릿', '오버핏'])] },
      { rating: 0, products: [prod('d', '중립', ['클래식'])] }, // 보통: 방향 없음
    ],
    NOW,
  );

  it('좋아한 것·싫어한 것을 구분하고 보통은 무시한다', () => {
    expect(profile.signalCount).toBe(2);
    expect(profile.likedProductIds.has('a')).toBe(true);
    expect(profile.dislikedProductIds.has('c')).toBe(true);
    expect(profile.likedProductIds.has('d') || profile.dislikedProductIds.has('d')).toBe(false);
  });

  it('싫어한 상품은 크게 깎고 같은 브랜드·스타일도 조금 깎는다', () => {
    expect(tasteBonus(prod('c', '스트릿브랜드', ['스트릿']), profile)).toBe(-0.5);
    expect(tasteBonus(prod('x', '스트릿브랜드', ['스트릿', '오버핏']), profile)).toBeLessThan(0);
  });

  it('좋아한 브랜드·스타일은 올리고 상한이 있다', () => {
    const bonus = tasteBonus(prod('y', '무신사 스탠다드', ['미니멀', '캐주얼']), profile);
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(0.35);
  });

  it('상관없는 상품은 0 근처, 신호가 없으면 0', () => {
    expect(Math.abs(tasteBonus(prod('z', '다른', ['클래식']), profile))).toBeLessThan(0.01);
    expect(tasteBonus(prod('z', '아무', ['아무']), buildTasteProfile([], NOW))).toBe(0);
  });

  it("카테고리 경로형 태그('여성>상의>니트')는 신호로 쓰지 않는다", () => {
    const p = buildTasteProfile([{ rating: 1, products: [prod('p', 'B', ['여성>상의>니트'])] }], NOW);
    expect(p.likedTags.size).toBe(0);
  });

  it('오래된 피드백은 영향이 줄어든다', () => {
    const fresh = buildTasteProfile([{ rating: 1, at: '2026-10-06T00:00:00Z', products: [prod('p', 'B', ['미니멀'])] }], NOW);
    const old = buildTasteProfile([{ rating: 1, at: '2026-01-01T00:00:00Z', products: [prod('p', 'B', ['미니멀'])] }], NOW);
    expect(fresh.likedTags.get('미니멀')!).toBeGreaterThan(old.likedTags.get('미니멀')!);
  });

  it('좋아한 상품 가격의 중앙값', () => {
    expect(preferredPrice(profile)).toBe(50000);
    expect(preferredPrice(buildTasteProfile([], NOW))).toBeNull();
  });
});
