// Product candidate guards shared by style-recommend (Deno) and the web client (Vite/Vitest).
// Pure functions, no runtime imports.

/** 이보다 싼 상품은 추천·대체 후보·광고에서 뺀다 (데이터 오류·사은품·1원 상품 방지). */
export const MIN_PRODUCT_PRICE = 1000;

export function isBelowMinPrice(price: number | string | null | undefined): boolean {
  const n = Number(price);
  return !Number.isFinite(n) || n < MIN_PRODUCT_PRICE;
}

// ---- 카테고리와 이름이 다른 부위인 상품 ----
// 신발 / 가방·모자·양말 등 액세서리 / 의류 세 묶음 사이에서 명확히 충돌할 때만 오분류로 본다.
// (상의·아우터 사이처럼 흔히 섞이는 경계는 건드리지 않는다.)
export type PartGroup = 'shoes' | 'acc' | 'clothing';

const GROUP_PATTERNS: Array<{ group: PartGroup; re: RegExp }> = [
  { group: 'shoes', re: /신발|스니커즈|운동화|샌들|슬리퍼|로퍼|구두|부츠(?!\s*컷)|슈즈|펌프스|sneakers?|\bshoes?\b|\bboots?\b(?!\s*cut)|sandals?|loafers?/i },
  { group: 'acc', re: /가방|백팩|크로스\s*백|토트\s*백|숄더\s*백|메신저\s*백|보스턴\s*백|에코\s*백|힙\s*색|클러치|파우치|양말|삭스|모자|볼캡|비니|버킷\s*햇|벨트|목도리|머플러|\bbags?\b|backpack|\btote\b|clutch|\bsocks?\b|\bhat\b|beanie/i },
  { group: 'clothing', re: /티셔츠|셔츠|블라우스|니트|맨투맨|후드티|스웨터|폴로|팬츠|바지|청바지|슬랙스|스커트|치마|레깅스|반바지|원피스|드레스|자켓|재킷|코트|점퍼|패딩|가디건|블레이저|t-?shirt|\bshirts?\b|blouse|sweater|hoodie|\bpants\b|jeans|skirt|dress|jacket|\bcoat\b|cardigan/i },
];

/** 이름에서 읽히는 부위 묶음들. 읽히는 게 없으면 빈 집합. */
export function groupsFromText(text: string | null | undefined): Set<PartGroup> {
  const found = new Set<PartGroup>();
  if (!text) return found;
  for (const { group, re } of GROUP_PATTERNS) if (re.test(text)) found.add(group);
  return found;
}

/** DB 카테고리/서브카테고리 값에서 읽히는 부위 묶음. 모호하면 null ('여성', '키즈' 등). */
export function groupFromCategory(category: string | null | undefined, subCategory?: string | null): PartGroup | null {
  for (const raw of [category, subCategory]) {
    const c = (raw || '').trim().toLowerCase();
    if (!c) continue;
    if (/신발|슈즈|shoe|footwear|스니커|부츠|샌들|로퍼|구두/.test(c)) return 'shoes';
    if (/가방|bag|모자|hat|cap|양말|악세|액세|accessor|벨트|잡화/.test(c)) return 'acc';
    if (/상의|하의|아우터|원피스|top|bottom|outer|dress|니트|셔츠|팬츠|스커트|자켓|코트/.test(c)) return 'clothing';
  }
  return null;
}

/** 카테고리와 이름이 서로 다른 묶음이면 true (예: category '신발' 인데 이름은 가방). */
export function isCategoryNameMismatch(p: { name?: string | null; category?: string | null; sub_category?: string | null }): boolean {
  const catGroup = groupFromCategory(p.category, p.sub_category);
  if (!catGroup) return false;
  const nameGroups = groupsFromText(p.name);
  if (nameGroups.size === 0) return false;
  return !nameGroups.has(catGroup);
}

/** 후보로 쓸 수 있는 상품인가: 가격 하한 + 오분류 제외. */
export function isUsableCandidate(p: { name?: string | null; category?: string | null; sub_category?: string | null; price?: number | string | null }): boolean {
  return !isBelowMinPrice(p.price) && !isCategoryNameMismatch(p);
}

// ---- 스타일 태그 표시 ----
/** '여성>상의>니트' 같은 카테고리 경로형 태그는 화면에 보이지 않는다. */
export function isCategoryPathTag(tag: string | null | undefined): boolean {
  return !tag || tag.includes('>');
}

export function visibleStyleTags(tags: Array<string | null | undefined> | null | undefined): string[] {
  return (tags || []).filter((t): t is string => !isCategoryPathTag(t) && t!.trim().length > 0);
}
