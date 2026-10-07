import { describe, expect, it } from 'vitest';
import { allowedProductGenders, normalizeGender } from './productFilters';

describe('allowedProductGenders', () => {
  it('선택한 성별과 유니섹스만 허용한다', () => {
    expect(allowedProductGenders('female')).toEqual(['female', 'unisex']);
    expect(allowedProductGenders('male')).toEqual(['male', 'unisex']);
    expect(allowedProductGenders('kids')).toEqual(['kids', 'unisex']);
    expect(allowedProductGenders('unisex')).toEqual(['unisex']);
  });

  it('한글 값도 인식한다', () => {
    expect(allowedProductGenders('남성')).toEqual(['male', 'unisex']);
    expect(allowedProductGenders('여성')).toEqual(['female', 'unisex']);
  });

  it('선택이 없으면 프로필 성별을 쓰고, 둘 다 없으면 null', () => {
    expect(allowedProductGenders(null, 'male')).toEqual(['male', 'unisex']);
    expect(allowedProductGenders(undefined, '여성')).toEqual(['female', 'unisex']);
    expect(allowedProductGenders(null, null)).toBeNull();
    expect(allowedProductGenders('???', 'also-unknown')).toBeNull();
  });

  it('normalizeGender 는 대소문자·공백을 무시한다', () => {
    expect(normalizeGender(' Female ')).toBe('female');
    expect(normalizeGender('')).toBeNull();
  });
});
