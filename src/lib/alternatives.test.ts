import { describe, expect, it } from 'vitest';
import { priceBand, rankAlternatives, isKidsProduct, type AltCandidate } from './alternatives';

const base = (o: Partial<AltCandidate>): AltCandidate => ({
  id: 'x',
  name: '스니커즈',
  brand: 'B',
  price: 50000,
  image_url: 'u',
  product_url: 'p',
  category: '신발',
  style_tags: ['캐주얼'],
  gender: 'unisex',
  item_slot: 'shoes',
  ...o,
});
const current = { price: 60000, style_tags: ['캐주얼', '스트릿'], item_slot: 'shoes' };

describe('priceBand', () => {
  it('현재 가격의 ±50%, 하한 ₩1,000', () => {
    expect(priceBand(60000)).toEqual({ lo: 30000, hi: 90000 });
    expect(priceBand(1200)).toEqual({ lo: 1000, hi: 1800 });
  });
});

describe('rankAlternatives', () => {
  it('QA 사례: 아쿠아슈즈·아기 양말·메신저백 같은 부적합 후보를 거른다', () => {
    const out = rankAlternatives(
      [
        base({ id: 'bag', name: '데일리 메신저백', price: 9000, item_slot: 'bag' }),
        base({ id: 'sock', name: '아기 양말 세트', price: 2000, item_slot: 'accessory' }),
        base({ id: 'kids', name: '키즈 운동화', price: 30000 }),
        base({ id: 'cheap', name: '러닝화', price: 500 }),
        base({ id: 'ok', name: '클래식 로퍼', price: 58000 }),
      ],
      { current, selectedGender: 'male' },
    );
    expect(out.map((p) => p.id)).toEqual(['ok']);
  });

  it('반대 성별은 제외하고 성별을 모르는 상품은 남긴다', () => {
    const out = rankAlternatives(
      [
        base({ id: 'f', gender: 'female' }),
        base({ id: 'm', gender: 'male' }),
        base({ id: 'n', gender: null }),
      ],
      { current, selectedGender: 'male' },
    );
    expect(out.map((p) => p.id).sort()).toEqual(['m', 'n']);
    expect(out[0].id).toBe('m');
  });

  it('아동 요청이면 아동 상품도 허용한다', () => {
    const kid = base({ id: 'k', name: '키즈 스니커즈', gender: 'kids' });
    expect(rankAlternatives([kid], { current, selectedGender: 'male' })).toHaveLength(0);
    expect(rankAlternatives([kid], { current, selectedGender: 'kids', kidsRequest: true })).toHaveLength(1);
  });

  it('같은 자리만 남긴다 (원피스는 하의 후보가 아님)', () => {
    const cur = { price: 40000, style_tags: null, item_slot: 'bottom' };
    const out = rankAlternatives(
      [
        base({ id: 'dress', category: '하의', name: '플레어 원피스', item_slot: 'dress' }),
        base({ id: 'pants', category: '하의', name: '와이드 팬츠', item_slot: 'bottom', price: 39000 }),
      ],
      { current: cur, selectedGender: 'female' },
    );
    expect(out.map((p) => p.id)).toEqual(['pants']);
  });

  it('가격대 안 · 태그가 겹치는 상품이 먼저, 단순 최저가순이 아니다', () => {
    const out = rankAlternatives(
      [
        base({ id: 'cheap', price: 3000, style_tags: [] }),
        base({ id: 'near', price: 62000, style_tags: ['캐주얼', '스트릿'] }),
        base({ id: 'mid', price: 80000, style_tags: ['캐주얼'] }),
      ],
      { current, selectedGender: 'male' },
    );
    expect(out.map((p) => p.id)).toEqual(['near', 'mid', 'cheap']);
  });

  it('limit 을 지킨다', () => {
    const many = Array.from({ length: 50 }, (_, i) => base({ id: String(i), price: 50000 + i }));
    expect(rankAlternatives(many, { current, selectedGender: 'male', limit: 10 })).toHaveLength(10);
  });
});

describe('isKidsProduct', () => {
  it('영문 단어 경계를 본다', () => {
    expect(isKidsProduct(base({ name: 'Kids Hoodie' }))).toBe(true);
    expect(isKidsProduct(base({ name: 'Skid Resistant Shoes' }))).toBe(false);
    expect(isKidsProduct(base({ name: '러닝화', gender: 'kids' }))).toBe(true);
  });
});
