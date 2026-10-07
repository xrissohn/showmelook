// 상품 후보 필터 공통 규칙 (로딩 광고·추천·대체 후보에서 같이 쓴다)
// 가격 하한·오분류·태그 규칙은 서버와 공유하는 supabase/functions/_shared/productFilters.ts 에 있다.
export * from '../../supabase/functions/_shared/productFilters';


/** products_cache.gender 값은 female / male / unisex (kids 는 아동 상품) 로 정규화돼 있다. */
const GENDER_ALIASES: Record<string, 'female' | 'male' | 'unisex' | 'kids'> = {
  female: 'female',
  woman: 'female',
  women: 'female',
  여성: 'female',
  male: 'male',
  man: 'male',
  men: 'male',
  남성: 'male',
  unisex: 'unisex',
  유니섹스: 'unisex',
  공용: 'unisex',
  kids: 'kids',
  kid: 'kids',
  키즈: 'kids',
};

export type ProductGender = 'female' | 'male' | 'unisex' | 'kids';

export function normalizeGender(value: string | null | undefined): ProductGender | null {
  if (!value) return null;
  return GENDER_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * 프로필 성별 값 → 스타일 페이지에서 처음 선택해 둘 성별.
 * 'prefer_not_to_say'(비공개)는 특정 성별로 가정하지 않고 유니섹스로 둔다. 알 수 없는 값은 null.
 */
export function customGenderFromProfile(value: string | null | undefined): ProductGender | null {
  if (!value) return null;
  if (value.trim().toLowerCase() === 'prefer_not_to_say') return 'unisex';
  return normalizeGender(value);
}

/**
 * 선택한 성별(없으면 프로필 성별)에 맞는 products_cache.gender 값 목록.
 * 성별을 알 수 없거나 '유니섹스'를 고른 경우 null — 호출하는 쪽이 필터를 걸지 않는다
 * (유니섹스를 고른 사람은 남성복·여성복·중성적 상품을 모두 볼 수 있어야 한다).
 * 남성/여성을 고르면 그 성별과 유니섹스만.
 */
export function allowedProductGenders(
  selected: string | null | undefined,
  profileGender?: string | null,
): ProductGender[] | null {
  const g = normalizeGender(selected) ?? customGenderFromProfile(profileGender);
  if (!g || g === 'unisex') return null;
  return [g, 'unisex'];
}
