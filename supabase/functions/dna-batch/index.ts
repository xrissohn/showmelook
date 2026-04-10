import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  item_slot: 'top' | 'bottom' | 'outer' | 'shoes' | 'bag' | 'accessory' | 'dress' | 'swimwear' | 'homewear';
  sub_style?: string;
  concepts: string[];
  formality: number;
  pair_slots: string[];
  occasions: string[];
  color_family: string[];
  season_fit: string[];
}

interface DNAResult {
  id: string;
  dna_text: string;
  dna_meta: DNAMeta;
  category?: string;
  sub_category?: string;
}

interface CustomClassification {
  config_type: string;
  item_slot: string | null;
  value: string;
  keywords: string[];
}

// ═══════════════════════════════════════════════════════════════
// 1. 카테고리 추론 (수영복/해변 패션 추가)
// ═══════════════════════════════════════════════════════════════
function inferCategory(name: string, currentCategory: string): { category: string; subCategory: string } {
  const nameLower = name.toLowerCase();
  const nameKr = name;

  // 수영복/해변 키워드 (최우선)
  const swimKeywords = ['수영복', '비키니', 'bikini', '래쉬가드', 'rash guard', 'rashguard', '워터레깅스', '서핑', 'surf', '수영', 'swim', '비치웨어', 'beachwear', '비치쇼츠', 'beach shorts', '비치드레스', '보드쇼츠', 'board shorts', '원피스수영복', '모노키니', 'monokini', '탱키니', 'tankini'];
  const homewearKeywords = ['잠옷', '파자마', 'pajama', 'pyjama', '수면', '홈웨어', 'homewear', 'loungewear', '라운지웨어', '실내복', '로브', 'robe'];

  const topKeywords = ['니트', '스웨터', '셔츠', '블라우스', '티셔츠', 't-shirt', 'tee', 'shirt', 'sweater', 'knit', 'top', '탑', '카디건', 'cardigan', '후드', 'hoodie', '맨투맨', 'sweatshirt', '폴로', 'polo', '베스트', 'vest', '조끼', '풀오버', 'pullover', '크루넥', '터틀넥'];
  const bottomKeywords = ['팬츠', '바지', 'pants', 'trousers', 'jeans', '진', '청바지', '슬랙스', 'slacks', '쇼츠', 'shorts', '반바지', '스커트', 'skirt', '치마', '레깅스', 'leggings'];
  const outerKeywords = ['코트', 'coat', '재킷', 'jacket', '점퍼', 'jumper', '블레이저', 'blazer', '패딩', 'puffer', '다운', 'down', '파카', 'parka', '트렌치', 'trench', '후리스', 'fleece', '무스탕', '야상', '아노락', 'anorak', '윈드브레이커', 'windbreaker', '봄버', 'bomber'];
  const shoeKeywords = ['신발', 'shoes', '스니커즈', 'sneakers', '부츠', 'boots', '로퍼', 'loafers', '샌들', 'sandals', '슬리퍼', 'slippers', '펌프스', 'pumps', '힐', 'heels', '플랫', 'flats', '더비', 'derby', '옥스포드', 'oxford', '슈즈', '아쿠아슈즈', '워터슈즈', '에스파드리유', 'espadrille', '뮬', 'mule', '웨지', 'wedge', '슬링백', 'slingback', '메리제인', 'mary jane', '트레이너', 'trainer'];
  const bagKeywords = ['가방', 'bag', '백', '토트', 'tote', '크로스백', 'crossbody', '숄더백', 'shoulder', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch', '버킷백', 'bucket', '호보', 'hobo', '메신저', 'messenger', '새들', 'saddle', '쇼퍼', 'shopper', '웨이스트', 'waist', '비치백'];
  const accessoryKeywords = ['액세서리', 'accessory', '목걸이', 'necklace', '귀걸이', 'earring', '반지', 'ring', '팔찌', 'bracelet', '시계', 'watch', '모자', 'hat', '캡', 'cap', '스카프', 'scarf', '벨트', 'belt', '선글라스', 'sunglasses', '안경', '머플러', 'muffler', '브로치', 'brooch', '넥타이', 'tie', '헤어밴드', 'headband', '바라클라바', 'balaclava', '넥워머', '이어머프'];
  const dressKeywords = ['원피스', 'dress', '드레스', '점프수트', 'jumpsuit', '롬퍼', 'romper'];

  const checkKeywords = (keywords: string[]) => keywords.some(kw => nameLower.includes(kw) || nameKr.includes(kw));

  let category = currentCategory;
  let subCategory = '';

  // 수영복/해변 최우선
  if (checkKeywords(swimKeywords)) {
    category = '수영복';
    if (nameLower.includes('래쉬가드') || nameLower.includes('rash')) subCategory = '래쉬가드';
    else if (nameLower.includes('비키니') || nameLower.includes('bikini')) subCategory = '비키니';
    else if (nameLower.includes('보드') || nameLower.includes('비치쇼츠') || nameLower.includes('beach short')) subCategory = '비치쇼츠';
    else subCategory = '수영복';
  } else if (checkKeywords(homewearKeywords)) {
    category = '홈웨어';
    subCategory = '홈웨어';
  } else if (checkKeywords(topKeywords)) {
    category = '상의';
    if (nameLower.includes('니트') || nameLower.includes('sweater') || nameLower.includes('knit')) subCategory = '니트/스웨터';
    else if (nameLower.includes('셔츠') || nameLower.includes('shirt')) subCategory = '셔츠';
    else if (nameLower.includes('티셔츠') || nameLower.includes('t-shirt') || nameLower.includes('tee')) subCategory = '티셔츠';
    else if (nameLower.includes('카디건') || nameLower.includes('cardigan')) subCategory = '카디건';
    else if (nameLower.includes('후드') || nameLower.includes('hoodie') || nameLower.includes('맨투맨') || nameLower.includes('sweatshirt')) subCategory = '맨투맨/후디';
    else if (nameLower.includes('블라우스') || nameLower.includes('blouse')) subCategory = '블라우스';
    else subCategory = '기타 상의';
  } else if (checkKeywords(dressKeywords)) {
    category = '원피스';
    if (nameLower.includes('점프수트') || nameLower.includes('jumpsuit')) subCategory = '점프수트';
    else if (nameLower.includes('롬퍼') || nameLower.includes('romper')) subCategory = '롬퍼';
    else subCategory = '원피스';
  } else if (checkKeywords(bottomKeywords)) {
    category = '하의';
    if (nameLower.includes('진') || nameLower.includes('jeans') || nameLower.includes('데님') || nameLower.includes('denim')) subCategory = '청바지';
    else if (nameLower.includes('슬랙스') || nameLower.includes('slacks')) subCategory = '슬랙스';
    else if (nameLower.includes('쇼츠') || nameLower.includes('shorts') || nameLower.includes('반바지')) subCategory = '반바지';
    else if (nameLower.includes('스커트') || nameLower.includes('skirt') || nameLower.includes('치마')) subCategory = '스커트';
    else if (nameLower.includes('레깅스') || nameLower.includes('leggings')) subCategory = '레깅스';
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
    else if (nameLower.includes('샌들') || nameLower.includes('sandal')) subCategory = '샌들';
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

// ═══════════════════════════════════════════════════════════════
// 2. 카테고리 → item_slot 변환 (수영복/홈웨어 추가)
// ═══════════════════════════════════════════════════════════════
function categoryToItemSlot(category: string, subCategory: string | null): DNAMeta['item_slot'] {
  const cat = category.toLowerCase();
  const sub = (subCategory || '').toLowerCase();
  const combined = `${cat} ${sub}`;

  if (['수영복', 'swimwear', '래쉬가드', '비키니'].some(k => combined.includes(k))) return 'swimwear';
  if (['홈웨어', 'homewear', '잠옷', '파자마', '수면', '라운지'].some(k => combined.includes(k))) return 'homewear';
  if (['상의', 'top', '셔츠', '니트', '블라우스', '티셔츠'].some(k => combined.includes(k))) return 'top';
  if (['하의', 'bottom', '팬츠', '바지', '스커트', '청바지', '슬랙스'].some(k => combined.includes(k))) return 'bottom';
  if (['아우터', 'outer', '재킷', '코트', '점퍼', '패딩', '자켓'].some(k => combined.includes(k))) return 'outer';
  if (['원피스', 'dress', '드레스'].some(k => combined.includes(k))) return 'dress';
  if (['신발', 'shoes', '스니커즈', '부츠', '로퍼', '샌들', '힐'].some(k => combined.includes(k))) return 'shoes';
  if (['가방', 'bag', '백', '토트', '클러치'].some(k => combined.includes(k))) return 'bag';
  if (['액세서리', 'accessory', '목걸이', '귀걸이', '반지', '팔찌', '시계', '모자', '스카프', '벨트', '머플러'].some(k => combined.includes(k))) return 'accessory';

  return 'accessory';
}

// ═══════════════════════════════════════════════════════════════
// 3. 성별 정규화
// ═══════════════════════════════════════════════════════════════
function normalizeTarget(gender: string | null, name: string): DNAMeta['target'] {
  const nameLower = name.toLowerCase();
  const genderLower = (gender || '').toLowerCase();

  const kidsKeywords = ['키즈', 'kids', 'children', '아동', '유아', '주니어', 'junior', 'baby', '베이비', 'boy', 'girl', '남아', '여아'];
  if (kidsKeywords.some(k => nameLower.includes(k) || genderLower.includes(k))) return 'kids';

  if (['여성', 'women', 'woman', 'female', 'ladies', 'lady'].some(k => genderLower.includes(k))) return 'female';
  if (['여성', 'women', 'woman', 'ladies'].some(k => nameLower.includes(k))) return 'female';

  if (['남성', 'men', 'man', 'male', 'gentleman'].some(k => genderLower.includes(k))) return 'male';
  if (['남성', 'men', 'man', 'gentleman'].some(k => nameLower.includes(k))) return 'male';

  if (['unisex', '유니섹스', '공용'].some(k => genderLower.includes(k) || nameLower.includes(k))) return 'unisex';

  return 'unisex';
}

// ═══════════════════════════════════════════════════════════════
// 4. 색상 파싱 및 추론 (대폭 확장)
// ═══════════════════════════════════════════════════════════════
function parseColorField(color: string | null): string[] {
  if (!color) return [];
  const trimmed = color.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(c => c.toString().toLowerCase());
    } catch { /* ignore */ }
  }
  if (trimmed.includes(',')) return trimmed.split(',').map(c => c.trim().toLowerCase()).filter(c => c);
  return [trimmed.toLowerCase()];
}

function inferColorFamily(color: string | null, name: string, customColors?: CustomClassification[]): string[] {
  const COLOR_MAP: Record<string, string> = {
    // 블랙/화이트/그레이
    '블랙': 'black', '검정': 'black', '검은': 'black', 'black': 'black', 'bk': 'black', 'blk': 'black',
    '화이트': 'white', '흰색': 'white', '흰': 'white', 'white': 'white', 'wh': 'white', 'wht': 'white',
    '그레이': 'gray', '회색': 'gray', '그레': 'gray', 'gray': 'gray', 'grey': 'gray', '차콜': 'charcoal', 'charcoal': 'charcoal',
    // 베이지/크림/아이보리/누드
    '베이지': 'beige', 'beige': 'beige',
    '아이보리': 'ivory', 'ivory': 'ivory',
    '크림': 'cream', 'cream': 'cream',
    '누드': 'nude', 'nude': 'nude',
    '샴페인': 'champagne', 'champagne': 'champagne',
    // 네이비/블루
    '네이비': 'navy', 'navy': 'navy',
    '블루': 'blue', '파랑': 'blue', '파란': 'blue', 'blue': 'blue',
    '하늘': 'sky blue', '스카이': 'sky blue', 'sky': 'sky blue',
    '인디고': 'indigo', 'indigo': 'indigo',
    '아쿠아': 'aqua', '턴쿼이즈': 'turquoise', 'turquoise': 'turquoise', 'aqua': 'aqua',
    // 브라운/카멜/탄
    '브라운': 'brown', '갈색': 'brown', 'brown': 'brown',
    '카멜': 'camel', 'camel': 'camel',
    '탄': 'tan', 'tan': 'tan',
    '모카': 'mocha', 'mocha': 'mocha',
    '카키': 'khaki', 'khaki': 'khaki',
    '올리브': 'olive', 'olive': 'olive',
    '테라코타': 'terracotta', 'terracotta': 'terracotta',
    // 레드/핑크
    '레드': 'red', '빨강': 'red', '빨간': 'red', 'red': 'red',
    '버건디': 'burgundy', '와인': 'burgundy', 'burgundy': 'burgundy', 'wine': 'burgundy',
    '핑크': 'pink', '분홍': 'pink', 'pink': 'pink',
    '코랄': 'coral', 'coral': 'coral',
    '피치': 'peach', 'peach': 'peach',
    '로즈': 'rose', 'rose': 'rose',
    '마젠타': 'magenta', 'magenta': 'magenta', '푸시아': 'fuchsia', 'fuchsia': 'fuchsia',
    // 그린
    '그린': 'green', '녹색': 'green', '초록': 'green', 'green': 'green',
    '민트': 'mint', 'mint': 'mint',
    '세이지': 'sage', 'sage': 'sage',
    '카키그린': 'khaki',
    // 옐로우/오렌지
    '옐로우': 'yellow', '노랑': 'yellow', '노란': 'yellow', 'yellow': 'yellow',
    '오렌지': 'orange', '주황': 'orange', 'orange': 'orange',
    '머스타드': 'mustard', 'mustard': 'mustard',
    // 퍼플
    '퍼플': 'purple', '보라': 'purple', 'purple': 'purple',
    '라벤더': 'lavender', 'lavender': 'lavender',
    '라일락': 'lilac', 'lilac': 'lilac',
    // 메탈릭
    '골드': 'gold', 'gold': 'gold',
    '실버': 'silver', 'silver': 'silver',
    '로즈골드': 'rose gold', 'rose gold': 'rose gold',
    // 패턴/멀티
    '멀티': 'multi', '믹스': 'multi', 'multi': 'multi', 'mixed': 'multi',
    '네온': 'neon', 'neon': 'neon',
    '파스텔': 'pastel', 'pastel': 'pastel',
  };

  const foundColors: string[] = [];
  const addedColors = new Set<string>();

  // 커스텀 색상 먼저 체크
  if (customColors) {
    const nameLower = name.toLowerCase();
    for (const cc of customColors) {
      if (cc.keywords.some(kw => nameLower.includes(kw.toLowerCase())) && !addedColors.has(cc.value)) {
        foundColors.push(cc.value);
        addedColors.add(cc.value);
      }
    }
  }

  const colorStrs = parseColorField(color);
  for (const colorStr of colorStrs) {
    for (const [keyword, standardColor] of Object.entries(COLOR_MAP)) {
      if (colorStr.includes(keyword) && !addedColors.has(standardColor)) {
        foundColors.push(standardColor);
        addedColors.add(standardColor);
      }
    }
  }

  if (foundColors.length < 2) {
    const nameLower = name.toLowerCase();
    for (const [keyword, standardColor] of Object.entries(COLOR_MAP)) {
      if (nameLower.includes(keyword) && !addedColors.has(standardColor)) {
        foundColors.push(standardColor);
        addedColors.add(standardColor);
      }
    }
  }

  return foundColors.length > 0 ? foundColors.slice(0, 5) : ['unknown'];
}

// ═══════════════════════════════════════════════════════════════
// 5. 시즌 추론 (대폭 확장 + 커스텀 지원)
// ═══════════════════════════════════════════════════════════════
function inferSeasonFit(name: string, category: string, itemSlot: DNAMeta['item_slot'], customSeasons?: CustomClassification[]): string[] {
  const combined = `${name} ${category}`.toLowerCase();

  // 커스텀 시즌 먼저 체크
  if (customSeasons) {
    for (const cs of customSeasons) {
      if (cs.keywords.some(kw => combined.includes(kw.toLowerCase()))) {
        // 커스텀 시즌 값 파싱 (예: "간절기" → spring,fall)
        const seasonMap: Record<string, string[]> = {
          '간절기': ['spring', 'fall'],
          '한여름': ['summer'],
          '초봄': ['spring'],
          '초가을': ['fall'],
          '환절기': ['spring', 'fall'],
          '사계절': ['spring', 'summer', 'fall', 'winter'],
        };
        const mapped = seasonMap[cs.value];
        if (mapped) return mapped;
        return [cs.value];
      }
    }
  }

  // 수영복/해변은 여름 고정
  if (itemSlot === 'swimwear') return ['summer'];

  const summerKeywords = ['반팔', '반바지', 'shorts', '샌들', 'sandal', '린넨', 'linen', '슬리퍼', 'sleeveless', '민소매', '크롭', 'crop', '비치', 'beach', '래쉬가드', '수영', '서핑', '탱크탑', 'tank', '플립플랍', 'flip flop', '에스파드리유', '슬라이드', '쿨링', '쿨', 'cool', '시어', 'sheer', '메쉬', 'mesh'];
  const winterKeywords = ['패딩', 'padding', 'puffer', '코트', 'coat', '다운', 'down', '기모', '울', 'wool', '캐시미어', 'cashmere', '부츠', 'boots', '털', 'fur', '머플러', 'muffler', '장갑', 'gloves', '방한', '무스탕', 'shearling', '바라클라바', '넥워머', '이어머프', '퍼', 'fur', '양모', '앙고라', 'angora', '플리스', 'fleece', '후리스', '두꺼운', '히트텍', '발열'];
  const springFallKeywords = ['가디건', 'cardigan', '트렌치', 'trench', '자켓', 'jacket', '니트', 'knit', '블레이저', 'blazer', '윈드브레이커', 'windbreaker', '아노락', '스웨터', 'sweater'];

  const seasons: string[] = [];
  if (summerKeywords.some(k => combined.includes(k))) seasons.push('summer');
  if (winterKeywords.some(k => combined.includes(k))) seasons.push('winter');
  if (springFallKeywords.some(k => combined.includes(k))) { seasons.push('spring'); seasons.push('fall'); }

  if (seasons.length === 0) return ['spring', 'summer', 'fall', 'winter'];
  return [...new Set(seasons)];
}

// ═══════════════════════════════════════════════════════════════
// 6. 컨셉 추론 (대폭 확장 + 커스텀 지원)
// ═══════════════════════════════════════════════════════════════
function isValidConcept(concept: string): boolean {
  if (!concept || concept.length > 15) return false;
  if (concept.includes('>') || concept.includes('/')) return false;
  if (/^[가-힣]{1,8}$/.test(concept) || /^[a-z]{3,15}$/i.test(concept)) return true;
  return false;
}

function inferConcepts(product: Product, formality: number, itemSlot: DNAMeta['item_slot'], customConcepts?: CustomClassification[]): string[] {
  const concepts: string[] = [];
  const nameLower = product.name.toLowerCase();

  // 커스텀 컨셉 먼저 체크
  if (customConcepts) {
    for (const cc of customConcepts) {
      if (cc.keywords.some(kw => nameLower.includes(kw.toLowerCase())) && !concepts.includes(cc.value)) {
        concepts.push(cc.value);
      }
    }
  }

  // 스타일 태그에서 추출
  if (product.style_tags && product.style_tags.length > 0) {
    const validTags = product.style_tags.filter(tag => isValidConcept(tag)).slice(0, 3);
    for (const t of validTags) { if (!concepts.includes(t)) concepts.push(t); }
  }

  // 대폭 확장된 스타일 키워드 매핑
  const styleMap: Record<string, string[]> = {
    '캐주얼': ['캐주얼', 'casual', '데일리', 'daily'],
    '미니멀': ['미니멀', 'minimal', '심플', 'simple', '베이직', 'basic', '무지'],
    '모던': ['모던', 'modern', '시크', 'chic', '컨템포러리'],
    '클래식': ['클래식', 'classic', '트래디셔널', 'traditional', '정통'],
    '스트릿': ['스트릿', 'street', '힙합', 'hiphop', '오버사이즈', 'oversize', '오버핏'],
    '스포티': ['스포티', 'sporty', '애슬레저', 'athleisure', '액티브', 'active', '트레이닝'],
    '페미닌': ['페미닌', 'feminine', '러블리', 'lovely', '로맨틱', 'romantic', '플라워', 'floral', '레이스', 'lace', '프릴', 'frill', '리본'],
    '빈티지': ['빈티지', 'vintage', '레트로', 'retro', '뉴트로'],
    '럭셔리': ['럭셔리', 'luxury', '프리미엄', 'premium', '하이엔드'],
    '올드머니': ['올드머니', 'old money', '헤리티지', 'heritage', '엘레강스'],
    '프레피': ['프레피', 'preppy', '아이비', 'ivy', '스쿨룩'],
    '보헤미안': ['보헤미안', 'bohemian', '보호', 'boho', '에스닉', 'ethnic', '히피'],
    '그런지': ['그런지', 'grunge', '디스트로이드', '찢어진', '워싱', 'washed', '데미지'],
    '놈코어': ['놈코어', 'normcore', '이지웨어'],
    '테크웨어': ['테크웨어', 'techwear', '고어텍스', 'gore-tex', '기능성', '유틸리티', 'utility', '택티컬', 'tactical'],
    'Y2K': ['y2k', '2000년대', '밀레니엄', '글리터', 'glitter'],
    '발레코어': ['발레', 'ballet', '발레코어', '튀튀', 'tutu'],
    '코지': ['코지', 'cozy', '포근', '아늑', '플러피', 'fluffy', '소프트'],
    '글램': ['글램', 'glam', '시퀸', 'sequin', '스팽글', '파티'],
    '워크웨어': ['워크웨어', 'workwear', '카하트', 'carhartt', '덕캔버스', '작업복'],
    '밀리터리': ['밀리터리', 'military', '카모', 'camo', '카무플라주', '아미'],
    '마린': ['마린', 'marine', '세일러', 'sailor', '스트라이프', 'stripe', '보더'],
    '리조트': ['리조트', 'resort', '바캉스', '하와이안', 'hawaiian', '트로피컬', 'tropical', '알로하'],
    '서프': ['서프', 'surf', '서핑', '비치', 'beach', '해변'],
    '고프코어': ['고프코어', 'gorpcore', '아웃도어', 'outdoor', '하이킹', 'hiking', '트레킹'],
    '다크아카데미아': ['다크아카데미아', 'dark academia', '아카데미'],
    '시티보이': ['시티보이', 'city boy', '어반', 'urban'],
    '내추럴': ['내추럴', 'natural', '오가닉', 'organic', '에코', 'eco'],
    '댄디': ['댄디', 'dandy', '젠틀맨', 'gentleman'],
    '아방가르드': ['아방가르드', 'avant-garde', '해체주의', 'deconstructed'],
    '노르딕': ['노르딕', 'nordic', '스칸디', 'scandinavian'],
    '파리지엔': ['파리', 'paris', '파리지엔', 'parisienne', '프렌치', 'french'],
  };

  for (const [style, keywords] of Object.entries(styleMap)) {
    if (keywords.some(k => nameLower.includes(k)) && !concepts.includes(style)) {
      concepts.push(style);
    }
  }

  // 브랜드 기반 컨셉 (확장)
  const brandLower = (product.brand || '').toLowerCase();
  const brandConceptMap: Record<string, string[]> = {
    '스포티': ['nike', 'adidas', 'puma', '나이키', '아디다스', '푸마', 'new balance', 'fila', 'reebok', 'under armour', 'mizuno', '미즈노', 'asics'],
    '럭셔리': ['gucci', 'prada', 'louis vuitton', 'chanel', 'dior', '구찌', '프라다', 'hermes', 'bottega', 'balenciaga', 'saint laurent', 'celine', 'loewe', 'valentino', 'fendi'],
    '컨템포러리': ['cos', 'acne', 'apc', 'theory', 'sandro', 'maje', 'isabel marant', 'jacquemus', 'ami', 'lemaire'],
    '베이직': ['uniqlo', '유니클로', 'zara', '자라', 'h&m', 'gap', '갭', 'muji', '무인양품'],
    '스트릿': ['stussy', '스투시', 'supreme', 'palace', 'off-white', 'fear of god', 'bape'],
    '올드머니': ['ralph lauren', '폴로', 'polo', 'lacoste', '라코스테', 'brooks brothers', 'tommy hilfiger', 'gant'],
    '고프코어': ['the north face', '노스페이스', 'patagonia', '파타고니아', 'arc\'teryx', 'columbia', '컬럼비아', 'salomon', 'hoka'],
    '워크웨어': ['carhartt', '칼하트', 'dickies', '디키즈'],
  };

  for (const [concept, brands] of Object.entries(brandConceptMap)) {
    if (brands.some(b => brandLower.includes(b)) && !concepts.includes(concept)) {
      concepts.push(concept);
    }
  }

  // 수영복/해변 슬롯이면 리조트/서프 추가
  if (itemSlot === 'swimwear') {
    if (!concepts.includes('리조트')) concepts.push('리조트');
    if (!concepts.includes('서프')) concepts.push('서프');
  }

  // 기본 컨셉 (없을 때)
  if (concepts.length === 0) {
    if (formality >= 7) concepts.push('포멀', '클래식');
    else if (formality >= 5) concepts.push('모던', '미니멀');
    else concepts.push('캐주얼', '데일리');
  }

  return [...new Set(concepts)].slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════
// 7. 착용 상황 추론 (대폭 확장 + 커스텀 지원)
// ═══════════════════════════════════════════════════════════════
function inferOccasions(product: Product, formality: number, itemSlot: DNAMeta['item_slot'], concepts: string[], customOccasions?: CustomClassification[]): string[] {
  const occasions: string[] = [];
  const nameLower = product.name.toLowerCase();

  // 커스텀 상황 먼저 체크
  if (customOccasions) {
    for (const co of customOccasions) {
      if (co.keywords.some(kw => nameLower.includes(kw.toLowerCase())) && !occasions.includes(co.value)) {
        occasions.push(co.value);
      }
    }
  }

  // 수영복/해변
  if (itemSlot === 'swimwear') {
    occasions.push('해변', '풀파티', '수영', '리조트', '바캉스');
    return [...new Set(occasions)].slice(0, 6);
  }

  // 홈웨어
  if (itemSlot === 'homewear') {
    occasions.push('홈', '수면', '실내', '휴식');
    return [...new Set(occasions)].slice(0, 6);
  }

  // 이름 기반 상황 감지
  const occasionKeywords: Record<string, string[]> = {
    '해변': ['비치', 'beach', '해변', '해수욕'],
    '캠핑': ['캠핑', 'camping', '글램핑'],
    '등산': ['등산', 'hiking', '하이킹', '트레킹', 'trekking', '산행'],
    '골프': ['골프', 'golf'],
    '요가': ['요가', 'yoga', '필라테스', 'pilates'],
    '러닝': ['러닝', 'running', '조깅', 'jogging', '마라톤'],
    '페스티벌': ['페스티벌', 'festival', '콘서트', 'concert'],
    '웨딩': ['웨딩', 'wedding', '하객', '결혼'],
    '면접': ['면접', 'interview', '취업'],
    '출장': ['출장', 'business trip'],
    '피크닉': ['피크닉', 'picnic', '소풍'],
    '브런치': ['브런치', 'brunch'],
    '카페': ['카페', 'cafe'],
    '학교': ['캠퍼스', 'campus', '학교', '스쿨'],
    '자전거': ['자전거', 'cycling', 'bike', '사이클'],
    '스키': ['스키', 'ski', '보드', 'snowboard', '스노우'],
    '크리스마스': ['크리스마스', 'christmas', 'xmas'],
    '여행': ['여행', 'travel', '트래블'],
  };

  for (const [occ, keywords] of Object.entries(occasionKeywords)) {
    if (keywords.some(k => nameLower.includes(k)) && !occasions.includes(occ)) {
      occasions.push(occ);
    }
  }

  // 포멀리티 기반
  if (formality >= 7) {
    if (!occasions.some(o => ['출근', '미팅', '비즈니스', '면접'].includes(o)))
      occasions.push('출근', '미팅', '비즈니스');
  } else if (formality >= 5) {
    if (!occasions.some(o => ['데이트', '약속', '모임'].includes(o)))
      occasions.push('데이트', '약속', '모임');
  } else {
    if (!occasions.some(o => ['데일리', '캐주얼', '주말'].includes(o)))
      occasions.push('데일리', '주말');
  }

  // 컨셉 기반 추가
  if (concepts.includes('스포티') || concepts.includes('애슬레저')) {
    if (!occasions.includes('운동')) occasions.push('운동');
    if (!occasions.includes('레저')) occasions.push('레저');
  }
  if (concepts.includes('페미닌') || concepts.includes('로맨틱') || concepts.includes('글램')) {
    if (!occasions.includes('데이트')) occasions.push('데이트');
    if (!occasions.includes('파티')) occasions.push('파티');
  }
  if (concepts.includes('리조트') || concepts.includes('서프')) {
    if (!occasions.includes('바캉스')) occasions.push('바캉스');
    if (!occasions.includes('여행')) occasions.push('여행');
  }
  if (concepts.includes('고프코어')) {
    if (!occasions.includes('캠핑')) occasions.push('캠핑');
    if (!occasions.includes('등산')) occasions.push('등산');
  }

  return [...new Set(occasions)].slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════
// 8. 세부 스타일 추출 (대폭 확장)
// ═══════════════════════════════════════════════════════════════
function inferSubStyle(name: string, itemSlot: DNAMeta['item_slot'], subCategory: string, customSubStyles?: CustomClassification[]): string {
  const lower = name.toLowerCase();

  // 커스텀 세부 스타일 먼저
  if (customSubStyles && customSubStyles.length > 0) {
    const slotCustoms = customSubStyles.filter(c => c.item_slot === itemSlot || !c.item_slot);
    for (const custom of slotCustoms) {
      if (custom.keywords.some(kw => lower.includes(kw.toLowerCase()))) return custom.value;
    }
  }

  // 수영복
  if (itemSlot === 'swimwear') {
    if (lower.includes('래쉬가드') || lower.includes('rash guard') || lower.includes('rashguard')) return '래쉬가드';
    if (lower.includes('비키니') || lower.includes('bikini')) return '비키니';
    if (lower.includes('탱키니') || lower.includes('tankini')) return '탱키니';
    if (lower.includes('모노키니') || lower.includes('monokini')) return '모노키니';
    if (lower.includes('원피스수영') || lower.includes('one-piece swim')) return '원피스수영복';
    if (lower.includes('비치쇼츠') || lower.includes('보드쇼츠') || lower.includes('board short') || lower.includes('beach short')) return '비치쇼츠';
    if (lower.includes('비치드레스') || lower.includes('커버업') || lower.includes('cover-up') || lower.includes('cover up')) return '커버업';
    if (lower.includes('수영복') || lower.includes('swim')) return '수영복';
    return '';
  }

  // 홈웨어
  if (itemSlot === 'homewear') {
    if (lower.includes('로브') || lower.includes('robe')) return '로브';
    if (lower.includes('수면') && lower.includes('세트')) return '수면세트';
    if (lower.includes('잠옷') || lower.includes('파자마') || lower.includes('pajama')) return '파자마';
    if (lower.includes('라운지') || lower.includes('lounge')) return '라운지웨어';
    return '홈웨어';
  }

  // 상의 (확장)
  if (itemSlot === 'top') {
    if ((lower.includes('후드') || lower.includes('hood')) && (lower.includes('집업') || lower.includes('zip'))) return '후드집업';
    if (lower.includes('후드') || lower.includes('hoodie') || lower.includes('후디')) return '후드티';
    if (lower.includes('맨투맨') || lower.includes('sweatshirt') || lower.includes('mtm') || lower.includes('크루넥')) return '맨투맨';
    if ((lower.includes('반') || lower.includes('하프')) && (lower.includes('집업') || lower.includes('zip'))) return '반집업';
    if (lower.includes('집업') || lower.includes('zip-up') || lower.includes('zipup') || lower.includes('zip up')) return '집업';
    if (lower.includes('폴로') || lower.includes('polo')) return '폴로셔츠';
    if (lower.includes('터틀넥') || lower.includes('폴라') || lower.includes('목폴라') || lower.includes('turtleneck') || lower.includes('하이넥') || lower.includes('high-neck') || lower.includes('high neck')) return '터틀넥';
    if (lower.includes('헨리넥') || lower.includes('henley')) return '헨리넥';
    if (lower.includes('오프숄더') || lower.includes('off-shoulder') || lower.includes('off shoulder')) return '오프숄더';
    if (lower.includes('홀터') || lower.includes('halter')) return '홀터넥';
    if (lower.includes('보트넥') || lower.includes('boat neck') || lower.includes('보트 넥')) return '보트넥';
    if (lower.includes('럭비') || lower.includes('rugby')) return '럭비셔츠';
    if (lower.includes('하와이안') || lower.includes('hawaiian') || lower.includes('알로하') || lower.includes('aloha')) return '하와이안셔츠';
    if (lower.includes('반팔') || lower.includes('short sleeve') || lower.includes('반소매')) return '반팔티';
    if (lower.includes('긴팔') || lower.includes('long sleeve') || lower.includes('롱슬리브') || lower.includes('긴소매')) return '긴팔티';
    if (lower.includes('크롭') || lower.includes('crop')) return '크롭탑';
    if (lower.includes('니트') || lower.includes('knit') || lower.includes('스웨터') || lower.includes('sweater')) return '니트';
    if (lower.includes('블라우스') || lower.includes('blouse')) return '블라우스';
    if (lower.includes('셔츠') || lower.includes('shirt')) return '셔츠';
    if (lower.includes('카디건') || lower.includes('cardigan') || lower.includes('가디건')) return '카디건';
    if (lower.includes('베스트') || lower.includes('vest') || lower.includes('조끼')) return '조끼';
    if (lower.includes('탱크') || lower.includes('민소매') || lower.includes('sleeveless') || lower.includes('나시') || lower.includes('끈나시')) return '민소매';
    if (lower.includes('브라탑') || lower.includes('bra top') || lower.includes('스포츠브라')) return '브라탑';
    return '';
  }

  // 하의 (확장)
  if (itemSlot === 'bottom') {
    if (lower.includes('와이드') || lower.includes('wide')) return '와이드팬츠';
    if (lower.includes('스트레이트') || lower.includes('straight')) return '스트레이트팬츠';
    if (lower.includes('스키니') || lower.includes('skinny') || lower.includes('슬림') || lower.includes('slim')) return '스키니팬츠';
    if (lower.includes('테이퍼드') || lower.includes('tapered')) return '테이퍼드팬츠';
    if (lower.includes('조거') || lower.includes('jogger')) return '조거팬츠';
    if (lower.includes('카고') || lower.includes('cargo')) return '카고팬츠';
    if (lower.includes('부츠컷') || lower.includes('bootcut') || lower.includes('플레어') || lower.includes('flare')) return '부츠컷/플레어';
    if (lower.includes('버뮤다') || lower.includes('bermuda')) return '버뮤다팬츠';
    if (lower.includes('큐롯') || lower.includes('culottes')) return '큐롯';
    if (lower.includes('팔라초') || lower.includes('palazzo')) return '팔라초팬츠';
    if (lower.includes('페이퍼백') || lower.includes('paperbag')) return '페이퍼백팬츠';
    if (lower.includes('하렘') || lower.includes('harem') || lower.includes('배기') || lower.includes('baggy')) return '배기팬츠';
    if (lower.includes('데님') || lower.includes('denim') || lower.includes('진') || lower.includes('jeans') || lower.includes('청바지')) return '청바지';
    if (lower.includes('슬랙스') || lower.includes('slacks') || lower.includes('정장') || lower.includes('dress pants') || lower.includes('트라우저') || lower.includes('trousers')) return '슬랙스';
    if (lower.includes('치마') || lower.includes('skirt') || lower.includes('스커트')) {
      if (lower.includes('미니')) return '미니스커트';
      if (lower.includes('맥시') || lower.includes('롱')) return '롱스커트';
      if (lower.includes('미디')) return '미디스커트';
      if (lower.includes('플리츠') || lower.includes('pleats')) return '플리츠스커트';
      if (lower.includes('a라인') || lower.includes('a-line') || lower.includes('에이라인')) return 'A라인스커트';
      if (lower.includes('랩') || lower.includes('wrap')) return '랩스커트';
      if (lower.includes('펜슬') || lower.includes('pencil')) return '펜슬스커트';
      if (lower.includes('트위드')) return '트위드스커트';
      return '스커트';
    }
    if (lower.includes('반바지') || lower.includes('shorts') || lower.includes('쇼츠')) return '반바지';
    if (lower.includes('레깅스') || lower.includes('leggings')) return '레깅스';
    if (lower.includes('코듀로이') || lower.includes('corduroy') || lower.includes('골덴')) return '코듀로이팬츠';
    if (lower.includes('치노') || lower.includes('chino')) return '치노팬츠';
    if (lower.includes('트레이닝') || lower.includes('training') || lower.includes('트랙') || lower.includes('track')) return '트레이닝팬츠';
    return '';
  }

  // 아우터 (확장)
  if (itemSlot === 'outer') {
    if ((lower.includes('후드') || lower.includes('hood')) && (lower.includes('집업') || lower.includes('zip'))) return '후드집업';
    if ((lower.includes('후드') || lower.includes('hood')) && (lower.includes('자켓') || lower.includes('jacket'))) return '후드자켓';
    if (lower.includes('블레이저') || lower.includes('blazer')) return '블레이저';
    if (lower.includes('트렌치') || lower.includes('trench')) return '트렌치코트';
    if (lower.includes('롱패딩') || lower.includes('롱 패딩')) return '롱패딩';
    if (lower.includes('숏패딩') || lower.includes('숏 패딩') || lower.includes('크롭패딩')) return '숏패딩';
    if (lower.includes('경량') && (lower.includes('패딩') || lower.includes('다운'))) return '경량패딩';
    if (lower.includes('패딩') || lower.includes('puffer') || lower.includes('퍼퍼')) return '패딩';
    if (lower.includes('구스') || lower.includes('다운') || lower.includes('down jacket')) return '다운재킷';
    if (lower.includes('무스탕') || lower.includes('shearling') || lower.includes('양모')) return '무스탕';
    if (lower.includes('야상') || lower.includes('field') || lower.includes('밀리터리')) return '야상';
    if (lower.includes('봄버') || lower.includes('bomber') || lower.includes('항공') || lower.includes('블루종') || lower.includes('blouson')) return '봄버자켓';
    if (lower.includes('바시티') || lower.includes('varsity') || lower.includes('레터맨')) return '바시티자켓';
    if (lower.includes('아노락') || lower.includes('anorak')) return '아노락';
    if (lower.includes('윈드브레이커') || lower.includes('windbreaker') || lower.includes('바람막이')) return '윈드브레이커';
    if (lower.includes('사파리') || lower.includes('safari')) return '사파리자켓';
    if (lower.includes('케이프') || lower.includes('cape') || lower.includes('판초') || lower.includes('poncho')) return '케이프';
    if (lower.includes('집업') || lower.includes('zip')) return '집업자켓';
    if (lower.includes('가디건') || lower.includes('카디건') || lower.includes('cardigan')) return '가디건';
    if (lower.includes('플리스') || lower.includes('fleece') || lower.includes('후리스')) return '플리스';
    if (lower.includes('데님') || lower.includes('denim') || lower.includes('청')) return '데님자켓';
    if (lower.includes('가죽') || lower.includes('leather') || lower.includes('레더')) return '레더자켓';
    if (lower.includes('수트') || lower.includes('suit') || lower.includes('정장')) return '수트자켓';
    if (lower.includes('핸드메이드') || lower.includes('handmade')) return '핸드메이드코트';
    if (lower.includes('더블') && lower.includes('코트')) return '더블코트';
    if (lower.includes('코트') || lower.includes('coat')) return '코트';
    if (lower.includes('점퍼') || lower.includes('jumper')) return '점퍼';
    if (lower.includes('자켓') || lower.includes('jacket') || lower.includes('재킷')) return '자켓';
    return '';
  }

  // 신발 (확장)
  if (itemSlot === 'shoes') {
    if (lower.includes('첼시') || lower.includes('chelsea')) return '첼시부츠';
    if (lower.includes('워커') || lower.includes('walker') || lower.includes('combat') || lower.includes('컴뱃')) return '워커부츠';
    if (lower.includes('앵클') || lower.includes('ankle')) return '앵클부츠';
    if (lower.includes('롱부츠') || lower.includes('knee') || lower.includes('하이부츠') || lower.includes('니하이')) return '롱부츠';
    if (lower.includes('레인부츠') || lower.includes('rain boot') || lower.includes('장화')) return '레인부츠';
    if (lower.includes('부츠') || lower.includes('boots') || lower.includes('boot')) return '부츠';
    if (lower.includes('러닝') || lower.includes('running')) return '러닝화';
    if (lower.includes('트레일') || lower.includes('trail') || lower.includes('하이킹') || lower.includes('hiking')) return '트레일화';
    if (lower.includes('스니커즈') || lower.includes('sneaker') || lower.includes('운동화') || lower.includes('trainer')) return '스니커즈';
    if (lower.includes('로퍼') || lower.includes('loafer')) return '로퍼';
    if (lower.includes('구두') || lower.includes('derby') || lower.includes('더비') || lower.includes('oxford') || lower.includes('옥스포드')) return '구두';
    if (lower.includes('메리제인') || lower.includes('mary jane')) return '메리제인';
    if (lower.includes('에스파드리유') || lower.includes('espadrille')) return '에스파드리유';
    if (lower.includes('웨지') || lower.includes('wedge')) return '웨지힐';
    if (lower.includes('슬링백') || lower.includes('slingback')) return '슬링백';
    if (lower.includes('뮬') || lower.includes('mule')) return '뮬';
    if (lower.includes('아쿠아') || lower.includes('워터슈즈') || lower.includes('water shoes')) return '아쿠아슈즈';
    if (lower.includes('플립플랍') || lower.includes('flip flop') || lower.includes('flip-flop') || lower.includes('쪼리')) return '플립플랍';
    if (lower.includes('샌들') || lower.includes('sandal')) return '샌들';
    if (lower.includes('슬리퍼') || lower.includes('slipper') || lower.includes('슬라이드') || lower.includes('slide')) return '슬리퍼';
    if (lower.includes('플랫') || lower.includes('flat') || lower.includes('발레') || lower.includes('ballet')) return '플랫슈즈';
    if (lower.includes('힐') || lower.includes('heel') || lower.includes('펌프스') || lower.includes('pump')) return '힐';
    return '';
  }

  // 가방 (확장)
  if (itemSlot === 'bag') {
    if (lower.includes('토트') || lower.includes('tote')) return '토트백';
    if (lower.includes('크로스') || lower.includes('cross')) return '크로스백';
    if (lower.includes('숄더') || lower.includes('shoulder')) return '숄더백';
    if (lower.includes('백팩') || lower.includes('backpack') || lower.includes('배낭') || lower.includes('리유저블')) return '백팩';
    if (lower.includes('클러치') || lower.includes('clutch')) return '클러치';
    if (lower.includes('호보') || lower.includes('hobo')) return '호보백';
    if (lower.includes('버킷') || lower.includes('bucket')) return '버킷백';
    if (lower.includes('새들') || lower.includes('saddle')) return '새들백';
    if (lower.includes('쇼퍼') || lower.includes('shopper')) return '쇼퍼백';
    if (lower.includes('메신저') || lower.includes('messenger')) return '메신저백';
    if (lower.includes('웨이스트') || lower.includes('waist') || lower.includes('벨트백') || lower.includes('belt bag') || lower.includes('힙색') || lower.includes('fanny')) return '웨이스트백';
    if (lower.includes('파우치') || lower.includes('pouch')) return '파우치';
    if (lower.includes('비치백') || lower.includes('beach bag') || lower.includes('라탄') || lower.includes('rattan') || lower.includes('바스켓') || lower.includes('basket')) return '비치백';
    if (lower.includes('에코백') || lower.includes('eco bag') || lower.includes('캔버스백')) return '에코백';
    if (lower.includes('미니') || lower.includes('mini')) return '미니백';
    return '';
  }

  // 액세서리 (확장)
  if (itemSlot === 'accessory') {
    // 모자류
    if (lower.includes('비니') || lower.includes('beanie')) return '비니';
    if (lower.includes('버킷햇') || lower.includes('bucket hat') || lower.includes('벙거지')) return '버킷햇';
    if (lower.includes('볼캡') || lower.includes('야구모자') || lower.includes('baseball cap')) return '볼캡';
    if (lower.includes('페도라') || lower.includes('fedora')) return '페도라';
    if (lower.includes('베레모') || lower.includes('beret')) return '베레모';
    if (lower.includes('캡') || lower.includes('cap')) return '캡';
    if (lower.includes('모자') || lower.includes('hat')) return '모자';
    if (lower.includes('바이저') || lower.includes('visor') || lower.includes('썬캡')) return '바이저';
    // 목/머리
    if (lower.includes('바라클라바') || lower.includes('balaclava')) return '바라클라바';
    if (lower.includes('넥워머') || lower.includes('neck warmer') || lower.includes('목토시')) return '넥워머';
    if (lower.includes('머플러') || lower.includes('muffler') || lower.includes('목도리')) return '머플러';
    if (lower.includes('스카프') || lower.includes('scarf') || lower.includes('숄') || lower.includes('shawl')) return '스카프';
    if (lower.includes('이어머프') || lower.includes('ear muff') || lower.includes('귀마개') || lower.includes('귀도리')) return '이어머프';
    if (lower.includes('넥타이') || lower.includes('타이') || lower.includes('necktie') || lower.includes('tie')) return '넥타이';
    if (lower.includes('보타이') || lower.includes('bow tie')) return '보타이';
    // 주얼리
    if (lower.includes('후프') || lower.includes('hoop')) return '후프이어링';
    if (lower.includes('드롭') || lower.includes('drop')) return '드롭이어링';
    if (lower.includes('스터드') || lower.includes('stud')) return '스터드이어링';
    if (lower.includes('귀걸이') || lower.includes('earring') || lower.includes('이어링')) return '귀걸이';
    if (lower.includes('초커') || lower.includes('choker')) return '초커';
    if (lower.includes('체인') && lower.includes('목걸이')) return '체인목걸이';
    if (lower.includes('펜던트') || lower.includes('pendant')) return '펜던트목걸이';
    if (lower.includes('목걸이') || lower.includes('necklace')) return '목걸이';
    if (lower.includes('반지') || lower.includes('ring')) return '반지';
    if (lower.includes('팔찌') || lower.includes('bracelet') || lower.includes('뱅글') || lower.includes('bangle')) return '팔찌';
    if (lower.includes('브로치') || lower.includes('brooch') || lower.includes('핀')) return '브로치';
    // 기타
    if (lower.includes('선글라스') || lower.includes('sunglasses')) return '선글라스';
    if (lower.includes('시계') || lower.includes('watch')) return '시계';
    if (lower.includes('벨트') || lower.includes('belt')) return '벨트';
    if (lower.includes('장갑') || lower.includes('gloves') || lower.includes('glove')) return '장갑';
    if (lower.includes('헤어밴드') || lower.includes('headband') || lower.includes('머리띠')) return '헤어밴드';
    if (lower.includes('헤어핀') || lower.includes('hairpin') || lower.includes('헤어클립') || lower.includes('집게핀') || lower.includes('바렛') || lower.includes('barrette')) return '헤어핀';
    if (lower.includes('스크런치') || lower.includes('scrunchie') || lower.includes('헤어끈') || lower.includes('곱창밴드')) return '스크런치';
    if (lower.includes('토시') || lower.includes('레그워머') || lower.includes('leg warmer') || lower.includes('발토시')) return '레그워머';
    if (lower.includes('양말') || lower.includes('삭스') || lower.includes('socks') || lower.includes('스타킹') || lower.includes('stocking')) return '양말';
    return '';
  }

  // 원피스 (확장)
  if (itemSlot === 'dress') {
    if (lower.includes('점프수트') || lower.includes('jumpsuit')) return '점프수트';
    if (lower.includes('롬퍼') || lower.includes('romper')) return '롬퍼';
    if (lower.includes('덩가리') || lower.includes('오버올') || lower.includes('overall') || lower.includes('dungaree')) return '오버올';
    if (lower.includes('미니') || lower.includes('mini')) return '미니원피스';
    if (lower.includes('맥시') || lower.includes('maxi') || lower.includes('롱')) return '맥시원피스';
    if (lower.includes('미디') || lower.includes('midi')) return '미디원피스';
    if (lower.includes('셔츠') || lower.includes('shirt')) return '셔츠원피스';
    if (lower.includes('니트') || lower.includes('knit')) return '니트원피스';
    if (lower.includes('트위드') || lower.includes('tweed')) return '트위드원피스';
    if (lower.includes('슬립') || lower.includes('slip')) return '슬립원피스';
    if (lower.includes('랩') || lower.includes('wrap')) return '랩원피스';
    return '원피스';
  }

  return '';
}

// ═══════════════════════════════════════════════════════════════
// 9. Formality, Pair Slots, DNA Text 생성
// ═══════════════════════════════════════════════════════════════
function inferFormality(product: Product, itemSlot: DNAMeta['item_slot']): number {
  let base = 5;

  if (product.price > 500000) base = 8;
  else if (product.price > 300000) base = 7;
  else if (product.price > 150000) base = 6;
  else if (product.price > 80000) base = 5;
  else if (product.price < 30000) base = 3;
  else if (product.price < 50000) base = 4;

  const casualSlots: string[] = ['shoes', 'accessory', 'swimwear', 'homewear'];
  const formalSlots: string[] = ['dress', 'outer'];
  if (casualSlots.includes(itemSlot)) base -= 1;
  if (formalSlots.includes(itemSlot)) base += 1;
  if (itemSlot === 'swimwear') base = Math.min(base, 3);
  if (itemSlot === 'homewear') base = Math.min(base, 2);

  const nameLower = product.name.toLowerCase();
  const casualKeywords = ['스니커즈', 'sneakers', '운동화', '후드', 'hoodie', '맨투맨', '조거', 'jogger', '트레이닝', 'training', '반바지', 'shorts', '슬리퍼', '수영', '잠옷', '파자마'];
  const formalKeywords = ['블레이저', 'blazer', '슬랙스', 'slacks', '정장', 'suit', '코트', 'coat', '캐시미어', 'cashmere', '울', 'wool', '실크', 'silk', '턱시도', 'tuxedo'];

  if (casualKeywords.some(k => nameLower.includes(k))) base -= 2;
  if (formalKeywords.some(k => nameLower.includes(k))) base += 2;

  const brandLower = (product.brand || '').toLowerCase();
  const casualBrands = ['nike', 'adidas', 'vans', 'converse', '나이키', '아디다스', 'puma', '푸마', 'new balance', 'fila'];
  const premiumBrands = ['gucci', 'prada', 'max mara', '구찌', '프라다', 'thom browne', 'burberry', 'louis vuitton', 'dior', 'chanel', 'hermes'];
  const contemporaryBrands = ['cos', 'acne', 'apc', 'theory', 'sandro', 'maje'];

  if (casualBrands.some(b => brandLower.includes(b))) base -= 1;
  if (premiumBrands.some(b => brandLower.includes(b))) base += 2;
  if (contemporaryBrands.some(b => brandLower.includes(b))) base += 1;

  return Math.max(1, Math.min(10, base));
}

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
    case 'swimwear':
      pairs.push('accessory_sunglasses', 'shoes_sandal', 'bag_beach');
      break;
    case 'homewear':
      pairs.push('accessory_slipper');
      break;
  }
  return pairs;
}

function generateDNAText(product: Product, meta: DNAMeta, subCategory: string): string {
  const conceptsStr = meta.concepts.slice(0, 3).join(',');
  const brandInfo = product.brand || '데일리';
  const occasionStr = meta.occasions.slice(0, 2).join('/');

  let formalityLabel = '캐주얼';
  if (meta.formality >= 8) formalityLabel = '포멀';
  else if (meta.formality >= 6) formalityLabel = '세미포멀';
  else if (meta.formality >= 4) formalityLabel = '스마트캐주얼';

  const seasonMap: Record<string, string> = { 'spring': '봄', 'summer': '여름', 'fall': '가을', 'winter': '겨울' };
  const seasonStr = meta.season_fit.map(s => seasonMap[s] || s).join('/');

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

// ═══════════════════════════════════════════════════════════════
// 10. DNA 생성 메인 함수
// ═══════════════════════════════════════════════════════════════
function generateDNA(product: Product, customClassifications?: CustomClassification[]): DNAResult {
  const { category: inferredCategory, subCategory } = inferCategory(product.name, product.category);

  const target = normalizeTarget(product.gender, product.name);
  const itemSlot = categoryToItemSlot(inferredCategory, subCategory);

  // 커스텀 분류를 타입별로 분리
  const customSubStyles = customClassifications?.filter(c => c.config_type === 'sub_style');
  const customConcepts = customClassifications?.filter(c => c.config_type === 'concept');
  const customOccasions = customClassifications?.filter(c => c.config_type === 'occasion');
  const customColors = customClassifications?.filter(c => c.config_type === 'color');
  const customSeasons = customClassifications?.filter(c => c.config_type === 'season');

  const colorFamily = inferColorFamily(product.color, product.name, customColors);
  const seasonFit = inferSeasonFit(product.name, inferredCategory, itemSlot, customSeasons);
  const formality = inferFormality(product, itemSlot);
  const concepts = inferConcepts(product, formality, itemSlot, customConcepts);
  const occasions = inferOccasions(product, formality, itemSlot, concepts, customOccasions);
  const pairSlots = inferPairSlots(itemSlot, formality);
  const subStyle = inferSubStyle(product.name, itemSlot, subCategory, customSubStyles);

  const dnaMeta: DNAMeta = {
    target,
    item_slot: itemSlot,
    ...(subStyle ? { sub_style: subStyle } : {}),
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

// ═══════════════════════════════════════════════════════════════
// 11. 백그라운드 배치 처리 (기존 유지)
// ═══════════════════════════════════════════════════════════════
let customClassifications: CustomClassification[] = [];

async function continueProcessing(supabaseUrl: string, supabaseKey: string, iteration: number, maxIterations: number) {
  if (iteration >= maxIterations) {
    console.log(`[dna-batch] 최대 반복 횟수(${maxIterations}) 도달`);
    return;
  }

  try {
    console.log(`[dna-batch] 백그라운드 배치 #${iteration + 1} 시작...`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
      .eq('is_active', true)
      .is('dna_meta', null)
      .limit(100);

    if (fetchError) { console.error(`[dna-batch] 배치 #${iteration + 1} 조회 실패:`, fetchError); return; }
    if (!products || products.length === 0) { console.log(`[dna-batch] 모든 상품 DNA 생성 완료!`); return; }

    console.log(`[dna-batch] 배치 #${iteration + 1}: ${products.length}개 상품 처리 중...`);
    const startTime = Date.now();
    let updatedCount = 0;

    for (const product of products as Product[]) {
      try {
        const result = generateDNA(product, customClassifications);
        const updateData: Record<string, any> = {
          dna_text: result.dna_text,
          dna_meta: result.dna_meta,
          dna_generated_at: new Date().toISOString(),
        };
        if (result.category) updateData.category = result.category;
        if (result.sub_category) updateData.sub_category = result.sub_category;

        const { error: updateError } = await supabase.from('products_cache').update(updateData).eq('id', result.id);
        if (!updateError) updatedCount++;
      } catch (err) {
        console.error(`[dna-batch] 배치 #${iteration + 1} 상품 ${product.id} 에러:`, err);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[dna-batch] 배치 #${iteration + 1} 완료: ${updatedCount}개 업데이트, ${elapsed}ms`);

    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('dna_meta', null);

    if ((remainingCount || 0) > 0) {
      console.log(`[dna-batch] 남은 상품 ${remainingCount}개, 다음 배치 시작...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await continueProcessing(supabaseUrl, supabaseKey, iteration + 1, maxIterations);
    } else {
      console.log(`[dna-batch] 모든 상품 DNA 생성 완료!`);
    }
  } catch (err) {
    console.error(`[dna-batch] 배치 #${iteration + 1} 에러:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 12. 메인 서버 핸들러
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 50, scheduled = false, maxIterations = 10, forceRegenerate = false, productIds = [], subStyleOnly = false, merchantId = null } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 커스텀 분류 항목 로드
    try {
      const { data: customData } = await supabase
        .from('dna_classification_config')
        .select('config_type, item_slot, value, keywords')
        .eq('is_active', true);
      if (customData) customClassifications = customData as CustomClassification[];
      if (customClassifications.length > 0) {
        console.log(`[dna-batch] 커스텀 분류 ${customClassifications.length}개 로드됨`);
      }
    } catch (err) {
      console.warn('[dna-batch] 커스텀 분류 로드 실패 (무시):', err);
    }

    const effectiveBatchSize = Math.min(batchSize, 200);
    console.log(`[dna-batch] DNA 2.0 생성 시작 (scheduled=${scheduled}, batchSize=${effectiveBatchSize}, force=${forceRegenerate}, merchantId=${merchantId})`);

    // 특정 productIds
    if (productIds && productIds.length > 0) {
      const { data: specificProducts, error: specificError } = await supabase
        .from('products_cache')
        .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
        .in('id', productIds);

      if (specificError) throw new Error(`Failed to fetch specific products: ${specificError.message}`);

      let updatedCount = 0;
      for (const product of specificProducts || []) {
        const dnaResult = generateDNA(product, customClassifications);
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

    // subStyleOnly 모드
    if (subStyleOnly) {
      const SUB_STYLE_BATCH = 200;
      let updated = 0;

      console.log(`[dna-batch] subStyleOnly 모드 시작 (배치=${SUB_STYLE_BATCH})`);

      const { data: products, error: fetchErr } = await supabase
        .rpc('get_products_without_sub_style', { batch_limit: SUB_STYLE_BATCH })
        .select('*');

      let needsUpdate: any[];
      if (fetchErr) {
        console.log(`[dna-batch] RPC 미지원, JS 필터 폴백 사용`);
        const { data: allProducts, error: fallbackErr } = await supabase
          .from('products_cache')
          .select('id, name, brand, category, sub_category, price, style_tags, gender, color, dna_meta')
          .eq('is_active', true)
          .not('dna_meta', 'is', null)
          .limit(SUB_STYLE_BATCH);

        if (fallbackErr) throw new Error(`subStyleOnly fetch error: ${fallbackErr.message}`);
        needsUpdate = (allProducts || []).filter((p: any) => {
          const meta = p.dna_meta as any;
          return meta?.sub_style === undefined || meta?.sub_style === null;
        });
      } else {
        needsUpdate = products || [];
      }

      if (needsUpdate.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: '모든 상품에 세부 스타일이 있습니다',
          processed: 0,
          remaining: 0,
          hasMore: false,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[dna-batch] subStyleOnly: ${needsUpdate.length}개 처리 중...`);

      for (const product of needsUpdate) {
        try {
          const existingMeta = product.dna_meta as any;
          const { category: inferredCat, subCategory } = inferCategory(product.name, product.category);
          const itemSlot = categoryToItemSlot(inferredCat, subCategory);
          const subStyle = inferSubStyle(product.name, itemSlot, subCategory, customClassifications.filter(c => c.config_type === 'sub_style'));

          const updatedMeta = { ...existingMeta, sub_style: subStyle || '' };
          const { error: upErr } = await supabase
            .from('products_cache')
            .update({ dna_meta: updatedMeta as any })
            .eq('id', product.id);

          if (!upErr) updated++;
        } catch (err) {
          console.error(`[dna-batch] subStyleOnly product ${product.id} error:`, err);
        }
      }

      const { count: remainingCount } = await supabase
        .from('products_cache')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('dna_meta', 'is', null)
        .is('dna_meta->sub_style' as any, null);

      const remaining = remainingCount ?? 0;
      const hasMore = remaining > 0 && needsUpdate.length >= SUB_STYLE_BATCH;

      console.log(`[dna-batch] subStyleOnly 완료: ${updated}개 업데이트, remaining=${remaining}, hasMore=${hasMore}`);

      return new Response(JSON.stringify({
        success: true,
        message: `세부 스타일 추출 완료`,
        processed: needsUpdate.length,
        updated,
        remaining,
        hasMore,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // forceRegenerate 모드
    if (forceRegenerate) {
      // Use a session timestamp to track which products were already processed
      // Products updated after this timestamp are considered "done" in this session
      const sessionStart = new Date(Date.now() - 5000).toISOString(); // 5s buffer for clock skew

      // Count total first
      const { count: totalCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch products NOT yet updated in this session (dna_generated_at < sessionStart or null)
      const { data: allProducts, error: allError } = await supabase
        .from('products_cache')
        .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
        .eq('is_active', true)
        .or(`dna_generated_at.is.null,dna_generated_at.lt.${sessionStart}`)
        .order('dna_generated_at', { ascending: true, nullsFirst: true })
        .limit(effectiveBatchSize);

      if (allError) throw new Error(`Failed to fetch products: ${allError.message}`);

      if (!allProducts || allProducts.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: '모든 상품 DNA 재생성 완료!',
          processed: 0,
          remaining: 0,
          total: totalCount || 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[dna-batch] 강제 재생성 모드: ${allProducts.length}개 처리 중...`);

      let updatedCount = 0;
      const results: DNAResult[] = [];

      for (const product of allProducts) {
        try {
          const dnaResult = generateDNA(product, customClassifications);
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

      // Count remaining: products still with old dna_generated_at
      const { count: remainingCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`dna_generated_at.is.null,dna_generated_at.lt.${sessionStart}`);

      const remaining = Math.max(0, (remainingCount || 0) - updatedCount);

      return new Response(JSON.stringify({
        success: true,
        message: `DNA 강제 재생성 완료`,
        processed: updatedCount,
        remaining,
        total: totalCount || 0,
        sample: results.slice(0, 3).map(r => ({ id: r.id, target: r.dna_meta.target, color: r.dna_meta.color_family, formality: r.dna_meta.formality })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 기본 모드: dna_meta가 없는 상품만
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, brand, category, sub_category, price, style_tags, gender, color')
      .eq('is_active', true)
      .is('dna_meta', null)
      .limit(effectiveBatchSize);

    if (fetchError) throw new Error(`Failed to fetch products: ${fetchError.message}`);

    if (!products || products.length === 0) {
      const { count: totalCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      const { count: withMetaCount } = await supabase
        .from('products_cache')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('dna_meta', 'is', null);

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

    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('dna_meta', null);

    const errors: { id: string; error: string }[] = [];
    const results: DNAResult[] = [];
    const startTime = Date.now();

    for (const product of products as Product[]) {
      try {
        const result = generateDNA(product, customClassifications);
        results.push(result);
      } catch (err) {
        console.error(`[dna-batch] Error processing ${product.id}:`, err);
        errors.push({ id: product.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const generateTime = Date.now() - startTime;
    console.log(`[dna-batch] DNA 생성 완료: ${results.length}개, ${generateTime}ms`);

    let updatedCount = 0;
    const updatePromises = results.map(async (result) => {
      const updateData: Record<string, any> = {
        dna_text: result.dna_text,
        dna_meta: result.dna_meta,
        dna_generated_at: new Date().toISOString(),
      };
      if (result.category) updateData.category = result.category;
      if (result.sub_category) updateData.sub_category = result.sub_category;

      const { error: updateError } = await supabase.from('products_cache').update(updateData).eq('id', result.id);
      if (!updateError) return true;
      errors.push({ id: result.id, error: updateError.message });
      return false;
    });

    const updateResults = await Promise.all(updatePromises);
    updatedCount = updateResults.filter(Boolean).length;

    const totalTime = Date.now() - startTime;
    const remaining = Math.max(0, (remainingCount || 0) - products.length);

    if (scheduled && remaining > 0) {
      console.log(`[dna-batch] 스케줄 모드: 남은 ${remaining}개 상품을 백그라운드에서 처리합니다`);
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(continueProcessing(supabaseUrl, supabaseKey, 1, maxIterations));
      }
    }

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
