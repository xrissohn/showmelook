import { describe, expect, it } from 'vitest';
import { replaceProductMention, swapIdInList } from './lookSwap';

const oldP = { id: 'a', name: '클래식 레더 로퍼', brand: '닥터마틴' };
const newP = { id: 'b', name: '캔버스 스니커즈', brand: '컨버스' };

describe('swapIdInList', () => {
  it('교체 전 상품 자리에 새 상품을 넣고 순서를 유지한다', () => {
    expect(swapIdInList(['x', 'a', 'y'], 'a', 'b')).toEqual(['x', 'b', 'y']);
  });
  it('이 룩에 없던 상품이면 null', () => {
    expect(swapIdInList(['x', 'y'], 'a', 'b')).toBeNull();
    expect(swapIdInList(null, 'a', 'b')).toBeNull();
  });
  it('새 상품이 이미 들어 있으면 중복을 만들지 않는다', () => {
    expect(swapIdInList(['b', 'a'], 'a', 'b')).toEqual(['b']);
  });
});

describe('replaceProductMention', () => {
  it("'브랜드 상품명'을 교체 상품으로 바꾼다", () => {
    const r = replaceProductMention('포인트는 닥터마틴 클래식 레더 로퍼예요.', oldP, newP);
    expect(r).toEqual({ text: '포인트는 컨버스 캔버스 스니커즈예요.', changed: true });
  });
  it('상품명만 말해도 바꾼다', () => {
    expect(replaceProductMention('클래식 레더 로퍼로 마무리', oldP, newP).text).toBe('캔버스 스니커즈로 마무리');
  });
  it('브랜드만 언급되면 그대로 둔다', () => {
    expect(replaceProductMention('닥터마틴 무드로 맞췄어요', oldP, newP)).toEqual({ text: '닥터마틴 무드로 맞췄어요', changed: false });
  });
  it('설명이 비어 있으면 그대로', () => {
    expect(replaceProductMention(null, oldP, newP)).toEqual({ text: null, changed: false });
  });
});
