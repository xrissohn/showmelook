// Product color rules for generate-style (Deno) and unit tests (Vitest). No runtime imports.

// 키워드 → 영어 색 이름. 영문 키워드는 단어 경계로, 한글 키워드는 부분 문자열로 찾는다.
// 오탐이 큰 한 글자 키워드는 뺐다: '백'(백팩·가방), '탄'(탄탄한), 'tan' 은 단어 경계로만(standard).
const COLOR_KEYWORDS: Record<string, string> = {
  white: 'white', '화이트': 'white', '흰': 'white', wht: 'white',
  black: 'black', '블랙': 'black', '검정': 'black', '검은': 'black', '흑색': 'black', blk: 'black',
  navy: 'navy', '네이비': 'navy',
  blue: 'blue', '블루': 'blue', '파랑': 'blue', '파란': 'blue',
  gray: 'gray', grey: 'gray', '그레이': 'gray', '회색': 'gray', '차콜': 'charcoal', charcoal: 'charcoal',
  beige: 'beige', '베이지': 'beige',
  brown: 'brown', '브라운': 'brown', '갈색': 'brown',
  cream: 'cream', '크림': 'cream', ivory: 'ivory', '아이보리': 'ivory',
  red: 'red', '레드': 'red', '빨강': 'red',
  pink: 'pink', '핑크': 'pink',
  green: 'green', '그린': 'green', '초록': 'green', olive: 'olive', '올리브': 'olive',
  yellow: 'yellow', '옐로우': 'yellow', '노랑': 'yellow',
  orange: 'orange', '오렌지': 'orange',
  purple: 'purple', '퍼플': 'purple', '보라': 'purple',
  khaki: 'khaki', '카키': 'khaki',
  camel: 'camel', '카멜': 'camel', '캐멀': 'camel',
  wine: 'wine', '와인': 'wine', burgundy: 'burgundy', '버건디': 'burgundy',
  wheat: 'wheat/tan', tan: 'tan',
  sand: 'sand', '샌드': 'sand',
  mint: 'mint', '민트': 'mint',
  lavender: 'lavender', '라벤더': 'lavender',
  coral: 'coral', '코랄': 'coral',
  denim: 'denim blue', '데님': 'denim blue',
  mocha: 'mocha brown', '모카': 'mocha brown',
  oatmeal: 'oatmeal', '오트밀': 'oatmeal',
  silver: 'silver', '실버': 'silver',
  gold: 'gold', '골드': 'gold',
};

// 색 단어처럼 보이지만 브랜드명인 것은 지우고 읽는다.
const BRAND_NOISE = /블랙\s*야크|black\s*yak|블랙\s*다이아몬드|black\s*diamond|화이트\s*마운틴|white\s*mountaineering|골드\s*윈|goldwin/gi;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ENTRIES = Object.entries(COLOR_KEYWORDS).map(([keyword, color]) => ({
  keyword,
  color,
  re: /^[a-z]+$/.test(keyword) ? new RegExp(`(?<![a-z])${escapeRe(keyword)}(?![a-z])`) : null,
}));

/** 문자열에서 색을 읽는다. 먼저 나온 색 순서로, 중복 없이. */
export function parseColorsFromString(str: string | null | undefined): string[] {
  if (!str) return [];
  const lower = String(str).toLowerCase().replace(BRAND_NOISE, ' ');
  const hits: Array<{ at: number; color: string }> = [];
  for (const { keyword, color, re } of ENTRIES) {
    const at = re ? lower.search(re) : lower.indexOf(keyword);
    if (at >= 0) hits.push({ at, color });
  }
  hits.sort((a, b) => a.at - b.at);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.color)) out.push(h.color);
  return out;
}

export interface ColorProduct {
  name?: string | null;
  color?: string | null;
  color_family?: string | string[] | null;
  dna_meta?: { color_family?: string | string[] | null } | null;
}

/** 아이템 색: dna_meta.color_family → color_family → color 필드 → 상품명 순. 4색 이상이면 이미지 참조로 넘긴다. */
export function resolveItemColors(p: ColorProduct): string[] {
  const clean = (v: string | string[] | null | undefined) =>
    (Array.isArray(v) ? v : v ? [v] : []).filter((c) => c && c !== 'unknown');
  let colors = clean(p.dna_meta?.color_family);
  if (colors.length === 0) colors = clean(p.color_family);
  if (colors.length === 0 && p.color) colors = parseColorsFromString(String(p.color));
  if (colors.length === 0) colors = parseColorsFromString(p.name);
  return colors.length > 3 ? [] : colors;
}

// 모델이 자주 바꿔 그리는 색 → 그리면 안 되는 색
const CONFUSED_WITH: Record<string, string> = {
  black: 'brown, dark gray or charcoal',
  white: 'cream, ivory or light gray',
  navy: 'black or bright blue',
  beige: 'white, brown or camel',
  brown: 'black, beige or camel',
  gray: 'beige, blue or black',
  cream: 'pure white or beige',
  ivory: 'pure white or beige',
  khaki: 'olive green, beige or brown',
};

/** 아이템 하나의 색 지시문. 색을 모르면 상품 이미지를 기준으로 하라고 한다. */
export function colorConstraint(colors: string[], imageNo: number): string {
  if (colors.length === 0) return `match the EXACT color from product image #${imageNo}`;
  if (colors.length === 1) {
    const confused = CONFUSED_WITH[colors[0]];
    return `EXACT COLOR: ${colors[0]} ONLY${confused ? ` - do NOT render it as ${confused}` : ''}`;
  }
  return `MUST be ${colors.join(' or ')} color ONLY`;
}

/** 프롬프트 끝에 붙는 아이템별 색 요약: 코디 조화·조명 때문에 색을 바꾸지 말라는 못박기. */
export function buildColorLock(items: Array<{ name: string; colors: string[] }>): string {
  if (items.length === 0) return '';
  const lines = items.map((it, i) =>
    `#${i + 1} ${it.name} = ${it.colors.length > 0 ? it.colors.join(' or ') : `exact color of product image #${i + 1}`}`,
  );
  return `COLOR LOCK - never change an item's color for outfit harmony, lighting or styling:\n${lines.join('\n')}`;
}
