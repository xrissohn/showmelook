import { describe, expect, it } from 'vitest';
import { rankAdProducts, requestKeywords, type AdCandidate } from './adPersonalization';

const ad = (id: string, o: Partial<AdCandidate> = {}): AdCandidate => ({
  id, name: `${id} 상품`, brand: `브랜드${id}`, price: 50000, image_url: 'u', product_url: 'p', category: '상의', style_tags: [], ...o,
});
// 재현 가능한 난수
const seeded = () => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; };

describe('requestKeywords', () => {
  it('조사·불용어를 빼고 상품과 맞춰 볼 말만 남긴다', () => {
    expect(requestKeywords('겨울 데이트룩 추천해줘 베이지 코트')).toEqual(expect.arrayContaining(['겨울', '데이트룩', '베이지', '코트']));
    expect(requestKeywords('추천해줘')).toEqual([]);
    expect(requestKeywords(null)).toEqual([]);
  });
});

describe('맞춤 광고 순위', () => {
  const pool = [
    ad('m1', { name: '미니멀 셔츠', style_tags: ['미니멀'], brand: 'A' }),
    ad('m2', { name: '미니멀 슬랙스', style_tags: ['미니멀'], brand: 'B', category: '하의' }),
    ad('s1', { name: '스트릿 후드', style_tags: ['스트릿'], brand: 'C' }),
    ad('s2', { name: '스트릿 카고', style_tags: ['스트릿'], brand: 'D', category: '하의' }),
    ad('x1', { name: '무난한 니트', brand: 'E' }),
    ad('x2', { name: '무난한 청바지', brand: 'F', category: '하의' }),
    ad('x3', { name: '무난한 자켓', brand: 'G', category: '아우터' }),
    ad('x4', { name: '무난한 스니커즈', brand: 'H', category: '신발' }),
  ];

  it('선호 스타일(미니멀)이 위로 온다', () => {
    const r = rankAdProducts(pool, { stylePreferences: ['minimal'] }, { limit: 3, exploreSlots: 0, rng: seeded() }).map((c) => c.id);
    expect(r.slice(0, 2).sort()).toEqual(['m1', 'm2']);
  });

  it('요청 문장의 키워드가 반영된다', () => {
    const r = rankAdProducts(pool, { requestText: '스트릿 느낌으로 입고 싶어' }, { limit: 3, exploreSlots: 0, rng: seeded() }).map((c) => c.id);
    expect(r.slice(0, 2).sort()).toEqual(['s1', 's2']);
  });

  it('별로예요로 평가한 상품은 광고에 나오지 않고, 같은 브랜드·스타일은 뒤로 간다', () => {
    const r = rankAdProducts(
      pool,
      { feedbackSignals: [{ rating: -1, products: [{ id: 's1', brand: 'C', style_tags: ['스트릿'] }] }] },
      { limit: 8, exploreSlots: 0, rng: seeded() },
    ).map((c) => c.id);
    expect(r).not.toContain('s1');
    expect(r.indexOf('s2')).toBeGreaterThan(r.indexOf('x1')); // 같은 스트릿 스타일은 무난한 상품보다 뒤
  });

  it('좋아요로 평가한 취향이 위로 온다', () => {
    const r = rankAdProducts(pool, { feedbackSignals: [{ rating: 1, products: [{ id: 'old', brand: 'A', style_tags: ['미니멀'] }] }] }, { limit: 3, exploreSlots: 0, rng: seeded() }).map((c) => c.id);
    expect(r[0]).toBe('m1'); // 같은 브랜드+같은 스타일
  });

  it('브랜드·카테고리가 한쪽에 몰리지 않는다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ad(`k${i}`, { name: '미니멀 셔츠', style_tags: ['미니멀'], brand: i < 8 ? 'SAME' : `B${i}` }));
    const r = rankAdProducts(many, { stylePreferences: ['미니멀'] }, { limit: 6, exploreSlots: 0, maxPerBrand: 2, rng: seeded() });
    expect(r.filter((c) => c.brand === 'SAME').length).toBeLessThanOrEqual(2);
    expect(r).toHaveLength(6);
  });

  it('탐색용 자리에는 취향 밖 상품도 섞인다 (취향 쏠림 방지)', () => {
    const r = rankAdProducts(pool, { stylePreferences: ['minimal'] }, { limit: 6, exploreSlots: 3, rng: seeded() }).map((c) => c.id);
    expect(r.some((id) => id.startsWith('x') || id.startsWith('s'))).toBe(true);
    expect(r).toHaveLength(6);
  });

  it('신호가 없으면 섞어서 개수만큼 보여준다', () => {
    const r = rankAdProducts(pool, {}, { limit: 5, rng: seeded() });
    expect(r).toHaveLength(5);
    expect(new Set(r.map((c) => c.id)).size).toBe(5);
  });

  it('예산이 있으면 가격대가 맞는 상품이 약간 유리', () => {
    const items = [ad('cheap', { price: 20000, name: 'a' }), ad('mid', { price: 100000, name: 'b' }), ad('pricey', { price: 900000, name: 'c' })];
    const r = rankAdProducts(items, { budget: 300000 }, { limit: 3, exploreSlots: 0, rng: seeded() }).map((c) => c.id);
    expect(r[0]).toBe('mid');
  });
});
