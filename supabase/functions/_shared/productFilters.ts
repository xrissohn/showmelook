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

// ---- 요청 문장이 말하는 '찾는 옷의 성별' ----
// 사용자가 원하는 룩이 항상 우선이다. 프로필 성별이나 화면에서 고른 성별과 달라도
// 요청 문장이 남성복/여성복/젠더리스를 말하면 그쪽으로 추천한다 (그게 그 사람의 취향).
export type RequestedGender = 'male' | 'female' | 'unisex';

const F = '(?:여성|여자|우먼|숙녀)';
const M = '(?:남성|남자)';
const CLOTH = '(?:복|옷|의류|용|패션|스타일|코디|룩|셔츠|티셔츠|상의|하의|바지|팬츠|자켓|재킷|코트|니트|신발|슈즈|가방|정장|수트|슈트|트렌치|점퍼|패딩|속옷|잠옷|수영복)';
const wearing = (g: string) => new RegExp(`${g}\\s*(?:이|가|들이|들)?\\s*입(?:는|을|어|고|힐)`);

// 1순위: 명시적 표현 ("남성복", "여자 옷", "여성용", "남자가 입을", "여장", "men's")
const EXPLICIT_FEMALE: RegExp[] = [
  new RegExp(`${F}\\s*${CLOTH}`), wearing(F), /여장/,
  /\b(?:women'?s|womens|womenswear|ladies|for women|female)\b/i,
];
const EXPLICIT_MALE: RegExp[] = [
  new RegExp(`${M}\\s*${CLOTH}`), wearing(M), /남장/, /맨즈/,
  /\b(?:men'?s|mens|menswear|for men|male)\b/i,
];
// 2순위: 여성 전용으로 쓰이는 품목 ("남자인데 원피스 입고 싶어" → 여성복)
const ITEM_FEMALE: RegExp[] = [/원피스/, /치마/, /스커트/, /블라우스/, /드레스(?!\s*셔츠)/, /하이힐/, /펌프스/, /\b(?:skirts?|blouses?|high heels|gown)\b/i];
// 3순위: 선물 받는 사람 ("남자친구한테 줄 선물" → 남성복). '여자친구랑 커플룩'처럼 함께 입는 경우는 보지 않는다.
const TO = '(?:선물|한테|에게|께|줄\\s|줄$|입힐|드릴)';
const RECIPIENT_MALE = new RegExp(`(?:남자친구|남친|남편|아빠|아버지|아들|남동생|오빠|할아버지|삼촌)\\s*${TO}`);
const RECIPIENT_FEMALE = new RegExp(`(?:여자친구|여친|아내|와이프|엄마|어머니|딸|여동생|언니|누나|할머니|이모|고모)\\s*${TO}`);

const UNISEX_RE = /(?:젠더\s*리스|젠더\s*뉴트럴|유니섹스|남녀\s*공용|남녀\s*모두|성\s*중립|중성적|앤드로지너스|androgynous|genderless|gender-neutral|unisex)/i;

const hit = (res: RegExp[], text: string) => res.some((re) => re.test(text));

/**
 * 요청 문장에서 찾는 옷의 성별을 읽는다. 아무 말도 없으면 null (화면에서 고른 성별을 쓴다).
 * 둘 다 말하면(남성복·여성복 모두) 'unisex'.
 */
export function detectRequestedClothingGender(text: string | null | undefined): RequestedGender | null {
  if (!text) return null;
  const t = String(text).normalize('NFKC');
  const pick = (female: boolean, male: boolean): RequestedGender | null => (female && male ? 'unisex' : female ? 'female' : male ? 'male' : null);

  const explicit = pick(hit(EXPLICIT_FEMALE, t), hit(EXPLICIT_MALE, t));
  if (explicit) return explicit;
  if (UNISEX_RE.test(t)) return 'unisex';
  const item = pick(hit(ITEM_FEMALE, t), false);
  if (item) return item;
  return pick(RECIPIENT_FEMALE.test(t), RECIPIENT_MALE.test(t));
}

/** 요청 문장 > 화면에서 고른 성별. 아동 모드는 요청 문장으로 바꾸지 않는다. */
export function resolveClothingGender(
  requestText: string | null | undefined,
  selected: string | null | undefined,
): { gender: string | null | undefined; fromRequest: boolean } {
  if ((selected ?? '').toLowerCase() === 'kids' || selected === '키즈') return { gender: selected, fromRequest: false };
  const requested = detectRequestedClothingGender(requestText);
  return requested ? { gender: requested, fromRequest: true } : { gender: selected, fromRequest: false };
}
