import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// EdgeRuntime 타입 선언 (Supabase Edge Functions에서 제공)
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
} | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sub_category: string | null;
  price: number;
  style_tags: string[] | null;
  gender: string | null;
  color: string | null;
}

interface DNAMeta {
  target: 'female' | 'male' | 'kids' | 'unisex';
  item_slot: 'top' | 'bottom' | 'outer' | 'shoes' | 'bag' | 'accessory' | 'dress';
  concepts: string[];
  formality: number;
  pair_slots: string[];
  occasions: string[];
  color_family: string; // Standard colors: black, white, navy, beige, cream, gray, brown, blue, pink, green, red, etc.
  season_fit: string[];
}

interface DNAResult {
  id: string;
  dna_text: string;
  dna_meta: DNAMeta;
  category?: string;
  sub_category?: string;
}

// 상품명에서 카테고리 추론
function inferCategory(name: string, currentCategory: string): { category: string; subCategory: string } {
  const nameLower = name.toLowerCase();
  const nameKr = name;
  
  const topKeywords = ['니트', '스웨터', '셔츠', '블라우스', '티셔츠', 't-shirt', 'tee', 'shirt', 'sweater', 'knit', 'top', '탑', '카디건', 'cardigan', '후드', 'hoodie', '맨투맨', 'sweatshirt', '폴로', 'polo', '베스트', 'vest', '조끼'];
  const bottomKeywords = ['팬츠', '바지', 'pants', 'trousers', 'jeans', '진', '청바지', '슬랙스', 'slacks', '쇼츠', 'shorts', '반바지', '스커트', 'skirt', '치마', '레깅스', 'leggings'];
  const outerKeywords = ['코트', 'coat', '재킷', 'jacket', '점퍼', 'jumper', '블레이저', 'blazer', '패딩', 'puffer', '다운', 'down', '파카', 'parka', '트렌치', 'trench', '후리스', 'fleece', '무스탕', '야상'];
  const shoeKeywords = ['신발', 'shoes', '스니커즈', 'sneakers', '부츠', 'boots', '로퍼', 'loafers', '샌들', 'sandals', '슬리퍼', 'slippers', '펌프스', 'pumps', '힐', 'heels', '플랫', 'flats', '더비', 'derby', '옥스포드', 'oxford', '슈즈'];
  const bagKeywords = ['가방', 'bag', '백', '토트', 'tote', '크로스백', 'crossbody', '숄더백', 'shoulder', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch'];
  const accessoryKeywords = ['액세서리', 'accessory', '목걸이', 'necklace', '귀걸이', 'earring', '반지', 'ring', '팔찌', 'bracelet', '시계', 'watch', '모자', 'hat', '캡', 'cap', '스카프', 'scarf', '벨트', 'belt', '선글라스', 'sunglasses', '안경', '머플러', 'muffler'];
  const dressKeywords = ['원피스', 'dress', '드레스', '점프수트', 'jumpsuit', '롬퍼', 'romper'];
  
  const checkKeywords = (keywords: string[]) => {
    return keywords.some(kw => nameLower.includes(kw) || nameKr.includes(kw));
  };
  
  let category = currentCategory;
  let subCategory = '';
  
  if (checkKeywords(topKeywords)) {
    category = '상의';
    if (nameLower.includes('니트') || nameLower.includes('sweater') || nameLower.includes('knit')) subCategory = '니트/스웨터';
    else if (nameLower.includes('셔츠') || nameLower.includes('shirt')) subCategory = '셔츠';
    else if (nameLower.includes('티셔츠') || nameLower.includes('t-shirt') || nameLower.includes('tee')) subCategory = '티셔츠';
    else if (nameLower.includes('카디건') || nameLower.includes('cardigan')) subCategory = '카디건';
    else if (nameLower.includes('후드') || nameLower.includes('hoodie') || nameLower.includes('맨투맨') || nameLower.includes('sweatshirt')) subCategory = '맨투맨/후디';
    else subCategory = '기타 상의';
  } else if (checkKeywords(dressKeywords)) {
    category = '원피스';
    subCategory = nameLower.includes('점프수트') || nameLower.includes('jumpsuit') ? '점프수트' : '원피스';
  } else if (checkKeywords(bottomKeywords)) {
    category = '하의';
    if (nameLower.includes('진') || nameLower.includes('jeans') || nameLower.includes('데님') || nameLower.includes('denim')) subCategory = '청바지';
    else if (nameLower.includes('슬랙스') || nameLower.includes('slacks')) subCategory = '슬랙스';
    else if (nameLower.includes('쇼츠') || nameLower.includes('shorts') || nameLower.includes('반바지')) subCategory = '반바지';
    else if (nameLower.includes('스커트') || nameLower.includes('skirt') || nameLower.includes('치마')) subCategory = '스커트';
    else subCategory = '기타 하의';
  } else if (checkKeywords(outerKeywords)) {
    category = '아우터';
    if (nameLower.includes('코트') || nameLower.includes('coat')) subCategory = '코트';
    else if (nameLower.includes('재킷') || nameLower.includes('jacket') || nameLower.includes('블레이저') || nameLower.includes('blazer')) subCategory = '재킷/블레이저';
    else if (nameLower.includes('패딩') || nameLower.includes('puffer') || nameLower.includes('다운') || nameLower.includes('down')) subCategory = '패딩';
    else subCategory = '기타 아우터';
  } else if (checkKeywords(shoeKeywords)) {
    category = '신발';
    if (nameLower.includes('스니커즈') || nameLower.includes('sneakers')) subCategory = '스니커즈';
    else if (nameLower.includes('부츠') || nameLower.includes('boots')) subCategory = '부츠';
    else if (nameLower.includes('로퍼') || nameLower.includes('loafers')) subCategory = '로퍼';
    else subCategory = '기타 신발';
  } else if (checkKeywords(bagKeywords)) {
    category = '가방';
    subCategory = '가방';
  } else if (checkKeywords(accessoryKeywords)) {
    category = '액세서리';
    subCategory = '액세서리';
  }
  
  return { category, subCategory };
}

// 카테고리를 item_slot으로 변환
function categoryToItemSlot(category: string, subCategory: string | null): DNAMeta['item_slot'] {
  const cat = category.toLowerCase();
  const sub = (subCategory || '').toLowerCase();
  const combined = `${cat} ${sub}`;
  
  if (['상의', 'top', '셔츠', '니트', '블라우스', '티셔츠'].some(k => combined.includes(k))) return 'top';
  if (['하의', 'bottom', '팬츠', '바지', '스커트', '청바지', '슬랙스'].some(k => combined.includes(k))) return 'bottom';
  if (['아우터', 'outer', '재킷', '코트', '점퍼', '패딩', '자켓'].some(k => combined.includes(k))) return 'outer';
  if (['원피스', 'dress', '드레스'].some(k => combined.includes(k))) return 'dress';
  if (['신발', 'shoes', '스니커즈', '부츠', '로퍼', '샌들', '힐'].some(k => combined.includes(k))) return 'shoes';
  if (['가방', 'bag', '백', '토트', '클러치'].some(k => combined.includes(k))) return 'bag';
  if (['액세서리', 'accessory', '목걸이', '귀걸이', '반지', '팔찌', '시계', '모자', '스카프', '벨트', '머플러'].some(k => combined.includes(k))) return 'accessory';
  
  return 'accessory';
}

// 성별 정규화 - 표준 4값: female, male, kids, unisex
function normalizeTarget(gender: string | null, name: string): DNAMeta['target'] {
  const nameLower = name.toLowerCase();
  const genderLower = (gender || '').toLowerCase();
  
  // 키즈 감지
  const kidsKeywords = ['키즈', 'kids', 'children', '아동', '유아', '주니어', 'junior', 'baby', '베이비', 'boy', 'girl', '남아', '여아'];
  const isKids = kidsKeywords.some(k => nameLower.includes(k) || genderLower.includes(k));
  if (isKids) return 'kids';
  
  // 여성 감지
  if (['여성', 'women', 'woman', 'female', 'ladies', 'lady'].some(k => genderLower.includes(k))) return 'female';
  if (['여성', 'women', 'woman', 'ladies'].some(k => nameLower.includes(k))) return 'female';
  
  // 남성 감지
  if (['남성', 'men', 'man', 'male', 'gentleman'].some(k => genderLower.includes(k))) return 'male';
  if (['남성', 'men', 'man', 'gentleman'].some(k => nameLower.includes(k))) return 'male';
  
  // Unisex
  if (['unisex', '유니섹스', '공용'].some(k => genderLower.includes(k))) return 'unisex';
  
  return 'unisex';
}

// 색상 파싱 유틸리티 - 배열/문자열 처리
function parseColorField(color: string | null): string {
  if (!color) return '';
  const trimmed = color.trim();
  
  // JSON 배열 형태 처리: ["베이지", "화이트"]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0].toString().toLowerCase();
      }
    } catch {
      // 파싱 실패시 원본 사용
    }
  }
  
  return trimmed.toLowerCase();
}

// 색상 패밀리 추론 - 표준 색상으로 정규화
function inferColorFamily(color: string | null, name: string): string {
  // 한글 → 영문 색상 매핑
  const COLOR_MAP: Record<string, string> = {
    // 블랙/화이트/그레이
    '블랙': 'black', '검정': 'black', '검은': 'black', 'black': 'black',
    '화이트': 'white', '흰색': 'white', '흰': 'white', 'white': 'white',
    '그레이': 'gray', '회색': 'gray', '그레': 'gray', 'gray': 'gray', 'grey': 'gray', '차콜': 'gray', 'charcoal': 'gray',
    
    // 베이지/크림/아이보리
    '베이지': 'beige', 'beige': 'beige',
    '아이보리': 'cream', '크림': 'cream', 'ivory': 'cream', 'cream': 'cream',
    
    // 네이비/블루
    '네이비': 'navy', 'navy': 'navy',
    '블루': 'blue', '파랑': 'blue', '파란': 'blue', 'blue': 'blue',
    '하늘': 'sky', '스카이': 'sky', 'sky': 'sky',
    '인디고': 'indigo', 'indigo': 'indigo',
    
    // 브라운/카멜/탄
    '브라운': 'brown', '갈색': 'brown', 'brown': 'brown',
    '카멜': 'camel', 'camel': 'camel',
    '탄': 'tan', 'tan': 'tan',
    '카키': 'olive', '올리브': 'olive', 'khaki': 'olive', 'olive': 'olive',
    
    // 레드/핑크
    '레드': 'red', '빨강': 'red', '빨간': 'red', 'red': 'red',
    '버건디': 'burgundy', '와인': 'burgundy', 'burgundy': 'burgundy', 'wine': 'burgundy',
    '핑크': 'pink', '분홍': 'pink', 'pink': 'pink', '코랄': 'coral', 'coral': 'coral',
    
    // 그린
    '그린': 'green', '녹색': 'green', '초록': 'green', 'green': 'green',
    '민트': 'mint', 'mint': 'mint',
    
    // 옐로우/오렌지
    '옐로우': 'yellow', '노랑': 'yellow', '노란': 'yellow', 'yellow': 'yellow',
    '오렌지': 'orange', '주황': 'orange', 'orange': 'orange',
    '머스타드': 'mustard', 'mustard': 'mustard',
    
    // 퍼플
    '퍼플': 'purple', '보라': 'purple', 'purple': 'purple',
    '라벤더': 'lavender', 'lavender': 'lavender',
    
    // 멀티
    '멀티': 'multi', '믹스': 'multi', 'multi': 'multi', 'mixed': 'multi',
  };
  
  // 1. color 필드에서 추출
  const colorStr = parseColorField(color);
  for (const [keyword, standardColor] of Object.entries(COLOR_MAP)) {
    if (colorStr.includes(keyword)) {
      return standardColor;
    }
  }
  
  // 2. 상품명에서 추출
  const nameLower = name.toLowerCase();
  for (const [keyword, standardColor] of Object.entries(COLOR_MAP)) {
    if (nameLower.includes(keyword)) {
      return standardColor;
    }
  }
  
  // 3. 추출 실패시 unknown 반환 (나중에 수동 보완 가능)
  return 'unknown';
}

// 시즌 추론
function inferSeasonFit(name: string, category: string): string[] {
  const combined = `${name} ${category}`.toLowerCase();
  
  const summerKeywords = ['반팔', '반바지', 'shorts', '샌들', 'sandal', '린넨', 'linen', '슬리퍼', 'sleeveless', '민소매', '크롭', 'crop'];
  const winterKeywords = ['패딩', 'padding', 'puffer', '코트', 'coat', '다운', 'down', '기모', '울', 'wool', '캐시미어', 'cashmere', '부츠', 'boots', '털', 'fur', '머플러', 'muffler', '장갑', 'gloves'];
  const springFallKeywords = ['가디건', 'cardigan', '트렌치', 'trench', '자켓', 'jacket', '니트', 'knit'];
  
  const seasons: string[] = [];
  
  if (summerKeywords.some(k => combined.includes(k))) {
    seasons.push('summer');
  }
  if (winterKeywords.some(k => combined.includes(k))) {
    seasons.push('winter');
  }
  if (springFallKeywords.some(k => combined.includes(k))) {
    seasons.push('spring', 'fall');
  }
  
  if (seasons.length === 0) {
    return ['spring', 'summer', 'fall', 'winter'];
  }
  
  return [...new Set(seasons)];
}

// 정제된 컨셉인지 확인 (카테고리 경로 등 제외)
function isValidConcept(concept: string): boolean {
  if (!concept || concept.length > 15) return false;
  if (concept.includes('>')) return false; // 카테고리 경로
  if (concept.includes('/')) return false;
  if (/^[가-힣]{1,6}$/.test(concept) || /^[a-z]{3,12}$/i.test(concept)) {
    return true;
  }
  return false;
}

// 컨셉 추론 (스타일 태그 + 가격대 + 브랜드) - 정제된 컨셉만 사용
function inferConcepts(product: Product, formality: number): string[] {
  const concepts: string[] = [];
  const nameLower = product.name.toLowerCase();
  
  // 스타일 태그에서 추출 (유효한 컨셉만 필터링)
  if (product.style_tags && product.style_tags.length > 0) {
    const validTags = product.style_tags
      .filter(tag => isValidConcept(tag))
      .slice(0, 3);
    concepts.push(...validTags);
  }
  
  // 이름에서 스타일 키워드 추출
  const styleMap: Record<string, string[]> = {
    '캐주얼': ['캐주얼', 'casual', '데일리', 'daily'],
    '미니멀': ['미니멀', 'minimal', '심플', 'simple', '베이직', 'basic'],
    '모던': ['모던', 'modern', '시크', 'chic'],
    '클래식': ['클래식', 'classic', '트래디셔널', 'traditional'],
    '스트릿': ['스트릿', 'street', '힙합', 'hiphop', '오버사이즈', 'oversize'],
    '스포티': ['스포티', 'sporty', '애슬레저', 'athleisure', '액티브', 'active'],
    '페미닌': ['페미닌', 'feminine', '러블리', 'lovely', '로맨틱', 'romantic'],
    '빈티지': ['빈티지', 'vintage', '레트로', 'retro'],
    '럭셔리': ['럭셔리', 'luxury', '프리미엄', 'premium', '하이엔드'],
  };
  
  for (const [style, keywords] of Object.entries(styleMap)) {
    if (keywords.some(k => nameLower.includes(k))) {
      if (!concepts.includes(style)) {
        concepts.push(style);
      }
    }
  }
  
  // 브랜드 기반 스타일 추론
  const brandLower = (product.brand || '').toLowerCase();
  if (['nike', 'adidas', 'puma', '나이키', '아디다스', '푸마', 'new balance'].some(b => brandLower.includes(b))) {
    if (!concepts.includes('스포티')) concepts.push('스포티');
  }
  if (['gucci', 'prada', 'louis vuitton', 'chanel', 'dior', '구찌', '프라다'].some(b => brandLower.includes(b))) {
    if (!concepts.includes('럭셔리')) concepts.push('럭셔리');
  }
  if (['uniqlo', '유니클로', 'zara', '자라', 'h&m'].some(b => brandLower.includes(b))) {
    if (!concepts.includes('베이직')) concepts.push('베이직');
  }
  
  // 포멀리티 기반 기본 컨셉 추가 (컨셉이 없을 때만)
  if (concepts.length === 0) {
    if (formality >= 7) {
      concepts.push('포멀', '클래식');
    } else if (formality >= 5) {
      concepts.push('모던', '미니멀');
    } else {
      concepts.push('캐주얼', '데일리');
    }
  }
  
  // 중복 제거 후 반환
  return [...new Set(concepts)].slice(0, 5);
}

// occasion 추론
function inferOccasions(formality: number, itemSlot: DNAMeta['item_slot'], concepts: string[]): string[] {
  const occasions: string[] = [];
  
  if (formality >= 7) {
    occasions.push('출근', '미팅', '비즈니스', '면접');
  } else if (formality >= 5) {
    occasions.push('데이트', '약속', '모임', '세미포멀');
  } else {
    occasions.push('데일리', '캐주얼', '주말', '여행');
  }
  
  // 컨셉 기반 추가
  if (concepts.includes('스포티') || concepts.includes('액티브')) {
    occasions.push('운동', '레저');
  }
  if (concepts.includes('로맨틱') || concepts.includes('페미닌')) {
    occasions.push('데이트', '파티');
  }
  
  return [...new Set(occasions)].slice(0, 5);
}

// item_slot에 따른 pair_slots 추론
function inferPairSlots(itemSlot: DNAMeta['item_slot'], formality: number): string[] {
  const pairs: string[] = [];
  
  switch (itemSlot) {
    case 'top':
      pairs.push('bottom_pants', 'bottom_skirt');
      if (formality >= 7) pairs.push('outer_blazer', 'shoes_loafer');
      else pairs.push('outer_jacket', 'shoes_sneakers');
      break;
    case 'bottom':
      pairs.push('top_shirt', 'top_tee');
      if (formality >= 7) pairs.push('shoes_loafer', 'shoes_heel');
      else pairs.push('shoes_sneakers');
      break;
    case 'outer':
      pairs.push('top_shirt', 'bottom_pants');
      break;
    case 'dress':
      pairs.push('outer_jacket', 'shoes_heel', 'bag_clutch', 'accessory_necklace');
      break;
    case 'shoes':
      pairs.push('bottom_pants', 'bottom_skirt');
      break;
    case 'bag':
      pairs.push('outer_coat', 'accessory_scarf');
      break;
    case 'accessory':
      pairs.push('top_shirt', 'outer_blazer');
      break;
  }
  
  return pairs;
}

// dna_meta에서 dna_text 자동 생성
function generateDNAText(product: Product, meta: DNAMeta, subCategory: string): string {
  const conceptsStr = meta.concepts.slice(0, 3).join(',');
  const brandInfo = product.brand || '데일리';
  const occasionStr = meta.occasions.slice(0, 2).join('/');
  
  // 포멀리티 레이블
  let formalityLabel = '캐주얼';
  if (meta.formality >= 8) formalityLabel = '포멀';
  else if (meta.formality >= 6) formalityLabel = '세미포멀';
  else if (meta.formality >= 4) formalityLabel = '스마트캐주얼';
  
  // 시즌 한글화
  const seasonMap: Record<string, string> = {
    'spring': '봄',
    'summer': '여름',
    'fall': '가을',
    'winter': '겨울'
  };
  const seasonStr = meta.season_fit.map(s => seasonMap[s] || s).join('/');
  
  // 코디팁 생성
  const pairTips: string[] = [];
  if (meta.pair_slots.includes('bottom_pants')) pairTips.push('팬츠');
  if (meta.pair_slots.includes('bottom_skirt')) pairTips.push('스커트');
  if (meta.pair_slots.includes('top_shirt')) pairTips.push('셔츠');
  if (meta.pair_slots.includes('outer_blazer')) pairTips.push('블레이저');
  if (meta.pair_slots.includes('shoes_sneakers')) pairTips.push('스니커즈');
  if (meta.pair_slots.includes('shoes_loafer')) pairTips.push('로퍼');
  
  const pairStr = pairTips.slice(0, 3).join(', ') || '다양한 아이템';
  
  return `[${conceptsStr}] | ${formalityLabel} ${subCategory || meta.item_slot} | ${brandInfo} | 추천: ${occasionStr} | 시즌: ${seasonStr} | 코디: ${pairStr}와 매치`;
}

// 복합 Formality 추론 (가격 + 카테고리 + 브랜드 + 키워드)
function inferFormality(product: Product, itemSlot: DNAMeta['item_slot']): number {
  let base = 5;
  
  // 1. 가격 기반 (기본)
  if (product.price > 500000) base = 8;
  else if (product.price > 300000) base = 7;
  else if (product.price > 150000) base = 6;
  else if (product.price > 80000) base = 5;
  else if (product.price < 30000) base = 3;
  else if (product.price < 50000) base = 4;
  
  // 2. 카테고리/아이템슬롯 보정 (-2 ~ +2)
  const casualSlots: DNAMeta['item_slot'][] = ['shoes', 'accessory'];
  const formalSlots: DNAMeta['item_slot'][] = ['dress', 'outer'];
  if (casualSlots.includes(itemSlot)) base -= 1;
  if (formalSlots.includes(itemSlot)) base += 1;
  
  // 3. 상품명 키워드 보정
  const nameLower = product.name.toLowerCase();
  const casualKeywords = ['스니커즈', 'sneakers', '운동화', '후드', 'hoodie', '맨투맨', '조거', 'jogger', '트레이닝', 'training', '반바지', 'shorts'];
  const formalKeywords = ['블레이저', 'blazer', '슬랙스', 'slacks', '정장', 'suit', '코트', 'coat', '캐시미어', 'cashmere', '울', 'wool', '실크', 'silk'];
  
  if (casualKeywords.some(k => nameLower.includes(k))) base -= 2;
  if (formalKeywords.some(k => nameLower.includes(k))) base += 2;
  
  // 4. 브랜드 보정
  const brandLower = (product.brand || '').toLowerCase();
  const casualBrands = ['nike', 'adidas', 'vans', 'converse', '나이키', '아디다스', 'puma', '푸마', 'new balance', 'fila'];
  const premiumBrands = ['gucci', 'prada', 'max mara', '구찌', '프라다', 'thom browne', 'burberry', 'louis vuitton', 'dior', 'chanel', 'hermes'];
  const contemporaryBrands = ['cos', 'acne', 'apc', 'theory', 'sandro', 'maje'];
  
  if (casualBrands.some(b => brandLower.includes(b))) base -= 1;
  if (premiumBrands.some(b => brandLower.includes(b))) base += 2;
  if (contemporaryBrands.some(b => brandLower.includes(b))) base += 1;
  
  // 5. 범위 제한 (1~10)
  return Math.max(1, Math.min(10, base));
}

// DNA 2.0 생성 (AI 없이 빠르게 처리)
function generateDNA(product: Product): DNAResult {
  const { category: inferredCategory, subCategory } = inferCategory(product.name, product.category);
  
  const target = normalizeTarget(product.gender, product.name);
  const itemSlot = categoryToItemSlot(inferredCategory, subCategory);
  const colorFamily = inferColorFamily(product.color, product.name);
  const seasonFit = inferSeasonFit(product.name, inferredCategory);
  
  // 복합 formality 추론 (가격 + 카테고리 + 브랜드 + 키워드)
  const formality = inferFormality(product, itemSlot);
  
  const concepts = inferConcepts(product, formality);
  const occasions = inferOccasions(formality, itemSlot, concepts);
  const pairSlots = inferPairSlots(itemSlot, formality);
  
  const dnaMeta: DNAMeta = {
    target,
    item_slot: itemSlot,
    concepts,
    formality,
    pair_slots: pairSlots,
    occasions,
    color_family: colorFamily,
    season_fit: seasonFit,
  };
  
  const dnaText = generateDNAText(product, dnaMeta, subCategory);
  
  return {
    id: product.id,
    dna_text: dnaText,
    dna_meta: dnaMeta,
    category: inferredCategory !== product.category ? inferredCategory : undefined,
    sub_category: subCategory || undefined,
  };
}

// 재귀 호출을 위한 함수
async function continueProcessing(supabaseUrl: string, supabaseKey: string, iteration: number, maxIterations: number) {
  if (iteration >= maxIterations) {
    console.log(`[dna-batch] 최대 반복 횟수(${maxIterations}) 도달, 다음 스케줄에서 계속`);
    return;
  }
  
  try {
    console.log(`[dna-batch] 백그라운드 배치 #${iteration + 1} 시작...`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 남은 상품 확인
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
      .eq('is_active', true)
      .is('dna_meta', null)
      .limit(100);
    
    if (fetchError) {
      console.error(`[dna-batch] 배치 #${iteration + 1} 조회 실패:`, fetchError);
      return;
    }
    
    if (!products || products.length === 0) {
      console.log(`[dna-batch] 모든 상품 DNA 생성 완료!`);
      return;
    }
    
    console.log(`[dna-batch] 배치 #${iteration + 1}: ${products.length}개 상품 처리 중...`);
    
    // DNA 생성 및 업데이트
    const startTime = Date.now();
    let updatedCount = 0;
    
    for (const product of products as Product[]) {
      try {
        const result = generateDNA(product);
        
        const updateData: Record<string, any> = {
          dna_text: result.dna_text,
          dna_meta: result.dna_meta,
          dna_generated_at: new Date().toISOString(),
        };
        
        if (result.category) updateData.category = result.category;
        if (result.sub_category) updateData.sub_category = result.sub_category;
        
        const { error: updateError } = await supabase
          .from('products_cache')
          .update(updateData)
          .eq('id', result.id);
        
        if (!updateError) updatedCount++;
      } catch (err) {
        console.error(`[dna-batch] 배치 #${iteration + 1} 상품 ${product.id} 에러:`, err);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[dna-batch] 배치 #${iteration + 1} 완료: ${updatedCount}개 업데이트, ${elapsed}ms`);
    
    // 남은 상품 확인
    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('dna_meta', null);
    
    if ((remainingCount || 0) > 0) {
      console.log(`[dna-batch] 남은 상품 ${remainingCount}개, 다음 배치 시작...`);
      // 약간의 딜레이 후 다음 배치
      await new Promise(resolve => setTimeout(resolve, 500));
      await continueProcessing(supabaseUrl, supabaseKey, iteration + 1, maxIterations);
    } else {
      console.log(`[dna-batch] 모든 상품 DNA 생성 완료!`);
    }
    
  } catch (err) {
    console.error(`[dna-batch] 배치 #${iteration + 1} 에러:`, err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 50, scheduled = false, maxIterations = 10, forceRegenerate = false, productIds = [] } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 배치 사이즈 제한 (AI 호출 없으므로 더 많이 처리 가능)
    const effectiveBatchSize = Math.min(batchSize, 200);
    
    console.log(`[dna-batch] DNA 2.0 생성 시작 (scheduled=${scheduled}, batchSize=${effectiveBatchSize}, force=${forceRegenerate})`);
    
    // 특정 productIds가 지정된 경우 (단일 상품 재생성)
    if (productIds && productIds.length > 0) {
      const { data: specificProducts, error: specificError } = await supabase
        .from('products_cache')
        .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
        .in('id', productIds);
      
      if (specificError) throw new Error(`Failed to fetch specific products: ${specificError.message}`);
      
      let updatedCount = 0;
      for (const product of specificProducts || []) {
        const dnaResult = generateDNA(product);
        await supabase.from('products_cache').update({
          dna_meta: dnaResult.dna_meta as unknown as Record<string, never>,
          dna_text: dnaResult.dna_text,
          dna_generated_at: new Date().toISOString(),
          ...(dnaResult.category && { category: dnaResult.category }),
          ...(dnaResult.sub_category && { sub_category: dnaResult.sub_category }),
        }).eq('id', product.id);
        updatedCount++;
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `${updatedCount}개 상품 DNA 재생성 완료`,
        updated: updatedCount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // forceRegenerate: dna_generated_at이 오래된 상품 또는 null인 상품 재생성
    if (forceRegenerate) {
      // 최근 1분 이내 업데이트된 상품은 제외 (중복 방지)
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const { data: allProducts, error: allError } = await supabase
        .from('products_cache')
        .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
        .eq('is_active', true)
        .or(`dna_generated_at.is.null,dna_generated_at.lt.${oneMinuteAgo}`)
        .order('dna_generated_at', { ascending: true, nullsFirst: true })
        .limit(effectiveBatchSize);
      
      if (allError) throw new Error(`Failed to fetch products: ${allError.message}`);
      
      if (!allProducts || allProducts.length === 0) {
        const { count: totalCount } = await supabase
          .from('products_cache')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        
        return new Response(JSON.stringify({
          success: true,
          message: '모든 상품 DNA 재생성 완료!',
          processed: 0,
          total: totalCount || 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      console.log(`[dna-batch] 강제 재생성 모드: ${allProducts.length}개 처리 중...`);
      
      let updatedCount = 0;
      const results: DNAResult[] = [];
      
      for (const product of allProducts) {
        try {
          const dnaResult = generateDNA(product);
          results.push(dnaResult);
          
          await supabase.from('products_cache').update({
            dna_meta: dnaResult.dna_meta as unknown as Record<string, never>,
            dna_text: dnaResult.dna_text,
            dna_generated_at: new Date().toISOString(),
            ...(dnaResult.category && { category: dnaResult.category }),
            ...(dnaResult.sub_category && { sub_category: dnaResult.sub_category }),
          }).eq('id', product.id);
          
          updatedCount++;
        } catch (err) {
          console.error(`[dna-batch] Product ${product.id} error:`, err);
        }
      }
      
      // 전체 통계
      const { count: totalCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      return new Response(JSON.stringify({
        success: true,
        message: `DNA 강제 재생성 완료`,
        processed: updatedCount,
        remaining: (totalCount || 0) - updatedCount,
        total: totalCount || 0,
        sample: results.slice(0, 3).map(r => ({ id: r.id, target: r.dna_meta.target, color: r.dna_meta.color_family, formality: r.dna_meta.formality })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // 기본 모드: dna_meta가 없는 상품만 조회
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
      .eq('is_active', true)
      .is('dna_meta', null)
      .limit(effectiveBatchSize);
    
    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }
    
    if (!products || products.length === 0) {
      // 남은 상품 수 확인
      const { count: totalCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      const { count: withMetaCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('dna_meta', 'is', null);
      
      console.log(`[dna-batch] 모든 상품에 DNA가 있습니다 (${withMetaCount}/${totalCount})`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'DNA 2.0 생성 완료 - 모든 상품에 dna_meta가 있습니다',
        processed: 0,
        remaining: 0,
        total: totalCount || 0,
        coverage: totalCount ? `${Math.round((withMetaCount || 0) / totalCount * 100)}%` : '100%',
        scheduled,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`[dna-batch] ${products.length}개 상품 DNA 2.0 생성 중...`);
    
    // 남은 상품 수 조회
    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('dna_meta', null);
    
    const errors: { id: string; error: string }[] = [];
    const results: DNAResult[] = [];
    
    // 동기적으로 빠르게 처리 (AI 호출 없음)
    const startTime = Date.now();
    
    for (const product of products as Product[]) {
      try {
        const result = generateDNA(product);
        results.push(result);
      } catch (err) {
        console.error(`[dna-batch] Error processing ${product.id}:`, err);
        errors.push({ id: product.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    
    const generateTime = Date.now() - startTime;
    console.log(`[dna-batch] DNA 생성 완료: ${results.length}개, ${generateTime}ms`);
    
    // 병렬 업데이트
    let updatedCount = 0;
    const updatePromises = results.map(async (result) => {
      const updateData: Record<string, any> = {
        dna_text: result.dna_text,
        dna_meta: result.dna_meta,
        dna_generated_at: new Date().toISOString(),
      };
      
      if (result.category) {
        updateData.category = result.category;
      }
      if (result.sub_category) {
        updateData.sub_category = result.sub_category;
      }
      
      const { error: updateError } = await supabase
        .from('products_cache')
        .update(updateData)
        .eq('id', result.id);
      
      if (!updateError) {
        return true;
      } else {
        console.error(`[dna-batch] Failed to update ${result.id}:`, updateError);
        errors.push({ id: result.id, error: updateError.message });
        return false;
      }
    });
    
    const updateResults = await Promise.all(updatePromises);
    updatedCount = updateResults.filter(Boolean).length;
    
    const totalTime = Date.now() - startTime;
    const remaining = Math.max(0, (remainingCount || 0) - products.length);
    
    // 스케줄된 호출이고 남은 상품이 있으면 백그라운드에서 계속 처리
    if (scheduled && remaining > 0) {
      console.log(`[dna-batch] 스케줄 모드: 남은 ${remaining}개 상품을 백그라운드에서 처리합니다`);
      
      // EdgeRuntime.waitUntil로 백그라운드 처리
      // @ts-ignore - EdgeRuntime은 Deno Deploy에서 제공
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(continueProcessing(supabaseUrl, supabaseKey, 1, maxIterations));
      } else {
        // EdgeRuntime이 없으면 직접 처리 (테스트 환경)
        console.log(`[dna-batch] EdgeRuntime 미지원, 동기 처리로 대체`);
      }
    }
    
    // 통계 계산
    const targetStats: Record<string, number> = {};
    const slotStats: Record<string, number> = {};
    const formalitySum = results.reduce((sum, r) => sum + r.dna_meta.formality, 0);
    
    for (const result of results) {
      targetStats[result.dna_meta.target] = (targetStats[result.dna_meta.target] || 0) + 1;
      slotStats[result.dna_meta.item_slot] = (slotStats[result.dna_meta.item_slot] || 0) + 1;
    }
    
    console.log(`[dna-batch] 완료: ${updatedCount}개 업데이트, ${errors.length}개 에러, ${remaining}개 남음, 총 ${totalTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      processed: products.length,
      updated: updatedCount,
      errors: errors.length,
      remaining,
      timeMs: totalTime,
      avgTimePerProduct: Math.round(totalTime / products.length),
      scheduled,
      backgroundProcessing: scheduled && remaining > 0,
      errorDetails: errors.slice(0, 5),
      sampleDNA: results.slice(0, 3).map(r => ({ 
        id: r.id, 
        name: (products as Product[]).find(p => p.id === r.id)?.name || 'Unknown',
        dna_text: r.dna_text,
        dna_meta: r.dna_meta,
      })),
      stats: {
        targetDistribution: targetStats,
        slotDistribution: slotStats,
        avgFormality: results.length > 0 ? (formalitySum / results.length).toFixed(1) : 0,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('[dna-batch] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
