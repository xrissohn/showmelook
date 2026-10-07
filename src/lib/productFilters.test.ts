import { describe, expect, it } from 'vitest';
import {
  MIN_PRODUCT_PRICE,
  allowedProductGenders,
  customGenderFromProfile,
  isBelowMinPrice,
  isCategoryNameMismatch,
  isUsableCandidate,
  normalizeGender,
  visibleStyleTags,
} from './productFilters';

describe('allowedProductGenders', () => {
  it('선택한 성별과 유니섹스만 허용한다', () => {
    expect(allowedProductGenders('female')).toEqual(['female', 'unisex']);
    expect(allowedProductGenders('male')).toEqual(['male', 'unisex']);
    expect(allowedProductGenders('kids')).toEqual(['kids', 'unisex']);
    // 유니섹스를 고르면 남성복·여성복·중성 상품을 모두 보여준다 (필터 없음)
    expect(allowedProductGenders('unisex')).toBeNull();
  });

  it('비공개(prefer_not_to_say) 프로필은 성별을 가정하지 않는다', () => {
    expect(customGenderFromProfile('prefer_not_to_say')).toBe('unisex');
    expect(allowedProductGenders(null, 'prefer_not_to_say')).toBeNull();
    expect(customGenderFromProfile('unisex')).toBe('unisex');
    expect(customGenderFromProfile('???')).toBeNull();
  });

  it('프로필 성별과 다른 성별을 고르면 선택한 쪽이 우선', () => {
    expect(allowedProductGenders('female', 'male')).toEqual(['female', 'unisex']); // 여성복을 찾는 남성 프로필
    expect(allowedProductGenders('male', 'female')).toEqual(['male', 'unisex']); // 남성복을 찾는 여성 프로필
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

describe('가격 하한', () => {
  it('₩1,000 미만과 값이 없는 상품은 제외한다', () => {
    expect(MIN_PRODUCT_PRICE).toBe(1000);
    expect(isBelowMinPrice(999)).toBe(true);
    expect(isBelowMinPrice(0)).toBe(true);
    expect(isBelowMinPrice(null)).toBe(true);
    expect(isBelowMinPrice(undefined)).toBe(true);
    expect(isBelowMinPrice(1000)).toBe(false);
    expect(isBelowMinPrice('29900')).toBe(false);
  });
});

describe('카테고리와 이름이 다른 부위', () => {
  it("'신발' 카테고리에 들어간 가방·양말·옷은 오분류", () => {
    expect(isCategoryNameMismatch({ category: '신발', name: '데일리 메신저백' })).toBe(true);
    expect(isCategoryNameMismatch({ category: '신발', name: '아기 양말 5종 세트' })).toBe(true);
    expect(isCategoryNameMismatch({ category: '신발', name: '오버핏 맨투맨' })).toBe(true);
  });

  it('카테고리와 이름이 맞으면 통과', () => {
    expect(isCategoryNameMismatch({ category: '신발', name: '클래식 레더 로퍼' })).toBe(false);
    expect(isCategoryNameMismatch({ category: '상의', name: '코튼 니트 가디건' })).toBe(false);
    expect(isCategoryNameMismatch({ category: '액세서리', name: '캔버스 에코백' })).toBe(false);
    expect(isCategoryNameMismatch({ category: '하의', name: '와이드 부츠컷 데님 팬츠' })).toBe(false);
  });

  it('이름이 모호하거나 카테고리가 모호하면 건드리지 않는다', () => {
    expect(isCategoryNameMismatch({ category: '신발', name: 'AIR FORCE 1 07' })).toBe(false);
    expect(isCategoryNameMismatch({ category: '여성', name: '데일리 메신저백' })).toBe(false);
    expect(isCategoryNameMismatch({ category: null, name: '로퍼' })).toBe(false);
  });

  it('여러 부위가 같이 읽히면 카테고리 쪽이 있는 한 통과', () => {
    expect(isCategoryNameMismatch({ category: '아우터', name: '후드 모자 탈부착 패딩 자켓' })).toBe(false);
  });

  it('isUsableCandidate 는 가격과 오분류를 함께 본다', () => {
    expect(isUsableCandidate({ category: '신발', name: '러닝 스니커즈', price: 59000 })).toBe(true);
    expect(isUsableCandidate({ category: '신발', name: '러닝 스니커즈', price: 500 })).toBe(false);
    expect(isUsableCandidate({ category: '신발', name: '메신저백', price: 59000 })).toBe(false);
  });
});

describe('스타일 태그 표시', () => {
  it("'>' 가 들어간 카테고리 경로형 태그와 빈 값은 숨긴다", () => {
    expect(visibleStyleTags(['캐주얼', '여성>상의>니트', '  ', null, '미니멀'])).toEqual(['캐주얼', '미니멀']);
    expect(visibleStyleTags(null)).toEqual([]);
  });
});

import { detectRequestedClothingGender, resolveClothingGender } from './productFilters';

describe('요청 문장이 말하는 옷의 성별이 항상 우선', () => {
  const cases: Array<[string, 'male' | 'female' | 'unisex' | null]> = [
    // 명시적 표현
    ['남성복 데이트룩 추천해줘', 'male'],
    ['여성복으로 출근룩 알려줘', 'female'],
    ['남자 옷 코디해줘', 'male'],
    ['여자 코트 추천', 'female'],
    ['남성용 스니커즈', 'male'],
    ['여장 코디 추천해줘', 'female'],
    ['남장 룩 하고 싶어', 'male'],
    ["men's winter coat", 'male'],
    ["women's blazer for work", 'female'],
    // 품목이 말해주는 경우
    ['남자인데 원피스 입고 싶어', 'female'],
    ['치마 코디 알려줘', 'female'],
    ['드레스 셔츠에 어울리는 바지', null],
    // 젠더리스/둘 다
    ['젠더리스 룩 추천해줘', 'unisex'],
    ['유니섹스로 입을 만한 후드', 'unisex'],
    ['남성복이랑 여성복 둘 다 보여줘', 'unisex'],
    // 선물 받는 사람
    ['남자친구한테 줄 생일 선물 옷 추천', 'male'],
    ['엄마 선물로 줄 니트', 'female'],
    // 말이 없거나 애매하면 화면 선택을 따른다
    ['데이트룩 추천해줘', null],
    ['여자친구랑 커플룩 입고 싶어', null],
    ['남자친구랑 첫 데이트룩', null],
    ['겨울 코트 추천', null],
    ['', null],
  ];
  for (const [text, want] of cases) {
    it(`"${text}" → ${want}`, () => expect(detectRequestedClothingGender(text)).toBe(want));
  }

  it('명시적 표현이 선물 받는 사람보다 우선', () => {
    expect(detectRequestedClothingGender('여자친구 선물로 줄 남성복')).toBe('male');
  });

  it('요청 문장이 있으면 프로필·선택 성별보다 우선하고, 없으면 선택을 따른다', () => {
    expect(resolveClothingGender('남성복 추천해줘', 'female')).toEqual({ gender: 'male', fromRequest: true });
    expect(resolveClothingGender('여성복 추천해줘', 'male')).toEqual({ gender: 'female', fromRequest: true });
    expect(resolveClothingGender('데이트룩', 'female')).toEqual({ gender: 'female', fromRequest: false });
  });

  it('아동 모드는 요청 문장으로 바꾸지 않는다', () => {
    expect(resolveClothingGender('남성복 추천', 'kids')).toEqual({ gender: 'kids', fromRequest: false });
    expect(resolveClothingGender('남성복 추천', '키즈')).toEqual({ gender: '키즈', fromRequest: false });
  });

  it('요청 문장의 성별로 후보를 고르면 프로필 성별과 무관하게 그 성별 상품이 나온다', () => {
    const { gender } = resolveClothingGender('여성복 추천해줘', 'male'); // 남성 프로필 + 여성복 요청
    expect(allowedProductGenders(gender)).toEqual(['female', 'unisex']);
  });
});
