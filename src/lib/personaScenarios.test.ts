import { describe, expect, it } from 'vitest';
import { rankAlternatives, type AltCandidate } from './alternatives';
import { allowedProductGenders, customGenderFromProfile, resolveClothingGender } from './productFilters';

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

  // 사용자가 원하는 룩이 항상 우선: 프로필·화면에서 고른 성별이 무엇이든 요청 문장이 말한 옷의 성별로 추천한다.
  describe('요청 문장이 말한 옷의 성별이 프로필·선택 성별보다 우선', () => {
    const run = (request: string, selected: string, profile: string | null) => {
      const g = resolveClothingGender(request, selected).gender;
      return rankAlternatives(POOL, { current, selectedGender: g, profileGender: profile }).map((p) => p.id);
    };

    it('남성 프로필·남성 선택인데 여성복을 요청 (여장)', () => {
      const r = run('여성복으로 파티룩 추천해줘', 'male', 'male');
      expect(r).toContain('여성복');
      expect(r).not.toContain('남성복');
    });
    it('여성 프로필·여성 선택인데 남성복을 요청 (남장)', () => {
      const r = run('남성복 셔츠 코디해줘', 'female', 'female');
      expect(r).toContain('남성복');
      expect(r).not.toContain('여성복');
    });
    it('남성 프로필로 "원피스"를 말하면 여성복', () => {
      const r = run('원피스 입고 싶어', 'male', 'male');
      expect(r).toContain('여성복');
      expect(r).not.toContain('남성복');
    });
    it('젠더리스를 요청하면 남성복·여성복·유니섹스를 모두', () => {
      const r = run('젠더리스 룩 추천해줘', 'female', 'female');
      expect(r).toEqual(expect.arrayContaining(['여성복', '남성복', '유니섹스']));
    });
    it('남자친구에게 줄 선물이면 (여성 프로필이어도) 남성복', () => {
      const r = run('남자친구한테 줄 선물 셔츠', 'female', 'female');
      expect(r).toContain('남성복');
      expect(r).not.toContain('여성복');
    });
    it('요청 문장이 말이 없으면 선택한 성별을 따른다', () => {
      const r = run('데이트룩 추천해줘', 'male', 'female');
      expect(r).toContain('남성복');
      expect(r).not.toContain('여성복');
    });
  });
});
