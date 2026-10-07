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
 * 선택한 성별(없으면 프로필 성별)에 맞는 products_cache.gender 값 목록.
 * 성별을 알 수 없으면 null — 호출하는 쪽이 필터를 걸지 않는다.
 * 유니섹스는 항상 포함한다.
 */
export function allowedProductGenders(
  selected: string | null | undefined,
  profileGender?: string | null,
): ProductGender[] | null {
  const g = normalizeGender(selected) ?? normalizeGender(profileGender);
  if (!g) return null;
  return g === 'unisex' ? ['unisex'] : [g, 'unisex'];
}
