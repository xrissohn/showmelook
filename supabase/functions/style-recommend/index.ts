// style-recommend v7.0 - 세계 최고 패셔니스타 + 하이브리드 2단계 추론 + 교차 Fallback
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= 인터페이스 정의 =============

// Stage 1 (GPT-5-mini): TPO 분석 결과
interface Stage1Result {
  concepts: string[];
  formalityMin: number;
  formalityMax: number;
  requiredItems: string[];  // 필수 카테고리 (상의, 하의, 신발 등)
  excludeItems: string[];   // 제외할 아이템 (운동화, 후드티 등)
  dressCodeHint: string;    // 드레스코드 힌트
  colorSuggestions: string[];  // 추천 색상
  reasoning: string;        // 왜 이 조건을 선택했는지
}

// Stage 2 (Gemini Flash): 최종 선택 결과
interface RAGStyleResponse {
  lookName: string;
  styleConcept: string;
  styleReasoning: string;
  selectedProductIds: string[];
  stylingTips: string;
  productDNAs?: { id: string; dna: string }[];
}

// 검색 조건 (규칙 기반 fallback용)
interface SearchConditions {
  concepts: string[];
  occasions: string[];
  formalityMin: number;
  formalityMax: number;
  colorFamilies: string[];
  excludeCategories: string[];
  seasonFit: string[];
  reasoning: string;
}

// 추론 메트릭
interface InferenceMetrics {
  stage1Model: string;
  stage2Model: string;
  stage1TimeMs: number;
  stage2TimeMs: number;
  totalTimeMs: number;
  stage1Success: boolean;
  stage2Success: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
  occasion: string | null;
  concepts: string[];
  productCount: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= 타임아웃 설정 (하이브리드 2단계) =============
const STAGE1_TIMEOUT = 15000; // 15초 (GPT-5-mini 짧은 응답)
const STAGE2_TIMEOUT = 25000; // 25초 (Gemini Flash 상세 응답)
const TOTAL_TIMEOUT = 45000;  // 전체 45초

// ============= 🎭 세계 최고 패셔니스타 위트 멘트 =============
const WITTY_OPENERS = [
  "이 조합, 솔직히 천재적이에요 😏",
  "믿고 가세요, 이 조합은 실패가 없거든요.",
  "자, 주목! 오늘의 베스트 픽입니다 ✨",
  "이 룩 보고 안 사시면, 솔직히 손해예요!",
  "패션 테러 방지법 1조: 이거 입기 📋",
  "지금 이 순간, 최고의 선택을 하고 계십니다.",
  "이건 진짜... 찐 스타일리스트만 아는 조합이에요.",
  "당신의 패션 운세: 오늘 대박 예정 🌟",
];

const WITTY_CLOSERS = [
  "킬링 포인트? 바로 이 조합 자체예요!",
  "장바구니 담기, 후회 없을 거예요 ✨",
  "이거 안 사면 미래의 나한테 혼나요!",
  "이 정도면 거리에서 찰칵 당할 각오하세요 📸",
  "솔직히 이 가격에 이 스타일? 거의 범죄 수준 🔥",
  "이 룩으로 나가면 '어디서 샀어?' 공격 예상됩니다",
  "패션 치트키 발동! 이건 반칙이에요 ㅋㅋ",
  "스타일 만렙 달성! 축하드려요 🎉",
];

function getRandomWittyOpener(): string {
  return WITTY_OPENERS[Math.floor(Math.random() * WITTY_OPENERS.length)];
}

function getRandomWittyCloser(): string {
  return WITTY_CLOSERS[Math.floor(Math.random() * WITTY_CLOSERS.length)];
}

// Exponential backoff retry helper
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[style-recommend] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[style-recommend] Network error, waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  
  throw lastError || new Error('All retries failed');
}

// Error logging helper
async function logError(
  supabase: any,
  functionName: string,
  errorCode: string,
  errorMessage: string,
  userId: string | null,
  requestPayload: any,
  executionTimeMs: number
) {
  try {
    await supabase.from('error_logs').insert({
      function_name: functionName,
      error_code: errorCode,
      error_message: errorMessage,
      user_id: userId,
      request_payload: requestPayload,
      execution_time_ms: executionTimeMs,
    });
    console.log(`[style-recommend] Error logged: ${errorCode} - ${errorMessage.slice(0, 100)}`);
  } catch (logErr) {
    console.error('[style-recommend] Failed to log error:', logErr);
  }
}

// 추론 메트릭 저장
async function saveInferenceMetrics(supabase: any, metrics: InferenceMetrics, userId: string | null) {
  try {
    await supabase.from('inference_metrics').insert({
      user_id: userId,
      stage1_model: metrics.stage1Model,
      stage2_model: metrics.stage2Model,
      stage1_time_ms: metrics.stage1TimeMs,
      stage2_time_ms: metrics.stage2TimeMs,
      total_time_ms: metrics.totalTimeMs,
      stage1_success: metrics.stage1Success,
      stage2_success: metrics.stage2Success,
      used_fallback: metrics.usedFallback,
      fallback_reason: metrics.fallbackReason,
      occasion: metrics.occasion,
      concepts: metrics.concepts,
      product_count: metrics.productCount,
    });
  } catch (err) {
    console.error('[style-recommend] Failed to save metrics:', err);
  }
}

// ============= DNA 메타 인터페이스 =============
interface DNAMeta {
  target: 'adult_female' | 'adult_male' | 'kids_female' | 'kids_male' | 'kids_unisex' | 'unisex';
  item_slot: 'top' | 'bottom' | 'outer' | 'shoes' | 'bag' | 'accessory' | 'dress';
  concepts: string[];
  formality: number;
  pair_slots: string[];
  occasions: string[];
  color_family: 'neutral' | 'warm' | 'cool' | 'bold' | 'pastel';
  season_fit: string[];
}

interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  merchant_id: string | null;
  color: string | null;
  gender: string | null;
  sub_category: string | null;
  dna_text: string | null;
  dna_meta: DNAMeta | null;
  dna_generated_at: string | null;
  feedback_score?: number;
  style_weights?: Record<string, number>;
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'none';
  isAutoSelected: boolean;
}

// Category priority
const CATEGORY_PRIORITY = ['상의', '하의', '아우터', '기타'];
const REQUIRED_CATEGORIES = ['상의', '하의'];
const OPTIONAL_CATEGORIES = ['아우터', '기타'];

// ============= 유틸리티 함수들 =============

function getAgeGroupLabel(ageGroup: string): string {
  const labels: Record<string, string> = {
    'child': '아동',
    'teen': '10대',
    '20s': '20대',
    '30s': '30대',
    '40s': '40대',
    '50s': '50대',
    '60plus': '60대 이상',
  };
  return labels[ageGroup] || '성인';
}

function generateCacheKey(gender: string, style: string, occasion: string, budget: number): string {
  const normalized = `${gender}|${style}|${occasion}|${Math.floor(budget / 50000) * 50000}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `style_${Math.abs(hash).toString(36)}`;
}

// 스타일 무관 상품 필터링
const EXCLUDED_PRODUCT_KEYWORDS = [
  '화장품', '스킨케어', '크림', '세럼', '토너', '로션', '마스크팩', '선크림', '클렌저', 
  '마데카', '비타민', '에센스', '앰플', '스킨', '모이스처', '뷰티', 'beauty', 'skincare',
  'cream', 'serum', 'lotion', 'mask', 'sunscreen', 'cleanser',
  '건강식품', '영양제', '프로틴', '다이어트', '건강', 'health', 'supplement',
  '가전', '전자', '충전기', '케이블', '이어폰', '헤드폰', '스피커', 'electronics',
  '식품', '음식', '간식', '음료', '커피', 'food', 'drink', 'snack',
  '세제', '청소', '주방', '욕실', '인테리어', '가구', 'cleaning', 'kitchen', 'furniture',
];

function isStyleRelevantProduct(product: CachedProduct): boolean {
  const combined = `${product.name || ''} ${product.category || ''} ${product.sub_category || ''} ${product.brand || ''}`.toLowerCase();
  
  if (EXCLUDED_PRODUCT_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()))) {
    return false;
  }
  
  const category = (product.category || '').toLowerCase();
  if (['뷰티', 'beauty', '라이프', 'life'].some(c => category.includes(c))) {
    if (['향수', 'perfume', '선글라스', 'sunglasses', '시계', 'watch'].some(kw => combined.includes(kw))) {
      return true;
    }
    return false;
  }
  
  return true;
}

// 가방 키워드 체크
const BAG_KEYWORDS = [
  '가방', 'bag', 'bags', '백', '토트', 'tote', '숄더', 'shoulder', 
  '크로스백', 'crossbody', '클러치', 'clutch', '백팩', 'backpack', 
  '파우치', 'pouch', '호보', 'hobo', '새들', 'saddle', '버킷', 'bucket',
  '미니백', 'minibag', '에코백', 'ecobag', '캔버스백', 'canvas bag'
];

function hasBagKeyword(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const lower = productName.toLowerCase();
  return BAG_KEYWORDS.some(kw => lower.includes(kw));
}

function itemSlotToPriorityCategory(itemSlot: string | undefined, productName?: string | null): string {
  if (hasBagKeyword(productName)) {
    return '기타';
  }
  
  if (!itemSlot) return 'unknown';
  
  switch (itemSlot) {
    case 'top': return '상의';
    case 'bottom': 
    case 'dress': return '하의';
    case 'outer': return '아우터';
    case 'shoes':
    case 'bag':
    case 'accessory': return '기타';
    default: return 'unknown';
  }
}

function mapToPriorityCategory(category: string, subCategory?: string | null, productName?: string | null): string {
  const combined = `${category || ''} ${subCategory || ''} ${productName || ''}`.toLowerCase();
  
  if (['가방', 'bag', 'bags', '백', '토트', 'tote', '숄더', 'shoulder', '크로스백', 'crossbody', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch'].some(v => combined.includes(v))) {
    return '기타';
  }
  
  if (['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'jackets', 'coats', '패딩', 'padding', 'puffer', 'blazer', '블레이저', '야상', '트렌치', 'trench'].some(v => combined.includes(v))) {
    if (['니트', 'knit', '스웨터', 'sweater', '티셔츠', 't-shirt', '맨투맨'].some(v => combined.includes(v))) {
      return '상의';
    }
    if (['가방', 'bag', '토트', 'tote', '백팩', 'backpack'].some(v => combined.includes(v))) {
      return '기타';
    }
    return '아우터';
  }
  
  if (['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'shirts', 'polo', 'sweater', '스웨터', '맨투맨', '후드', 'hoodie'].some(v => combined.includes(v))) {
    return '상의';
  }
  
  if (['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress', 'dresses', '드레스', 'shorts', '반바지', 'leggings', '레깅스', '슬랙스', 'slacks'].some(v => combined.includes(v))) {
    return '하의';
  }
  
  if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'loafers', '로퍼', '힐', '가방', 'bag', 'bags', '백', '클러치', 'tote', '액세서리', 'accessory', 'accessories', '스카프', '모자', 'hat', '벨트', 'belt', '목걸이', '반지', '귀걸이', '팔찌', '시계', '선글라스'].some(v => combined.includes(v))) {
    return '기타';
  }
  
  if (['여성', '남성', '여성의류', '남성의류', '라이프', '뷰티', '키즈', '골프', '스포츠', '명품'].includes(category)) {
    return 'unknown';
  }
  
  return 'unknown';
}

function getDisplaySubCategory(category: string, subCategory?: string | null, productName?: string | null, dnaMeta?: DNAMeta | null): string {
  if (dnaMeta?.item_slot) {
    switch (dnaMeta.item_slot) {
      case 'top': return '상의';
      case 'bottom': return '하의';
      case 'outer': return '아우터';
      case 'dress': return '원피스';
      case 'shoes': return '신발';
      case 'bag': return '가방';
      case 'accessory': return '액세서리';
    }
  }
  
  const combined = `${category || ''} ${subCategory || ''} ${productName || ''}`.toLowerCase();
  
  if (['하의', 'bottom', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', '원피스', 'dress', '반바지', 'bootcut', '부츠컷', 'trousers', '슬랙스'].some(v => combined.includes(v))) {
    return '하의';
  }
  
  const isBootcut = combined.includes('bootcut') || combined.includes('부츠컷');
  if (!isBootcut && ['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'loafers', '로퍼', '힐'].some(v => combined.includes(v))) {
    return '신발';
  }
  if (['가방', 'bag', 'bags', '백', '클러치', 'clutch', 'tote', '토트백', 'backpack', '숄더백', '크로스백'].some(v => combined.includes(v))) {
    return '가방';
  }
  if (['목걸이', 'necklace', '팔찌', 'bracelet', '반지', 'ring', '귀걸이', 'earring', '시계', 'watch', '선글라스', 'sunglasses', '모자', 'hat', 'cap', '스카프', 'scarf', '머플러', '벨트', 'belt', '장갑', 'gloves'].some(v => combined.includes(v))) {
    return '액세서리';
  }
  
  return mapToPriorityCategory(category, subCategory, productName);
}

// ============= DNA 2.0 필터링 함수들 =============

function filterByTarget(products: CachedProduct[], isKids: boolean, gender: string): CachedProduct[] {
  return products.filter(p => {
    const meta = p.dna_meta;
    if (!meta) return true;
    if (!meta.target) return true;
    
    let targetGender = '';
    let isKidsTarget = false;
    
    if (typeof meta.target === 'object' && meta.target !== null) {
      const targetObj = meta.target as { age?: string; gender?: string };
      targetGender = targetObj.gender || '';
      isKidsTarget = targetObj.age === 'kids';
    } else {
      const target = String(meta.target || '');
      if (!target) return true;
      
      isKidsTarget = target.startsWith('kids_');
      if (target.includes('female')) targetGender = 'female';
      else if (target.includes('male')) targetGender = 'male';
      else targetGender = 'unisex';
    }
    
    if (isKids) {
      return isKidsTarget || targetGender === 'unisex';
    } else {
      if (isKidsTarget) return false;
      
      if (gender === '남성' && targetGender === 'female') return false;
      if (gender === '여성' && targetGender === 'male') return false;
      
      return true;
    }
  });
}

// 컨셉 정규화
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  '캐주얼': ['casual', '캐쥬얼', '데일리', 'daily'],
  '미니멀': ['minimal', 'minimalist', '심플', 'simple', '베이직', 'basic'],
  '모던': ['modern', '세련', 'chic', '시크'],
  '클래식': ['classic', '클라식', '정통'],
  '스트릿': ['street', 'streetwear', '힙합', 'hiphop', '그런지'],
  '페미닌': ['feminine', '여성스러운', '러블리', 'lovely', '로맨틱', 'romantic'],
  '스포티': ['sporty', 'athletic', '애슬레저', 'athleisure', '활동적'],
  '빈티지': ['vintage', 'retro', '레트로', '복고'],
  '럭셔리': ['luxury', 'luxe', '고급', 'premium'],
  '포멀': ['formal', '정장', '오피스', 'office', 'business'],
  '보헤미안': ['bohemian', 'boho', '히피'],
  '귀여운': ['cute', '큐트', '러블리'],
  '밀리터리': ['military', '밀리터리', '카무플라주', 'camo', '카키', 'khaki', '아미', 'army', '유틸리티', 'utility', '워크웨어', 'workwear'],
  '고프코어': ['gorpcore', '고프코어', '아웃도어', 'outdoor', '하이킹', 'hiking', '테크웨어', 'techwear'],
  '올드머니': ['old money', '올드머니', '프레피', 'preppy', '아이비', 'ivy'],
  '시티보이': ['city boy', '시티보이', '어반', 'urban'],
  '아메카지': ['amekaji', '아메카지', '워크웨어', 'americana'],
  '댄디': ['dandy', '댄디', '젠틀', 'gentlemanly'],
  '그런지': ['grunge', '그런지', '얼터너티브'],
  '노멀코어': ['normcore', '노멀코어'],
};

function cleanConcept(concept: string): string {
  if (concept.includes('>')) return '';
  if (concept.length > 15) return '';
  return concept.toLowerCase().trim();
}

function normalizeConcept(concept: string): string {
  const cleaned = cleanConcept(concept);
  if (!cleaned) return '';
  
  for (const [normalized, synonyms] of Object.entries(CONCEPT_SYNONYMS)) {
    if (synonyms.some(s => cleaned.includes(s)) || cleaned.includes(normalized)) {
      return normalized;
    }
  }
  return cleaned;
}

function calculateConceptScore(product: CachedProduct, requestedConcepts: string[]): number {
  const meta = product.dna_meta;
  if (!meta || !meta.concepts || requestedConcepts.length === 0) return 0.3;
  
  const productConcepts = meta.concepts
    .map(c => normalizeConcept(c))
    .filter(c => c.length > 0);
  
  if (productConcepts.length === 0) return 0.3;
  
  const normalizedRequests = requestedConcepts.map(c => normalizeConcept(c)).filter(c => c);
  
  let exactMatches = 0;
  let partialMatches = 0;
  
  for (const reqConcept of normalizedRequests) {
    if (productConcepts.includes(reqConcept)) {
      exactMatches++;
    } else if (productConcepts.some(pc => pc.includes(reqConcept) || reqConcept.includes(pc))) {
      partialMatches++;
    }
  }
  
  const score = (exactMatches * 1.0 + partialMatches * 0.5) / Math.max(normalizedRequests.length, 1);
  return Math.min(score, 1.0);
}

function formalityMatch(product1: CachedProduct, product2: CachedProduct): boolean {
  const f1 = product1.dna_meta?.formality || 5;
  const f2 = product2.dna_meta?.formality || 5;
  return Math.abs(f1 - f2) <= 2;
}

function calculateOccasionScore(product: CachedProduct, requestedOccasions: string[]): number {
  const meta = product.dna_meta;
  if (!meta || !meta.occasions || requestedOccasions.length === 0) return 0.5;
  
  const overlap = meta.occasions.filter(o => 
    requestedOccasions.some(ro => o.includes(ro) || ro.includes(o))
  );
  return overlap.length / Math.max(requestedOccasions.length, 1);
}

// 컨셉/상황 추출
function extractConcepts(request: string): string[] {
  const conceptKeywords: Record<string, string[]> = {
    '캐주얼': ['캐주얼', 'casual', '편한', '데일리'],
    '클래식': ['클래식', 'classic', '정장', '격식', '포멀'],
    '스트릿': ['스트릿', 'street', '힙합', '오버사이즈'],
    '미니멀': ['미니멀', 'minimal', '심플', '깔끔'],
    '페미닌': ['페미닌', 'feminine', '여성스러운', '로맨틱'],
    '스포티': ['스포티', 'sporty', '운동', '애슬레저'],
  };
  
  const found: string[] = [];
  const lower = request.toLowerCase();
  
  for (const [concept, keywords] of Object.entries(conceptKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      found.push(concept);
    }
  }
  
  return found.length > 0 ? found : ['데일리'];
}

function extractOccasions(request: string): string[] {
  const occasionKeywords: Record<string, string[]> = {
    '캐주얼': ['캐주얼', '일상', '데일리', '편하게', '쇼핑', '약속', '친구'],
    '데이트': ['데이트', '소개팅', '만남', '기념일'],
    '출근': ['출근', '오피스', '회사', '비즈니스', '미팅'],
    '면접': ['면접', '인터뷰', '취업'],
    '결혼식': ['결혼식', '웨딩', '하객', '청첩장'],
    '파티': ['파티', '행사', '돌잔치', '모임'],
    '여행': ['여행', '휴가', '바캉스'],
    '운동': ['운동', '헬스', '요가', '산책'],
  };
  
  const found: string[] = [];
  const lower = request.toLowerCase();
  
  for (const [occasion, keywords] of Object.entries(occasionKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      found.push(occasion);
    }
  }
  
  return found.length > 0 ? found : ['캐주얼'];
}

function detectSeason(request: string): string | null {
  const seasonKeywords: Record<string, string[]> = {
    '봄': ['봄', 'spring', '3월', '4월', '5월'],
    '여름': ['여름', 'summer', '6월', '7월', '8월', '시원한', '시원하게'],
    '가을': ['가을', 'fall', 'autumn', '9월', '10월', '11월'],
    '겨울': ['겨울', 'winter', '12월', '1월', '2월', '따뜻한', '따뜻하게'],
  };
  
  const lower = request.toLowerCase();
  
  for (const [season, keywords] of Object.entries(seasonKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return season;
    }
  }
  
  return null;
}

// ============= 🔥 Stage 1: GPT TPO 분석 (with cross-fallback) =============

async function runStage1WithModel(
  modelName: string,
  userRequest: string,
  gender: string,
  ageGroupLabel: string,
  occasion: string,
  LOVABLE_API_KEY: string
): Promise<Stage1Result | null> {
  console.log(`[style-recommend] Stage 1: ${modelName} TPO 분석 시작...`);
  
  const stage1SystemPrompt = `당신은 세계 최고의 패션 TPO 분석 전문가입니다.
사용자의 요청을 분석하여 최적의 스타일 검색 조건을 JSON으로 반환하세요.

분석 규칙:
1. 격식도(formality): 1(매우 캐주얼) ~ 10(포멀)
   - 결혼식/장례식/면접: 7-10 → 정장/구두 필수
   - 데이트/파티/출근: 5-7
   - 데일리/쇼핑/카페: 3-5
   - 운동/집콕: 1-3

2. 필수 아이템 (requiredItems):
   - 격식 높은 상황(7+): ["상의", "하의", "신발"] 필수
   - 일반 상황: ["상의", "하의"] 필수
   - 야외/겨울: ["아우터"] 고려

3. 제외 아이템 (excludeItems) - 상황에 어울리지 않는 것:
   - 결혼식: ["운동화", "후드티", "조거팬츠", "청바지", "슬리퍼"]
   - 면접: ["청바지", "스니커즈", "후드", "반바지"]
   - 파티: ["운동화", "트레이닝복"]
   - 데일리: [] (제한 없음)

4. 컨셉 (concepts): 상황에 가장 어울리는 1-3개
   - 결혼식: ["클래식", "포멀", "럭셔리"]
   - 면접: ["포멀", "클래식", "모던"]
   - 데이트: ["로맨틱", "페미닌", "세련"]
   - 출근: ["클래식", "모던", "미니멀"]

반드시 유효한 JSON만 응답하세요.`;

  const stage1UserPrompt = `요청: "${userRequest.slice(0, 100)}"
타겟: ${gender} ${ageGroupLabel}
감지된 상황: ${occasion}

JSON 응답:
{
  "concepts": ["주요 컨셉 1-3개"],
  "formalityMin": 숫자,
  "formalityMax": 숫자,
  "requiredItems": ["필수 카테고리"],
  "excludeItems": ["제외할 아이템 종류"],
  "dressCodeHint": "한줄 드레스코드 설명",
  "colorSuggestions": ["추천 색상 1-2개"],
  "reasoning": "이 조건을 선택한 이유 (1-2문장)"
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STAGE1_TIMEOUT);
    
    const startTime = Date.now();
    
    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: stage1SystemPrompt },
            { role: 'user', content: stage1UserPrompt }
          ],
          max_tokens: 400,
          temperature: 0.3, // 일관성 중요
        }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    console.log(`[style-recommend] Stage 1 ${modelName} 응답: ${elapsed}ms`);
    
    if (!response.ok) {
      console.error(`[style-recommend] Stage 1 API 에러: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as Stage1Result;
      console.log(`[style-recommend] Stage 1 결과: concepts=${result.concepts?.join(',')}, formality=${result.formalityMin}-${result.formalityMax}, requiredItems=${result.requiredItems?.join(',')}`);
      return result;
    }
    
    console.warn('[style-recommend] Stage 1: JSON 파싱 실패');
    return null;
    
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn(`[style-recommend] Stage 1 ${modelName} 타임아웃 (15s)`);
    } else {
      console.error(`[style-recommend] Stage 1 ${modelName} 에러:`, e);
    }
    return null;
  }
}

// ============= 규칙 기반 Fallback 조건 생성 =============

function generateRuleBasedConditions(
  userRequest: string,
  requestedConcepts: string[],
  requestedOccasions: string[]
): Stage1Result {
  console.log('[style-recommend] 규칙 기반 fallback 조건 생성...');
  
  const requestLower = userRequest.toLowerCase();
  
  // TPO 매핑
  const OCCASION_RULES: Record<string, {
    formality: { min: number; max: number };
    requiredItems: string[];
    excludeItems: string[];
    concepts: string[];
    dressCodeHint: string;
  }> = {
    '결혼식': {
      formality: { min: 7, max: 10 },
      requiredItems: ['상의', '하의', '신발'],
      excludeItems: ['운동화', '후드티', '조거팬츠', '청바지', '슬리퍼', '스니커즈'],
      concepts: ['클래식', '포멀', '럭셔리'],
      dressCodeHint: '정장/원피스 + 구두/힐 필수'
    },
    '면접': {
      formality: { min: 7, max: 10 },
      requiredItems: ['상의', '하의', '신발'],
      excludeItems: ['청바지', '스니커즈', '후드', '반바지', '운동화'],
      concepts: ['포멀', '클래식', '모던'],
      dressCodeHint: '정장 셔츠/블라우스 + 슬랙스/정장스커트 + 구두'
    },
    '파티': {
      formality: { min: 6, max: 10 },
      requiredItems: ['상의', '하의', '신발'],
      excludeItems: ['운동화', '트레이닝복', '조거팬츠'],
      concepts: ['럭셔리', '페미닌', '클래식'],
      dressCodeHint: '드레시한 스타일 + 포멀한 신발'
    },
    '출근': {
      formality: { min: 5, max: 8 },
      requiredItems: ['상의', '하의'],
      excludeItems: ['후드티', '반바지', '슬리퍼'],
      concepts: ['클래식', '모던', '미니멀'],
      dressCodeHint: '깔끔한 오피스룩'
    },
    '데이트': {
      formality: { min: 4, max: 7 },
      requiredItems: ['상의', '하의'],
      excludeItems: [],
      concepts: ['로맨틱', '페미닌', '캐주얼'],
      dressCodeHint: '센스있는 데이트룩'
    },
    '데일리': {
      formality: { min: 2, max: 5 },
      requiredItems: ['상의', '하의'],
      excludeItems: [],
      concepts: ['캐주얼', '데일리'],
      dressCodeHint: '편안한 일상복'
    },
  };
  
  // 매칭되는 상황 찾기
  let matchedOccasion = '데일리';
  for (const [occ, rules] of Object.entries(OCCASION_RULES)) {
    const keywords = [occ.toLowerCase()];
    if (occ === '결혼식') keywords.push('웨딩', '하객', '청첩');
    if (occ === '면접') keywords.push('인터뷰', '취업', '입사');
    if (occ === '파티') keywords.push('행사', '돌잔치', '연회');
    if (occ === '출근') keywords.push('오피스', '회사', '비즈니스');
    if (occ === '데이트') keywords.push('소개팅', '만남');
    
    if (keywords.some(kw => requestLower.includes(kw))) {
      matchedOccasion = occ;
      break;
    }
  }
  
  const rules = OCCASION_RULES[matchedOccasion] || OCCASION_RULES['데일리'];
  
  return {
    concepts: rules.concepts,
    formalityMin: rules.formality.min,
    formalityMax: rules.formality.max,
    requiredItems: rules.requiredItems,
    excludeItems: rules.excludeItems,
    dressCodeHint: rules.dressCodeHint,
    colorSuggestions: [],
    reasoning: `규칙 기반: ${matchedOccasion} 상황 감지`
  };
}

// ============= 🔥 Stage 2: Gemini Flash 최종 선택 (with cross-fallback) =============

async function runStage2WithModel(
  modelName: string,
  stage1Result: Stage1Result,
  productListContext: string,
  userRequest: string,
  gender: string,
  ageGroupLabel: string,
  occasion: string,
  LOVABLE_API_KEY: string
): Promise<RAGStyleResponse | null> {
  console.log(`[style-recommend] Stage 2: ${modelName} 최종 선택 시작...`);
  
  const isFormalOccasion = stage1Result.formalityMin >= 7 || stage1Result.requiredItems.includes('신발');
  
  const stage2SystemPrompt = `당신은 세계 최고의 패션 스타일리스트이자 트렌드 큐레이터입니다.
당신의 멘트는 위트있고, 트렌디하며, 때로는 도발적입니다!

✨ 톤 & 매너:
- "~거든요", "~죠" 등 친근하지만 전문가다운 말투
- 패션 업계 은어와 트렌드 용어 적극 활용
- 브랜드 스토리와 디테일에 대한 해박한 지식 어필
- 마무리는 항상 유쾌하고 자신감 넘치게!

선택 규칙:
1. ${isFormalOccasion 
  ? `[필수] 상의 1개 + 하의(또는 원피스) 1개 + 신발 1개 (구두/로퍼/힐 권장)\n   [선택] 아우터/가방/액세서리 중 1개`
  : `[필수] 상의 1개 + 하의 1개\n   [자유] 아우터/신발/가방/액세서리 중 2개`}
2. 같은 브랜드 2개 금지
3. F값(격식도)이 비슷한 아이템끼리 조합 (±2 이내)
4. ⚠️ 제외 아이템은 절대 선택하지 마세요!

📝 styleReasoning 필수 구조:
1. 후킹 오프닝: "이 조합, 솔직히 천재적이에요." / "믿고 가세요, 이건 실패가 없어요." 등 자신감 넘치는 시작
2. 브랜드명과 상품명을 직접 언급하며 왜 이 조합인지 전문가적 분석
3. 컬러 매칭, 실루엣 밸런스, TPO 완벽 매칭 포인트 설명
4. "킬링 포인트?"로 마무리하며 핵심 아이템 or 조합의 백미 강조

🎯 위트 예시:
- "이 조합 보고 안 사시면, 솔직히 패션 테러입니다 😏"
- "지금 장바구니에 안 담으면 미래의 당신이 후회해요"
- "이건 찰떡궁합 그 자체예요. 마치 된장찌개에 두부 같은!"

반드시 유효한 JSON만 응답하세요.`;

  const excludeNote = stage1Result.excludeItems.length > 0 
    ? `\n⚠️ 제외 필수: ${stage1Result.excludeItems.join(', ')}` 
    : '';

  const stage2UserPrompt = `요청: "${userRequest.slice(0, 80)}"
타겟: ${gender} ${ageGroupLabel}
상황: ${occasion}

TPO 분석 결과 (Stage 1):
- 드레스코드: ${stage1Result.dressCodeHint}
- 격식도: F${stage1Result.formalityMin}~${stage1Result.formalityMax}
- 컨셉: ${stage1Result.concepts.join(', ')}
- 필수 아이템: ${stage1Result.requiredItems.join(', ')}${excludeNote}
- 분석 의견: ${stage1Result.reasoning}

상품 목록 (이미 조건에 맞게 필터링됨):
${productListContext}

${isFormalOccasion 
  ? `[필수] 상의 1개 + 하의 1개 + 신발 1개 (구두/로퍼/힐)`
  : `[필수] 상의 1개 + 하의 1개`}

JSON만 응답:
{"lookName":"캐치한 코디명","styleConcept":"이 룩의 무드 한줄","styleReasoning":"후킹 오프닝으로 시작...브랜드/상품명 직접 언급...킬링포인트?로 마무리","selectedProductIds":["id1","id2","id3","id4"]}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STAGE2_TIMEOUT);
    
    const startTime = Date.now();
    
    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: stage2SystemPrompt },
            { role: 'user', content: stage2UserPrompt }
          ],
          max_tokens: 800,
          temperature: 0.7, // 창의성 허용
        }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    console.log(`[style-recommend] Stage 2 ${modelName} 응답: ${elapsed}ms`);
    
    if (!response.ok) {
      console.error(`[style-recommend] Stage 2 API 에러: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as RAGStyleResponse;
      console.log(`[style-recommend] Stage 2 결과: ${result.selectedProductIds?.length}개 선택`);
      console.log(`[style-recommend] Selected IDs: ${result.selectedProductIds?.join(', ')}`);
      return result;
    }
    
    console.warn('[style-recommend] Stage 2: JSON 파싱 실패');
    return null;
    
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn(`[style-recommend] Stage 2 ${modelName} 타임아웃 (25s)`);
    } else {
      console.error(`[style-recommend] Stage 2 ${modelName} 에러:`, e);
    }
    return null;
  }
}

// ============= 어필리에이트 URL 생성 =============

async function generateAffiliateUrl(
  product: CachedProduct, 
  merchants: any[], 
  affiliateId: string
): Promise<string | null> {
  if (!product.product_url) return null;

  if (product.merchant_id) {
    const merchant = merchants.find(m => m.id === product.merchant_id);
    if (merchant?.deeplink_template) {
      const encodedUrl = encodeURIComponent(product.product_url);
      const affiliateUrl = merchant.deeplink_template
        .replace('{affiliate_id}', affiliateId)
        .replace('{encoded_url}', encodedUrl)
        .replace('{url}', encodedUrl);
      return affiliateUrl;
    }
  }

  try {
    const encodedUrl = encodeURIComponent(product.product_url);
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${affiliateId}&url=${encodedUrl}&mode=json`;
    
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const responseText = await response.text();
      try {
        const linkPriceData = JSON.parse(responseText);
        if (linkPriceData.result === 'S' && linkPriceData.url) {
          return linkPriceData.url;
        }
      } catch {
        if (responseText.startsWith('http')) {
          return responseText.trim();
        }
      }
    }
  } catch (error) {
    console.error('[generateAffiliateUrl] Error:', error);
  }

  return product.product_url;
}

function generatePatternKey(
  gender: string,
  occasion: string,
  concepts: string[],
  budget: number
): string {
  const budgetRange = Math.floor(budget / 100000) * 100000;
  const conceptsKey = concepts.sort().slice(0, 2).join('_');
  return `${gender}_${occasion}_${conceptsKey}_${budgetRange}`;
}

// ============= 메인 핸들러 =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestPayload: any = null;
  let userId: string | null = null;

  // 메트릭 초기화
  const metrics: InferenceMetrics = {
    stage1Model: 'openai/gpt-5-mini',
    stage2Model: 'google/gemini-2.5-flash',
    stage1TimeMs: 0,
    stage2TimeMs: 0,
    totalTimeMs: 0,
    stage1Success: false,
    stage2Success: false,
    usedFallback: false,
    fallbackReason: null,
    occasion: null,
    concepts: [],
    productCount: 0,
  };

  try {
    requestPayload = await req.json();
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false, age, ageGroup, stylePreferences } = requestPayload;
    userId = requestPayload.userId || null;

    if (!userRequest) {
      return new Response(JSON.stringify({ error: 'userRequest is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const LINKPRICE_AFFILIATE_ID = Deno.env.get('LINKPRICE_AFFILIATE_ID') || 'A100915488';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 모델 설정 조회 (동적 모델 로드)
    const { data: modelConfigData } = await supabase
      .from('model_config')
      .select('id, model_name')
      .eq('is_active', true);

    const modelConfig: Record<string, string> = {};
    if (modelConfigData) {
      for (const c of modelConfigData) {
        modelConfig[c.id] = c.model_name;
      }
    }

    const stage1Primary = modelConfig['stage1'] || 'openai/gpt-5-mini';
    const stage1Backup = modelConfig['stage1_backup'] || 'google/gemini-2.5-flash';
    const stage2Primary = modelConfig['stage2'] || 'google/gemini-2.5-flash';
    const stage2Backup = modelConfig['stage2_backup'] || 'openai/gpt-5-mini';

    metrics.stage1Model = stage1Primary;
    metrics.stage2Model = stage2Primary;

    const isKids = ageGroup === 'child' || (age !== undefined && age <= 12);
    const ageGroupLabel = ageGroup ? getAgeGroupLabel(ageGroup) : (age ? `${Math.floor(age / 10) * 10}대` : '성인');
    
    const requestedConcepts = extractConcepts(userRequest);
    const requestedOccasions = extractOccasions(userRequest);
    const occasion = requestedOccasions[0] || '캐주얼';
    const cacheKey = generateCacheKey(gender, userRequest.substring(0, 20), occasion, budget);
    const patternKey = generatePatternKey(gender, occasion, requestedConcepts, budget);
    
    metrics.occasion = occasion;
    
    console.log(`[style-recommend] v7.0 세계 최고 패셔니스타 + 하이브리드 2단계 + 교차 Fallback`);
    console.log(`[style-recommend] Request: "${userRequest}"`);
    console.log(`[style-recommend] Gender: ${gender}, Budget: ${budget}, Pattern: ${patternKey}`);
    console.log(`[style-recommend] Models: Stage1=${stage1Primary}/${stage1Backup}, Stage2=${stage2Primary}/${stage2Backup}`);

    // ============= PHASE 1: 캐시 체크 =============
    
    if (!forceRefresh) {
      const { data: cachedLook } = await supabase
        .from('style_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedLook && cachedLook.product_ids && cachedLook.product_ids.length >= 3) {
        console.log(`[style-recommend] Cache HIT! Key: ${cacheKey}`);
        
        const { data: cachedProducts } = await supabase
          .from('products_cache')
          .select('*')
          .in('id', cachedLook.product_ids)
          .eq('is_active', true);

        if (cachedProducts && cachedProducts.length >= 3) {
          await supabase
            .from('style_cache')
            .update({ use_count: (cachedLook.use_count || 0) + 1, last_used_at: new Date().toISOString() })
            .eq('id', cachedLook.id);

          const { data: merchants } = await supabase.from('merchants').select('*').eq('is_active', true);
          
          const lookItems: LookItem[] = [];
          for (const product of cachedProducts) {
            const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
            const displayCat = getDisplaySubCategory(product.category, product.sub_category, product.name, product.dna_meta);
            lookItems.push({
              category: displayCat,
              product,
              affiliateUrl,
              source: 'cache',
              isAutoSelected: true,
            });
          }

          const elapsed = Date.now() - startTime;
          console.log(`[style-recommend] Cache response in ${elapsed}ms`);

          // 캐시 히트도 위트 멘트 추가
          let cachedReasoning = cachedLook.style_reasoning || '';
          if (!cachedReasoning.includes('킬링 포인트') && !cachedReasoning.includes('✨')) {
            cachedReasoning = `${getRandomWittyOpener()} ${cachedReasoning} ${getRandomWittyCloser()}`;
          }

          return new Response(JSON.stringify({
            success: true,
            cacheHit: true,
            look: {
              name: cachedLook.look_name || '스타일 추천',
              styleConcept: cachedLook.style_concept || '',
              styleReasoning: cachedReasoning,
              items: lookItems,
              totalPrice: cachedProducts.reduce((sum, p) => sum + (p.price || 0), 0),
              stylingTips: '캐시된 추천입니다.',
              styleTags: cachedProducts.flatMap(p => p.style_tags || []).slice(0, 5),
            },
            apiCalls: { gpt5: 0, gemini: 0 },
            stats: { cached: true }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log(`[style-recommend] Cache MISS, generating new recommendation...`);

    // ============= 🔥 Stage 1: GPT TPO 분석 (교차 Fallback) =============
    
    let stage1Result: Stage1Result | null = null;
    let stage1Source = 'gpt';
    const stage1Start = Date.now();

    if (LOVABLE_API_KEY) {
      // 1차: Primary 모델
      stage1Result = await runStage1WithModel(
        stage1Primary,
        userRequest,
        gender,
        ageGroupLabel,
        occasion,
        LOVABLE_API_KEY
      );
      
      // 2차: Primary 실패 시 Backup 모델로 교차 Fallback
      if (!stage1Result) {
        console.log(`[style-recommend] Stage 1 ${stage1Primary} 실패, ${stage1Backup}으로 교차 Fallback...`);
        metrics.stage1Model = stage1Backup;
        stage1Result = await runStage1WithModel(
          stage1Backup,
          userRequest,
          gender,
          ageGroupLabel,
          occasion,
          LOVABLE_API_KEY
        );
        
        if (stage1Result) {
          metrics.usedFallback = true;
          metrics.fallbackReason = `stage1_cross_fallback_to_${stage1Backup.split('/')[1]}`;
        }
      }
      
      if (stage1Result) {
        metrics.stage1Success = true;
        console.log(`[style-recommend] Stage 1 성공: ${stage1Result.reasoning}`);
      } else {
        // 3차: 둘 다 실패 시 규칙 기반
        stage1Result = generateRuleBasedConditions(userRequest, requestedConcepts, requestedOccasions);
        stage1Source = 'fallback';
        metrics.usedFallback = true;
        metrics.fallbackReason = 'stage1_rule_based';
        console.log(`[style-recommend] Stage 1 AI 실패, 규칙 기반 fallback 사용`);
      }
    } else {
      stage1Result = generateRuleBasedConditions(userRequest, requestedConcepts, requestedOccasions);
      stage1Source = 'fallback';
      metrics.usedFallback = true;
      metrics.fallbackReason = 'no_api_key';
    }

    metrics.stage1TimeMs = Date.now() - stage1Start;
    metrics.concepts = stage1Result.concepts;

    // ============= Stage 1 결과 기반 DB 쿼리 =============
    
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? '봄' 
      : currentMonth >= 6 && currentMonth <= 8 ? '여름'
      : currentMonth >= 9 && currentMonth <= 11 ? '가을' : '겨울';
    const requestedSeason = detectSeason(userRequest) || currentSeason;
    const seasonMap: Record<string, string> = { '봄': 'spring', '여름': 'summer', '가을': 'fall', '겨울': 'winter' };
    const seasonEn = seasonMap[requestedSeason] || 'spring';

    const productsByPriority: Record<string, CachedProduct[]> = {
      '상의': [],
      '하의': [],
      '아우터': [],
      '기타': [],
      'unknown': []
    };

    // DB 쿼리
    let query = supabase
      .from('products_cache')
      .select('*, dna_text, dna_meta, dna_generated_at')
      .eq('is_active', true)
      .eq('is_in_stock', true)
      .not('image_url', 'is', null)
      .not('dna_meta', 'is', null);

    const { data: allProductsRaw, error: productError } = await query
      .order('dna_generated_at', { ascending: false, nullsFirst: false })
      .limit(500);
    
    if (productError) {
      console.error('[style-recommend] Product fetch error:', productError);
    }
    
    // 피드백 점수 조회
    const { data: feedbackScores } = await supabase
      .from('product_feedback_scores')
      .select('product_id, overall_score, style_weights');
    
    const feedbackMap = new Map<string, { score: number; weights: Record<string, number> }>();
    if (feedbackScores) {
      for (const fs of feedbackScores) {
        feedbackMap.set(fs.product_id, {
          score: parseFloat(fs.overall_score) || 0.5,
          weights: fs.style_weights || {}
        });
      }
    }
    
    let allProducts: CachedProduct[] = (allProductsRaw || []).map(p => {
      const feedback = feedbackMap.get(p.id);
      return {
        ...p,
        feedback_score: feedback?.score || 0.5,
        style_weights: feedback?.weights || {}
      };
    });
    console.log(`[style-recommend] Raw products: ${allProducts.length}`);
    
    // 스타일 무관 상품 필터링
    allProducts = allProducts.filter(p => isStyleRelevantProduct(p));
    console.log(`[style-recommend] After style filter: ${allProducts.length}`);
    
    // 타겟 필터링
    allProducts = filterByTarget(allProducts, isKids, gender);
    console.log(`[style-recommend] After target filter: ${allProducts.length}`);
    
    // 시즌 필터링
    const seasonExcludeKeywords: Record<string, string[]> = {
      '겨울': ['shorts', '반바지', '샌들', 'sandal', '민소매', 'sleeveless', 'crop', '크롭', '린넨', 'linen', '슬리퍼'],
      '여름': ['패딩', 'padding', 'puffer', '코트', 'coat', '기모', '털', 'fur', '울', 'wool', '캐시미어', '다운', 'down'],
      '봄': ['패딩', 'padding', 'puffer', '기모', '털', 'fur'],
      '가을': ['샌들', 'sandal', '슬리퍼', '반바지', 'shorts'],
    };
    
    const excludeKeywords = seasonExcludeKeywords[requestedSeason] || [];
    
    allProducts = allProducts.filter(product => {
      const combined = `${product.name} ${product.category} ${product.sub_category || ''}`.toLowerCase();
      
      if (product.dna_meta?.season_fit) {
        if (!product.dna_meta.season_fit.includes(seasonEn)) {
          return false;
        }
      }
      
      return !excludeKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
    });
    console.log(`[style-recommend] After season filter: ${allProducts.length}`);
    
    // ============= Stage 1 결과 기반 필터링 =============
    
    // Formality 필터
    let filteredProducts = allProducts.filter(p => {
      const meta = p.dna_meta;
      if (!meta) return false;
      return meta.formality >= stage1Result.formalityMin && 
             meta.formality <= stage1Result.formalityMax;
    });
    console.log(`[style-recommend] After formality filter (${stage1Result.formalityMin}-${stage1Result.formalityMax}): ${filteredProducts.length}`);
    
    // 제외 아이템 필터 (Stage 1에서 지정한 제외 아이템)
    if (stage1Result.excludeItems.length > 0) {
      const beforeExclude = filteredProducts.length;
      filteredProducts = filteredProducts.filter(p => {
        const combined = `${p.name} ${p.category} ${p.sub_category || ''}`.toLowerCase();
        return !stage1Result.excludeItems.some(ex => combined.includes(ex.toLowerCase()));
      });
      console.log(`[style-recommend] After exclude filter: ${beforeExclude} → ${filteredProducts.length}`);
    }
    
    // 컨셉 매칭 필터 (너무 적으면 완화)
    const CONCEPT_FALLBACK: Record<string, string[]> = {
      '클래식': ['포멀', '모던', '미니멀'],
      '포멀': ['클래식', '모던'],
      '럭셔리': ['클래식', '포멀', '모던'],
      '밀리터리': ['캐주얼', '스트릿', '미니멀'],
      '고프코어': ['스포티', '캐주얼', '미니멀'],
      '올드머니': ['클래식', '포멀', '모던'],
    };
    
    let conceptFilteredProducts = filteredProducts.filter(p => {
      const meta = p.dna_meta;
      if (!meta || !meta.concepts) return false;
      
      const productConcepts = meta.concepts.map(c => normalizeConcept(c));
      const requestConcepts = stage1Result.concepts.map(c => normalizeConcept(c));
      
      return productConcepts.some(pc => 
        requestConcepts.some(rc => pc.includes(rc) || rc.includes(pc))
      );
    });
    
    // 컨셉 필터 결과가 너무 적으면 fallback
    if (conceptFilteredProducts.length < 15) {
      console.log(`[style-recommend] Concept filter too strict (${conceptFilteredProducts.length}), trying fallback...`);
      
      let fallbackConcepts: string[] = [];
      for (const concept of stage1Result.concepts) {
        const fallbacks = CONCEPT_FALLBACK[concept] || [];
        fallbackConcepts.push(...fallbacks);
      }
      fallbackConcepts = [...new Set(fallbackConcepts)];
      
      if (fallbackConcepts.length > 0) {
        const fallbackFiltered = filteredProducts.filter(p => {
          const meta = p.dna_meta;
          if (!meta || !meta.concepts) return false;
          
          const productConcepts = meta.concepts.map(c => normalizeConcept(c));
          return productConcepts.some(pc => 
            fallbackConcepts.some(fc => pc.includes(normalizeConcept(fc)))
          );
        });
        
        const existingIds = new Set(conceptFilteredProducts.map(p => p.id));
        for (const p of fallbackFiltered) {
          if (!existingIds.has(p.id)) {
            conceptFilteredProducts.push(p);
          }
        }
        console.log(`[style-recommend] After fallback concepts: ${conceptFilteredProducts.length}`);
      }
    }
    
    // 그래도 적으면 formality만으로 사용
    if (conceptFilteredProducts.length < 15) {
      console.log(`[style-recommend] Still too few, using formality-only filter`);
      conceptFilteredProducts = filteredProducts;
    }
    
    allProducts = conceptFilteredProducts;
    console.log(`[style-recommend] Final filtered products: ${allProducts.length}`);
    metrics.productCount = allProducts.length;
    
    // ============= 점수 계산 및 카테고리 분류 =============
    
    const scoredProducts = allProducts.map(p => {
      const feedbackScore = p.feedback_score || 0.5;
      const conceptScore = calculateConceptScore(p, stage1Result.concepts);
      
      let formalityScore = 0;
      if (p.dna_meta?.formality !== undefined) {
        const targetFormality = (stage1Result.formalityMin + stage1Result.formalityMax) / 2;
        const diff = Math.abs(p.dna_meta.formality - targetFormality);
        formalityScore = Math.max(0, 1 - diff * 0.15);
      }
      
      const totalScore = (feedbackScore * 0.3) + (conceptScore * 0.4) + (formalityScore * 0.3);
      
      return { product: p, score: totalScore };
    });
    
    scoredProducts.sort((a, b) => b.score - a.score);
    
    // 카테고리별 분류
    for (const { product } of scoredProducts) {
      const priorityCat = product.dna_meta?.item_slot
        ? itemSlotToPriorityCategory(product.dna_meta.item_slot, product.name)
        : mapToPriorityCategory(product.category, product.sub_category, product.name);
      
      if (priorityCat && productsByPriority[priorityCat]) {
        productsByPriority[priorityCat].push(product);
      }
    }
    
    const dnaStats = {
      withMeta: allProducts.filter(p => p.dna_meta).length,
      withoutMeta: allProducts.filter(p => !p.dna_meta).length
    };
    console.log(`[style-recommend] Products: 상의=${productsByPriority['상의']?.length}, 하의=${productsByPriority['하의']?.length}, 아우터=${productsByPriority['아우터']?.length}, 기타=${productsByPriority['기타']?.length}`);

    const topScoredProducts = scoredProducts.slice(0, 50);
    const uniqueProducts = topScoredProducts.map(s => s.product);
    
    if (uniqueProducts.length === 0) {
      metrics.totalTimeMs = Date.now() - startTime;
      await saveInferenceMetrics(supabase, metrics, userId);
      
      return new Response(JSON.stringify({
        success: false,
        error: '추천할 수 있는 상품이 없습니다.',
        look: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= 🔥 Stage 2: Gemini Flash 최종 선택 (교차 Fallback) =============
    
    // GPT에 보낼 상품 목록 준비
    const getProductsForStage2 = () => {
      const result: CachedProduct[] = [];
      
      for (const cat of CATEGORY_PRIORITY) {
        const catProducts = productsByPriority[cat] || [];
        let selectedFromCat = 0;
        const maxPerCategory = 6;
        
        for (const p of catProducts) {
          if (selectedFromCat >= maxPerCategory) break;
          
          const brand = p.brand || 'unknown';
          const brandCountInCat = result.filter(r => r.brand === brand).length;
          if (brandCountInCat < 2) {
            result.push(p);
            selectedFromCat++;
          }
        }
      }
      
      return result;
    };
    
    const stage2Products = getProductsForStage2();
    console.log(`[style-recommend] Stage 2 상품 수: ${stage2Products.length}`);
    
    // 상품 컨텍스트 생성
    const productListContext = stage2Products.map(p => {
      const concepts = p.dna_meta?.concepts?.slice(0, 2).join('/') || '';
      // color_family 배열 처리
      const colorFamily = p.dna_meta?.color_family;
      const color = Array.isArray(colorFamily) ? colorFamily.join('/') : (colorFamily || '');
      const slot = p.dna_meta?.item_slot || 'unknown';
      return `${p.id}|${p.brand || ''}|${p.name.slice(0, 25)}|${slot}|₩${Math.floor(p.price/1000)}k|F${p.dna_meta?.formality || 5}|${concepts}|${color}`;
    }).join('\n');

    let ragResponse: RAGStyleResponse | null = null;
    let apiCalls = { gpt5: 1, gemini: 0 };
    const stage2Start = Date.now();
    
    if (LOVABLE_API_KEY && stage2Products.length > 0) {
      // 1차: Primary 모델
      ragResponse = await runStage2WithModel(
        stage2Primary,
        stage1Result,
        productListContext,
        userRequest,
        gender,
        ageGroupLabel,
        occasion,
        LOVABLE_API_KEY
      );
      
      // 2차: Primary 실패 시 Backup 모델로 교차 Fallback
      if (!ragResponse) {
        console.log(`[style-recommend] Stage 2 ${stage2Primary} 실패, ${stage2Backup}으로 교차 Fallback...`);
        metrics.stage2Model = stage2Backup;
        ragResponse = await runStage2WithModel(
          stage2Backup,
          stage1Result,
          productListContext,
          userRequest,
          gender,
          ageGroupLabel,
          occasion,
          LOVABLE_API_KEY
        );
        
        if (ragResponse) {
          if (!metrics.usedFallback) {
            metrics.usedFallback = true;
            metrics.fallbackReason = `stage2_cross_fallback_to_${stage2Backup.split('/')[1]}`;
          } else {
            metrics.fallbackReason += `+stage2_cross_fallback`;
          }
        }
      }
      
      if (ragResponse) {
        apiCalls.gemini = 1;
        metrics.stage2Success = true;
        console.log(`[style-recommend] Stage 2 성공: ${ragResponse.selectedProductIds?.length}개 선택`);
      }
    }

    metrics.stage2TimeMs = Date.now() - stage2Start;

    // 3차: AI 모두 실패 시 점수 기반 자동 선택
    if (!ragResponse) {
      console.log(`[style-recommend] AI 실패, 점수 기반 fallback 선택`);
      
      if (!metrics.usedFallback) {
        metrics.usedFallback = true;
        metrics.fallbackReason = 'stage2_auto_select';
      } else {
        metrics.fallbackReason += '+stage2_auto_select';
      }
      
      const selectedIds: string[] = [];
      let lastFormality = (stage1Result.formalityMin + stage1Result.formalityMax) / 2;
      
      // 필수 카테고리 우선 선택
      const isFormalOccasion = stage1Result.formalityMin >= 7 || stage1Result.requiredItems.includes('신발');
      const categoryOrder = isFormalOccasion 
        ? ['상의', '하의', '기타', '아우터']  // 포멀 상황: 신발(기타) 우선
        : CATEGORY_PRIORITY;
      
      for (const cat of categoryOrder) {
        if (selectedIds.length >= 4) break;
        
        let catProducts = productsByPriority[cat] || [];
        
        // Formality 유사도로 정렬
        catProducts = catProducts.sort((a, b) => {
          const fA = a.dna_meta?.formality || 5;
          const fB = b.dna_meta?.formality || 5;
          return Math.abs(fA - lastFormality) - Math.abs(fB - lastFormality);
        });
        
        // 포멀 상황에서 '기타'는 신발 우선
        if (isFormalOccasion && cat === '기타') {
          const shoesFirst = catProducts.filter(p => p.dna_meta?.item_slot === 'shoes');
          const others = catProducts.filter(p => p.dna_meta?.item_slot !== 'shoes');
          catProducts = [...shoesFirst, ...others];
        }
        
        if (catProducts.length > 0) {
          const selected = catProducts[0];
          selectedIds.push(selected.id);
          lastFormality = selected.dna_meta?.formality || lastFormality;
        }
      }
      
      // Fallback reasoning 생성 (위트 멘트 추가!)
      const selectedFallbackProducts = selectedIds.map(id => {
        for (const cat of CATEGORY_PRIORITY) {
          const found = productsByPriority[cat]?.find(p => p.id === id);
          if (found) return found;
        }
        return null;
      }).filter(Boolean);
      
      const fallbackBrands = [...new Set(selectedFallbackProducts.map(p => p?.brand).filter(Boolean))].slice(0, 2);
      const fallbackConcepts = stage1Result.concepts;
      
      // 🎭 세계 최고 패셔니스타 위트 멘트!
      let fallbackReasoning = getRandomWittyOpener() + ' ';
      
      if (fallbackConcepts.length > 0) {
        fallbackReasoning += `이 룩의 핵심은 '${fallbackConcepts[0]}' 무드거든요. `;
      }
      
      const topProduct = selectedFallbackProducts.find(p => p?.dna_meta?.item_slot === 'top');
      const bottomProduct = selectedFallbackProducts.find(p => p?.dna_meta?.item_slot === 'bottom' || p?.dna_meta?.item_slot === 'dress');
      
      if (topProduct && bottomProduct) {
        fallbackReasoning += `${topProduct.brand || ''} ${(topProduct.name || '').split(' ').slice(0, 2).join(' ')}이(가) 상체 비율을 잡아주고, ${bottomProduct.brand || ''} ${(bottomProduct.name || '').split(' ').slice(0, 2).join(' ')}이(가) 하체 라인을 정돈해줘요. `;
      }
      
      fallbackReasoning += getRandomWittyCloser();
      
      ragResponse = {
        lookName: `${stage1Result.concepts[0] || '스타일'} ${gender} ${occasion} 룩`,
        styleConcept: `👗 "${fallbackBrands.join(' × ')}" 브랜드로 완성한 ${occasion} 스타일`,
        styleReasoning: fallbackReasoning,
        selectedProductIds: selectedIds,
        stylingTips: stage1Result.dressCodeHint
      };
    }

    // ============= 최종 아이템 구성 =============
    
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    const lookItems: LookItem[] = [];
    const usedCategories = new Set<string>();
    
    const gptSelectedIds = ragResponse.selectedProductIds || [];
    
    if (selectedProducts && selectedProducts.length > 0) {
      const sortedProducts = gptSelectedIds
        .map(id => selectedProducts.find(p => p.id === id))
        .filter(Boolean) as typeof selectedProducts;
      
      for (const product of sortedProducts) {
        const priorityCat = product.dna_meta?.item_slot
          ? itemSlotToPriorityCategory(product.dna_meta.item_slot)
          : mapToPriorityCategory(product.category, product.sub_category, product.name);
        const displayCat = getDisplaySubCategory(product.category, product.sub_category, product.name, product.dna_meta);
        
        if (priorityCat === 'unknown') continue;
        if (usedCategories.has(priorityCat)) continue;
        
        usedCategories.add(priorityCat);
        
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        
        lookItems.push({
          category: displayCat,
          product: product,
          affiliateUrl,
          source: 'cache',
          isAutoSelected: true
        });
      }
    }

    // 최소 4개 보장
    const MIN_ITEMS = 4;
    let lastFormality = stage1Result.formalityMin + (stage1Result.formalityMax - stage1Result.formalityMin) / 2;
    let wasAutoFilled = false;
    
    if (lookItems.length > 0 && lookItems[0].product?.dna_meta?.formality) {
      lastFormality = lookItems[0].product.dna_meta.formality;
    }

    while (lookItems.length < MIN_ITEMS) {
      for (const cat of CATEGORY_PRIORITY) {
        if (lookItems.length >= MIN_ITEMS) break;
        if (usedCategories.has(cat)) continue;
        
        let catProducts = productsByPriority[cat] || [];
        
        // Formality 유사도로 정렬
        catProducts = catProducts.sort((a, b) => {
          const fA = a.dna_meta?.formality || 5;
          const fB = b.dna_meta?.formality || 5;
          return Math.abs(fA - lastFormality) - Math.abs(fB - lastFormality);
        });
        
        if (catProducts.length > 0) {
          const selectedProduct = catProducts[0];
          usedCategories.add(cat);
          wasAutoFilled = true;
          
          const affiliateUrl = await generateAffiliateUrl(selectedProduct, merchants || [], LINKPRICE_AFFILIATE_ID);
          const displayCat = getDisplaySubCategory(selectedProduct.category, selectedProduct.sub_category, selectedProduct.name, selectedProduct.dna_meta);
          
          lookItems.push({
            category: displayCat,
            product: selectedProduct,
            affiliateUrl,
            source: 'cache',
            isAutoSelected: true
          });
          
          if (selectedProduct.dna_meta?.formality) {
            lastFormality = selectedProduct.dna_meta.formality;
          }
        }
      }
      
      if (lookItems.length < MIN_ITEMS && 
          usedCategories.size >= Object.keys(productsByPriority).filter(k => productsByPriority[k].length > 0).length) {
        break;
      }
    }

    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const styleTags = [...new Set(lookItems.flatMap(item => item.product?.style_tags || []))].slice(0, 5);

    // 캐시 저장
    if (lookItems.length >= 3) {
      const productIds = lookItems.map(item => item.product?.id).filter(Boolean);
      
      await supabase
        .from('style_cache')
        .upsert({
          cache_key: cacheKey,
          image_url: lookItems[0]?.product?.image_url || '',
          product_ids: productIds,
          look_name: ragResponse.lookName,
          style_concept: ragResponse.styleConcept,
          style_reasoning: ragResponse.styleReasoning,
          use_count: 1,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, {
          onConflict: 'cache_key'
        });
    }

    const elapsed = Date.now() - startTime;
    metrics.totalTimeMs = elapsed;
    
    // 메트릭 저장
    await saveInferenceMetrics(supabase, metrics, userId);
    
    console.log(`[style-recommend] Response in ${elapsed}ms, ${lookItems.length} items, Stage1: ${metrics.stage1TimeMs}ms, Stage2: ${metrics.stage2TimeMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      cacheHit: false,
      look: {
        name: ragResponse.lookName,
        styleConcept: ragResponse.styleConcept,
        styleReasoning: ragResponse.styleReasoning,
        items: lookItems,
        totalPrice,
        stylingTips: ragResponse.stylingTips || stage1Result.dressCodeHint,
        styleTags,
      },
      apiCalls,
      stats: {
        requestedItems: 4,
        foundInCache: lookItems.length,
        foundViaSerpapi: 0,
        notFound: 0,
        dnaStats,
        wasAutoFilled,
        stage1Source,
        stage1Concepts: stage1Result.concepts,
        stage1Formality: `${stage1Result.formalityMin}-${stage1Result.formalityMax}`,
        metricsRecorded: true,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    metrics.totalTimeMs = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[style-recommend] Error:', errorMessage);
    
    // 에러 로깅
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await logError(
        supabase,
        'style-recommend',
        'INTERNAL_ERROR',
        errorMessage,
        userId,
        requestPayload,
        metrics.totalTimeMs
      );
      
      await saveInferenceMetrics(supabase, metrics, userId);
    } catch (logErr) {
      console.error('[style-recommend] Failed to log error:', logErr);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      look: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
