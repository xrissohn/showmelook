import { describe, expect, it } from 'vitest';
import {
  buildColorLock,
  colorConstraint,
  parseColorsFromString,
  resolveItemColors,
} from '../../supabase/functions/_shared/productColors';

describe('parseColorsFromString', () => {
  it('상품명의 색 단어를 먼저 나온 순서로 읽는다', () => {
    expect(parseColorsFromString('오버핏 블랙 폴로 셔츠')).toEqual(['black']);
    expect(parseColorsFromString('Classic Polo Navy / White')).toEqual(['navy', 'white']);
    expect(parseColorsFromString('아이보리 니트 베이지 라인')).toEqual(['ivory', 'beige']);
  });
  it('오탐: 백팩·standard·탄탄·브랜드명의 색 단어는 색으로 읽지 않는다', () => {
    expect(parseColorsFromString('데일리 백팩')).toEqual([]);
    expect(parseColorsFromString('Standard Fit Polo')).toEqual([]);
    expect(parseColorsFromString('탄탄한 코튼 폴로')).toEqual([]);
    expect(parseColorsFromString('블랙야크 하이킹 재킷')).toEqual([]);
    expect(parseColorsFromString('Tan chino pants')).toEqual(['tan']);
  });
  it('빈 값', () => {
    expect(parseColorsFromString(null)).toEqual([]);
    expect(parseColorsFromString('')).toEqual([]);
  });
});

describe('resolveItemColors', () => {
  it('dna_meta.color_family 가 있으면 그것을 쓴다', () => {
    expect(resolveItemColors({ name: '블랙 폴로', dna_meta: { color_family: ['navy'] } })).toEqual(['navy']);
  });
  it('색 정보가 비면 color 필드, 그다음 상품명에서 채운다', () => {
    expect(resolveItemColors({ name: '폴로 셔츠', color: 'Black' })).toEqual(['black']);
    expect(resolveItemColors({ name: '블랙 폴로 셔츠', color: null, dna_meta: {} })).toEqual(['black']);
    expect(resolveItemColors({ name: '폴로 셔츠', dna_meta: { color_family: 'unknown' } })).toEqual([]);
  });
  it('4색 이상이면 이미지 참조로 넘긴다', () => {
    expect(resolveItemColors({ name: '레드 블루 그린 옐로우 스트라이프' })).toEqual([]);
  });
});

describe('프롬프트 문구', () => {
  it('단색은 그리면 안 되는 색까지 못박는다 (검정 → 갈색 방지)', () => {
    const c = colorConstraint(['black'], 1);
    expect(c).toContain('EXACT COLOR: black ONLY');
    expect(c).toContain('do NOT render it as brown');
  });
  it('색을 모르면 이미지 번호로 안내한다', () => {
    expect(colorConstraint([], 3)).toBe('match the EXACT color from product image #3');
  });
  it('COLOR LOCK 은 아이템마다 색(또는 이미지 번호)을 적는다', () => {
    const lock = buildColorLock([
      { name: '폴로', colors: ['black'] },
      { name: '슬랙스', colors: [] },
    ]);
    expect(lock).toContain('#1 폴로 = black');
    expect(lock).toContain('#2 슬랙스 = exact color of product image #2');
    expect(buildColorLock([])).toBe('');
  });
});
