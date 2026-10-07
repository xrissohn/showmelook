import { describe, expect, it } from 'vitest';
import { rankAlternatives, type AltCandidate } from './alternatives';
import { allowedProductGenders, customGenderFromProfile } from './productFilters';

// QA 시나리오: 성적 지향·성별 표현이 다양한 사용자가 같은 상품 풀에서 원하는 옷을 볼 수 있어야 한다.
// 서비스는 성적 지향을 묻거나 저장하지 않는다. 프로필 성별(저장값)과 '이번에 찾는 옷의 성별(선택)'은 따로 다룬다.
const item = (id: string, gender: string | null, o: Partial<AltCandidate> = {}): AltCandidate => ({
  id, name: `${id} 셔츠`, brand: 'B', price: 50000, image_url: 'u', product_url: 'p',
  category: '상의', style_tags: ['캐주얼'], gender, item_slot: 'top', ...o,
});
const POOL = [
  item('여성복', 'female'),
  item('남성복', 'male'),
  item('유니섹스', 'unisex'),
  item('성별모름', null),
  item('아동복', 'kids', { name: '키즈 셔츠' }),
];
const current = { price: 50000, style_tags: ['캐주얼'], item_slot: 'top' };
const ids = (selected: string, profile: string | null, kidsRequest = false) =>
  rankAlternatives(POOL, { current, selectedGender: selected, profileGender: profile, kidsRequest }).map((p) => p.id);

describe('페르소나별 상품 후보', () => {
  it('게이 남성(프로필 남성, 남성복 선택): 남성복·유니섹스(·성별 모름)만, 여성복·아동복 제외', () => {
    expect(ids('male', 'male').sort()).toEqual(['남성복', '성별모름', '유니섹스']);
  });

  it('레즈비언 여성(프로필 여성): 여성복을 고르든 톰보이 스타일로 남성복을 고르든 선택한 쪽이 보인다', () => {
    expect(ids('female', 'female')).toContain('여성복');
    expect(ids('male', 'female')).toContain('남성복');
    expect(ids('male', 'female')).not.toContain('여성복');
  });

  it('여장남자(프로필 남성, 여성복 선택): 프로필이 아니라 선택한 여성복이 나온다', () => {
    const r = ids('female', 'male');
    expect(r).toContain('여성복');
    expect(r).not.toContain('남성복');
    expect(allowedProductGenders('female', 'male')).toEqual(['female', 'unisex']);
  });

  it('남장여자(프로필 여성, 남성복 선택): 남성복이 나온다', () => {
    const r = ids('male', 'female');
    expect(r).toContain('남성복');
    expect(r).not.toContain('여성복');
  });

  it('양성애자·논바이너리(프로필 유니섹스/비공개, 유니섹스 선택): 남성복·여성복·유니섹스 모두 볼 수 있다', () => {
    expect(customGenderFromProfile('prefer_not_to_say')).toBe('unisex'); // 여성으로 가정하지 않는다
    expect(allowedProductGenders(customGenderFromProfile('prefer_not_to_say'))).toBeNull();
    const r = ids('unisex', 'prefer_not_to_say');
    expect(r).toEqual(expect.arrayContaining(['여성복', '남성복', '유니섹스']));
    expect(r).not.toContain('아동복'); // 성인에게 아동 상품은 나오지 않는다
  });
});
