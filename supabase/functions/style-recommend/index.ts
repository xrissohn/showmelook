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
  collected_at: string | null;
  feedback_score?: number;
  style_weights?: Record<string, number>;
}

// ============= 페이지네이션 헬퍼 (1000행 제한 우회) =============
async function fetchAllProducts(supabase: any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  const allData: any[] = [];
  let from = 0;

  while (from < 10000) { // 최대 10,000개 안전장치
    const { data, error } = await supabase
      .from('products_cache')
      .select('*, dna_text, dna_meta, dna_generated_at, collected_at')
      .eq('is_active', true)
      .eq('is_in_stock', true)
      .not('image_url', 'is', null)
      .not('dna_meta', 'is', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[style-recommend] Pagination error at offset ${from}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // 마지막 페이지
    from += PAGE_SIZE;
  }

  console.log(`[style-recommend] Paginated fetch: ${allData.length} products in ${Math.ceil(from / PAGE_SIZE) + (allData.length > 0 ? 0 : -1) + 1} pages`);
  return allData;
}

// ============= Freshness Boost (신상품 가산점) =============
function calculateFreshnessBoost(collectedAt: string | null): number {
  if (!collectedAt) return 0;
  const daysOld = (Date.now() - new Date(collectedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld <= 3) return 0.15;
  if (daysOld <= 7) return 0.10;
  if (daysOld <= 14) return 0.05;
  return 0;
}

function isNewProduct(collectedAt: string | null): boolean {
  if (!collectedAt) return false;
  const daysOld = (Date.now() - new Date(collectedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysOld <= 14;
}

interface LookItem {
  category: string;
  product: CachedProduct | null;
  affiliateUrl: string | null;
  source: 'cache' | 'none';
  isAutoSelected: boolean;
}

// Category priority - 신발을 별도 카테고리로 분리하여 4개 이상 추천 보장
const CATEGORY_PRIORITY = ['상의', '하의', '신발', '아우터', '액세서리'];
const REQUIRED_CATEGORIES = ['상의', '하의'];
const OPTIONAL_CATEGORIES = ['신발', '아우터', '액세서리'];

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

// 🔥 세트상품 키워드 (상의+하의 합쳐진 세트 - 피팅 시 분리 적용 필요)
// 세트상품은 제외하지 않고, 추천 시 상의 슬롯이면 상의로만, 하의 슬롯이면 하의로만 피팅
const SET_PRODUCT_KEYWORDS = [
  '[set]', '[SET]', '(set)', '(SET)', 'set]', 'SET]',
  '세트', '상하세트', '트레이닝세트', '운동세트', '조거세트',
  'hood & jogger', 'hoodie & jogger', '후드 & 조거', '후드앤조거',
  'sweat set', 'tracksuit set', 'training set',
];

// 세트상품인지 확인하는 함수 (제외용이 아닌 분류용)
function isSetProduct(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const lower = productName.toLowerCase();
  return SET_PRODUCT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// 키즈/주니어 상품 키워드 (성인에게 추천하지 않음)
const KIDS_PRODUCT_KEYWORDS = [
  '키즈', 'kids', 'kid', '주니어', 'junior', 'jr', '아동', '어린이', '유아', '베이비', 'baby',
  '아기', '초등', '소아', '남아', '여아', '아동용', '키즈용', '어린이용', '유아용',
  'children', 'child', 'toddler', 'infant', 'boys', 'girls',
];

// 🔥 여성 전용 브랜드 (남성에게 추천하지 않음)
const FEMALE_ONLY_BRANDS = [
  '제이에스티나', 'j.estina', 'jestina', 'j estina',
  '미샤', 'missha', '에뛰드', 'etude', '이니스프리', 'innisfree',
  '랑콤', 'lancome', '에스티로더', 'estee lauder',
  '빅토리아시크릿', 'victoria secret', "victoria's secret",
  '라펠라', 'la perla', '에이전트프로보케이터', 'agent provocateur',
  '마리끌레르', 'marie claire',
];

// 🔥 남성 전용 브랜드 (여성에게 추천하지 않음)
const MALE_ONLY_BRANDS = [
  '지오다노맨', 'giordano men',
  // 대부분의 브랜드는 유니섹스 또는 양성 라인이 있으므로 최소화
];

function isStyleRelevantProduct(product: CachedProduct): boolean {
  const combined = `${product.name || ''} ${product.category || ''} ${product.sub_category || ''} ${product.brand || ''}`.toLowerCase();
  
  if (EXCLUDED_PRODUCT_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()))) {
    return false;
  }
  
  // 🔥 세트상품은 제외하지 않음 - 대신 추천 시 상의/하의 슬롯에 맞게 분리 피팅
  // (세트상품도 상의로 추천되면 상의 파트만, 하의로 추천되면 하의 파트만 피팅됨)
  if (isSetProduct(product.name)) {
    console.log(`[style-recommend] 세트상품 발견 (포함): ${product.name}`);
    // 세트상품은 포함하되, 카테고리가 명확해야 함
    // category가 '상의' 또는 '하의'로 지정되어 있으면 OK
    const cat = (product.category || '').toLowerCase();
    if (!cat.includes('상의') && !cat.includes('하의') && !cat.includes('top') && !cat.includes('bottom')) {
      // 카테고리가 불명확한 세트상품은 제외
      console.log(`[style-recommend] 카테고리 불명확 세트상품 제외: ${product.name}`);
      return false;
    }
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

// 🔥 성별 기반 브랜드 필터링
function filterByGenderBrand(products: CachedProduct[], gender: string): CachedProduct[] {
  return products.filter(p => {
    const brand = (p.brand || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const combined = `${brand} ${name}`;
    
    // 남성인 경우 여성 전용 브랜드 제외
    if (gender === '남성' || gender === 'male') {
      if (FEMALE_ONLY_BRANDS.some(b => combined.includes(b))) {
        return false;
      }
      // dna_meta.target이 명시적으로 female인 경우 제외
      const target = p.dna_meta?.target?.toString() || '';
      if (target === 'adult_female' || target === 'female') {
        return false;
      }
    }
    
    // 여성인 경우 남성 전용 브랜드 제외
    if (gender === '여성' || gender === 'female') {
      if (MALE_ONLY_BRANDS.some(b => combined.includes(b))) {
        return false;
      }
      // dna_meta.target이 명시적으로 male인 경우 제외
      const target = p.dna_meta?.target?.toString() || '';
      if (target === 'adult_male' || target === 'male') {
        return false;
      }
    }
    
    return true;
  });
}

// 성인 사용자에게 키즈/주니어 상품 필터링
function filterKidsProductsForAdults(products: CachedProduct[], isKids: boolean): CachedProduct[] {
  // 키즈 모드면 키즈 상품만 허용
  if (isKids) {
    return products.filter(p => {
      const combined = `${p.name || ''} ${p.category || ''} ${p.sub_category || ''} ${p.brand || ''}`.toLowerCase();
      // 키즈 키워드가 있거나 dna_meta.target이 kids인 상품만
      const hasKidsKeyword = KIDS_PRODUCT_KEYWORDS.some(kw => combined.includes(kw));
      const isKidsTarget = p.dna_meta?.target?.toString().includes('kids') || false;
      return hasKidsKeyword || isKidsTarget;
    });
  }
  
  // 성인 모드면 키즈 상품 제외
  return products.filter(p => {
    const combined = `${p.name || ''} ${p.category || ''} ${p.sub_category || ''} ${p.brand || ''}`.toLowerCase();
    
    // 키즈 키워드가 있으면 제외
    if (KIDS_PRODUCT_KEYWORDS.some(kw => combined.includes(kw))) {
      return false;
    }
    
    // dna_meta.target이 kids로 시작하면 제외
    if (p.dna_meta?.target?.toString().startsWith('kids')) {
      return false;
    }
    
    return true;
  });
}

// 가방 키워드 체크 (버킷백은 가방, 버킷햇은 모자!)
const BAG_KEYWORDS = [
  '가방', 'bag', 'bags', '백', '토트', 'tote', '숄더', 'shoulder', 
  '크로스백', 'crossbody', '클러치', 'clutch', '백팩', 'backpack', 
  '파우치', 'pouch', '호보', 'hobo', '새들', 'saddle', '버킷백', 'bucket bag',
  '미니백', 'minibag', '에코백', 'ecobag', '캔버스백', 'canvas bag'
];

// 🎩 모자/액세서리 키워드 체크
const HAT_ACCESSORY_KEYWORDS = [
  '햇', 'hat', '캡', 'cap', '모자', '비니', 'beanie', '버킷햇', 'bucket hat',
  '버뮤다', 'bermuda', '스냅백', 'snapback', '볼캡', '야구모자', 'baseball cap',
  '페도라', 'fedora', '파나마', 'panama', '베레모', 'beret'
];

function hasHatKeyword(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const lower = productName.toLowerCase();
  // 버킷햇, 버뮤다 버킷햇 등은 모자로 인식
  return HAT_ACCESSORY_KEYWORDS.some(kw => lower.includes(kw));
}

function hasBagKeyword(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const lower = productName.toLowerCase();
  // 버킷햇/모자 키워드가 있으면 가방이 아님!
  if (hasHatKeyword(productName)) return false;
  return BAG_KEYWORDS.some(kw => lower.includes(kw));
}

// isSetProduct 함수는 위에서 정의됨 (line 273)

function itemSlotToPriorityCategory(itemSlot: string | undefined, productName?: string | null): string {
  // 모자 키워드가 있으면 액세서리
  if (hasHatKeyword(productName)) {
    return '액세서리';
  }
  
  if (hasBagKeyword(productName)) {
    return '액세서리';  // 가방도 액세서리로 통합
  }
  
  if (!itemSlot) return 'unknown';
  
  switch (itemSlot) {
    case 'top': return '상의';
    case 'bottom': 
    case 'dress': return '하의';
    case 'outer': return '아우터';
    case 'shoes': return '신발';  // 🔥 신발은 별도 카테고리
    case 'bag':
    case 'accessory': return '액세서리';
    default: return 'unknown';
  }
}

function mapToPriorityCategory(category: string, subCategory?: string | null, productName?: string | null): string {
  const combined = `${category || ''} ${subCategory || ''} ${productName || ''}`.toLowerCase();
  
  if (['가방', 'bag', 'bags', '백', '토트', 'tote', '숄더', 'shoulder', '크로스백', 'crossbody', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch'].some(v => combined.includes(v))) {
    return '액세서리';
  }
  
  if (['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'jackets', 'coats', '패딩', 'padding', 'puffer', 'blazer', '블레이저', '야상', '트렌치', 'trench'].some(v => combined.includes(v))) {
    if (['니트', 'knit', '스웨터', 'sweater', '티셔츠', 't-shirt', '맨투맨'].some(v => combined.includes(v))) {
      return '상의';
    }
    if (['가방', 'bag', '토트', 'tote', '백팩', 'backpack'].some(v => combined.includes(v))) {
      return '액세서리';
    }
    return '아우터';
  }
  
  if (['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'shirts', 'polo', 'sweater', '스웨터', '맨투맨', '후드', 'hoodie'].some(v => combined.includes(v))) {
    return '상의';
  }
  
  if (['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress', 'dresses', '드레스', 'shorts', '반바지', 'leggings', '레깅스', '슬랙스', 'slacks'].some(v => combined.includes(v))) {
    return '하의';
  }
  
  // 🔥 신발은 별도 카테고리로 분리
  const isBootcut = combined.includes('bootcut') || combined.includes('부츠컷');
  if (!isBootcut && ['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'loafers', '로퍼', '힐'].some(v => combined.includes(v))) {
    return '신발';
  }
  
  // 가방, 액세서리는 '액세서리'로 통합
  if (['가방', 'bag', 'bags', '백', '클러치', 'tote', '액세서리', 'accessory', 'accessories', '스카프', '모자', 'hat', '벨트', 'belt', '목걸이', '반지', '귀걸이', '팔찌', '시계', '선글라스'].some(v => combined.includes(v))) {
    return '액세서리';
  }
  
  if (['여성', '남성', '여성의류', '남성의류', '라이프', '뷰티', '키즈', '골프', '스포츠', '명품'].includes(category)) {
    return 'unknown';
  }
  
  return 'unknown';
}

function getDisplaySubCategory(category: string, subCategory?: string | null, productName?: string | null, dnaMeta?: DNAMeta | null): string {
  // 🎩 모자/햇 키워드 우선 체크 (버킷햇이 가방으로 잘못 분류되는 것 방지)
  if (hasHatKeyword(productName)) {
    return '액세서리';
  }
  
  if (dnaMeta?.item_slot) {
    // 🔥 item_slot이 'bag'이지만 실제로 모자인 경우 보정
    if (dnaMeta.item_slot === 'bag' && hasHatKeyword(productName)) {
      return '액세서리';
    }
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
  
  // 🎩 모자/햇 키워드 체크 (가방보다 우선)
  if (['햇', 'hat', '캡', 'cap', '모자', '비니', 'beanie', '버킷햇', '버뮤다', 'bucket hat', '스냅백', 'snapback', '볼캡', '페도라', '베레모'].some(v => combined.includes(v))) {
    return '액세서리';
  }
  
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
  if (['목걸이', 'necklace', '팔찌', 'bracelet', '반지', 'ring', '귀걸이', 'earring', '시계', 'watch', '선글라스', 'sunglasses', '스카프', 'scarf', '머플러', '벨트', 'belt', '장갑', 'gloves'].some(v => combined.includes(v))) {
    return '액세서리';
  }
  
  return mapToPriorityCategory(category, subCategory, productName);
}

// ============= 📷 사진 분석 직접 매칭 함수 =============

interface PhotoAnalysisItem {
  type: string;      // top, bottom, outer, shoes, bag, accessory, set
  category: string;  // 니트/스웨터, 와이드팬츠, 스니커즈 등
  color: string;     // 베이지, 인디고블루 등
  material: string;  // 울, 데님, 가죽 등
  fit: string;       // 오버사이즈, 슬림핏 등
  pattern: string;   // 무지, 스트라이프 등
}

interface PhotoAnalysisData {
  items: PhotoAnalysisItem[];
  overallStyle: string;
  season: string;
  tpo: string;
}

// 색상 유사도 매핑 (한국어 색상 → color_family)
const COLOR_FAMILY_MAP: Record<string, string[]> = {
  'neutral': ['베이지', '아이보리', '크림', '카키', '브라운', '탄', '캐멀', '누드', '모카', '오트밀', '샌드', '토프', '그레이', '회색', '차콜', '흑', '블랙', '검정', '화이트', '흰', '백', '네이비'],
  'warm': ['레드', '빨강', '와인', '버건디', '마룬', '오렌지', '주황', '코랄', '살몬', '피치', '옐로우', '노랑', '머스타드', '골드', '브라운', '갈색', '카멜', '탄', '테라코타', '러스트'],
  'cool': ['블루', '파랑', '네이비', '인디고', '스카이', '코발트', '그린', '녹색', '올리브', '카키', '민트', '에메랄드', '틸', '퍼플', '보라', '라벤더', '바이올렛'],
  'bold': ['레드', '빨강', '오렌지', '주황', '옐로우', '노랑', '핫핑크', '네온', '일렉트릭', '코발트', '에메랄드', '로열블루'],
  'pastel': ['라벤더', '민트', '피치', '베이비핑크', '스카이', '라일락', '파스텔', '연', '밝은'],
};

function calculatePhotoMatchScore(
  analysisItem: PhotoAnalysisItem,
  product: CachedProduct
): number {
  const meta = product.dna_meta;
  
  // 1. item_slot 일치 필수 (불일치 시 0점)
  const productSlot = meta?.item_slot || '';
  if (productSlot && analysisItem.type !== productSlot) {
    // dress는 bottom과도 매칭 가능
    if (!(analysisItem.type === 'bottom' && productSlot === 'dress') &&
        !(analysisItem.type === 'set' && (productSlot === 'top' || productSlot === 'bottom'))) {
      return 0;
    }
  }
  
  const combined = `${product.name || ''} ${product.category || ''} ${product.sub_category || ''} ${product.dna_text || ''}`.toLowerCase();
  const productColor = (product.color || '').toLowerCase();
  const analysisColor = (analysisItem.color || '').toLowerCase();
  const analysisCategory = (analysisItem.category || '').toLowerCase();
  const analysisMaterial = (analysisItem.material || '').toLowerCase();
  const analysisFit = (analysisItem.fit || '').toLowerCase();
  const analysisPattern = (analysisItem.pattern || '').toLowerCase();
  
  let score = 0;
  
  // 2. 색상 매칭 (0.35)
  let colorScore = 0;
  // 직접 색상 매칭
  if (analysisColor && (productColor.includes(analysisColor) || analysisColor.includes(productColor) || combined.includes(analysisColor))) {
    colorScore = 1.0;
  } else if (meta?.color_family) {
    // color_family 간접 매칭
    const productFamily = Array.isArray(meta.color_family) ? meta.color_family : [meta.color_family];
    for (const [family, keywords] of Object.entries(COLOR_FAMILY_MAP)) {
      if (productFamily.includes(family as any) && keywords.some(kw => analysisColor.includes(kw.toLowerCase()))) {
        colorScore = 0.6;
        break;
      }
    }
  }
  score += colorScore * 0.35;
  
  // 3. 카테고리 키워드 매칭 (0.30)
  let categoryScore = 0;
  if (analysisCategory) {
    // 카테고리 키워드를 개별 단어로 분리하여 검색
    const categoryTokens = analysisCategory.split(/[\/\s,]+/).filter(t => t.length >= 2);
    const matchedTokens = categoryTokens.filter(token => combined.includes(token));
    if (matchedTokens.length > 0) {
      categoryScore = Math.min(matchedTokens.length / Math.max(categoryTokens.length, 1), 1.0);
    }
    // 제품명에서 직접 카테고리 매칭
    if (combined.includes(analysisCategory)) {
      categoryScore = 1.0;
    }
  }
  score += categoryScore * 0.30;
  
  // 4. 소재 매칭 (0.20)
  let materialScore = 0;
  if (analysisMaterial) {
    const materialTokens = analysisMaterial.split(/[\/\s,]+/).filter(t => t.length >= 2);
    const matchedMaterials = materialTokens.filter(token => combined.includes(token));
    materialScore = matchedMaterials.length > 0 ? Math.min(matchedMaterials.length / materialTokens.length, 1.0) : 0;
  }
  score += materialScore * 0.20;
  
  // 5. 핏 매칭 (0.10)
  let fitScore = 0;
  if (analysisFit && combined.includes(analysisFit)) {
    fitScore = 1.0;
  }
  score += fitScore * 0.10;
  
  // 6. 패턴 매칭 (0.05)
  let patternScore = 0;
  if (analysisPattern && analysisPattern !== '무지') {
    if (combined.includes(analysisPattern)) patternScore = 1.0;
  } else if (analysisPattern === '무지') {
    // 무지인 경우 패턴 키워드가 없으면 매칭
    const patternKeywords = ['스트라이프', '체크', '플로럴', '도트', '프린트', '패턴'];
    if (!patternKeywords.some(pk => combined.includes(pk))) patternScore = 0.5;
  }
  score += patternScore * 0.05;
  
  return score;
}

function filterProductsByPhotoAnalysis(
  allProducts: CachedProduct[],
  photoItems: PhotoAnalysisItem[],
  productsByPriority: Record<string, CachedProduct[]>
): void {
  // 각 분석 아이템에 대해 매칭 점수 계산 후 카테고리별로 정렬
  for (const analysisItem of photoItems) {
    const targetSlot = analysisItem.type;
    const targetCategory = targetSlot === 'top' ? '상의' 
      : targetSlot === 'bottom' || targetSlot === 'set' ? '하의'
      : targetSlot === 'outer' ? '아우터'
      : targetSlot === 'shoes' ? '신발'
      : '액세서리';
    
    const scoredProducts = allProducts
      .map(p => ({ product: p, score: calculatePhotoMatchScore(analysisItem, p) }))
      .filter(sp => sp.score > 0)
      .sort((a, b) => b.score - a.score);
    
    console.log(`[style-recommend] Photo match for ${targetCategory} (${analysisItem.color} ${analysisItem.category}): ${scoredProducts.length} candidates, top score: ${scoredProducts[0]?.score.toFixed(3) || 'N/A'}`);
    
    // 기존 카테고리 목록에 점수순으로 재배치 (높은 점수 우선)
    if (scoredProducts.length > 0 && productsByPriority[targetCategory]) {
      const photoMatchedIds = new Set(scoredProducts.slice(0, 15).map(sp => sp.product.id));
      const existing = productsByPriority[targetCategory].filter(p => !photoMatchedIds.has(p.id));
      productsByPriority[targetCategory] = [
        ...scoredProducts.slice(0, 15).map(sp => sp.product),
        ...existing
      ];
    }
  }
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
  LOVABLE_API_KEY: string,
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
    
    // 모든 모델을 Lovable AI Gateway로 통일
    const apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    
    if (!LOVABLE_API_KEY) {
      console.error(`[style-recommend] Stage 1: LOVABLE_API_KEY missing`);
      return null;
    }

    const response = await fetch(
      apiUrl,
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
          temperature: 0.3,
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
  LOVABLE_API_KEY: string,
): Promise<RAGStyleResponse | null> {
  console.log(`[style-recommend] Stage 2: ${modelName} 최종 선택 시작...`);
  
  const isFormalOccasion = stage1Result.formalityMin >= 7 || stage1Result.requiredItems.includes('신발');
  
const stage2SystemPrompt = `당신은 세계 최고의 패션 스타일리스트이자 트렌드 큐레이터입니다.
파리, 밀라노, 뉴욕 패션위크를 수십 년간 다녀온 베테랑이며, 셀럽들의 퍼스널 스타일리스트로 활동 중입니다.
당신의 멘트는 위트있고, 트렌디하며, 때로는 도발적이지만 항상 전문성이 묻어납니다!

✨ 톤 & 매너:
- "~거든요", "~죠" 등 친근하지만 전문가다운 말투
- 패션 업계 은어와 트렌드 용어 적극 활용 (실루엣, 레이어링, 톤온톤, 컬러 팝 등)
- 브랜드 스토리와 디테일에 대한 해박한 지식 어필
- 마무리는 항상 유쾌하고 자신감 넘치게!
- 🚫 절대로 "(이)가", "~이(가)" 같은 어색한 조사 사용 금지! 자연스러운 한국어만!

🚨🚨🚨 **가장 중요한 규칙 (절대 위반 금지!):**
- **상품 목록에 있는 브랜드와 상품명만 사용하세요!**
- **상품 목록에 없는 브랜드(몽클레어, 캉골, 구찌 등)는 절대 언급하지 마세요!**
- **styleReasoning에서 언급하는 모든 브랜드와 상품은 반드시 selectedProductIds에 포함된 것만!**

🚨 핵심 규칙 (반드시 준수!):
1. ${isFormalOccasion 
  ? `[필수] 상의(top) 1개 + 하의(bottom) 1개 + 신발(shoes) 1개 (구두/로퍼/힐 권장)\n   [선택] 아우터(outer)/가방(bag)/액세서리 중 1개`
  : `[필수] 상의(top) 1개 + 하의(bottom) 1개\n   [자유] 아우터(outer)/신발(shoes)/가방(bag)/액세서리 중 2개`}
2. 같은 브랜드 2개 금지
3. F값(격식도)이 비슷한 아이템끼리 조합 (±2 이내)
4. ⚠️ 제외 아이템은 절대 선택하지 마세요!
5. ⚠️⚠️⚠️ **정확히 4개의 서로 다른 카테고리 상품을 선택하세요** (상의/하의/아우터/신발/가방 등에서 중복 없이)
6. ⚠️⚠️⚠️ **item_slot 값을 확인하세요**: top=상의, bottom=하의, outer=아우터, shoes=신발, bag=가방

📝 styleReasoning 필수 구조 (최소 200자 이상, 풍부하게!):

1. **후킹 오프닝** (자신감 넘치는 한 줄):
   - "이 조합? 솔직히 말해서 천재적이에요 😏" 
   - "자, 집중하세요. 오늘 제가 진짜 제대로 골랐거든요."
   - "이 정도면 패션 테러 방지법 1조를 지킨 거예요."

2. **TPO 맥락 분석** (왜 이 조합이 완벽한지 전문가적 분석):
   - 요청한 상황(예: 홍대 클럽, 발리 여행, 결혼식)에 왜 이 조합이 완벽한지 설명
   - 실제 그 장소/상황에서의 분위기, 조명, 사람들의 시선을 상상하며 묘사
   - "~라는 공간의 분위기를 생각해보세요" / "~에서 이 룩을 입고 걸으면..."

3. **각 아이템별 전문가 해설** (⚠️ 선택한 상품만! 상품 목록에 있는 브랜드명 + 상품명 정확히):
   - **절대로 상품 목록에 없는 브랜드/상품을 언급하지 마세요!**
   - 소재 이야기: "코듀로이의 은은한 광택이...", "린넨 특유의 내추럴한 구김이..."
   - 실루엣 분석: "릴랙스드 핏이 어깨 라인을 자연스럽게 잡아주고...", "와이드 레그가 다리를 길어 보이게..."
   - 컬러 조화: "블랙과 네이비의 톤온톤 조합이...", "뉴트럴 톤 베이스에 포인트 컬러가..."

4. **스타일링 팁** (프로의 노하우):
   - 레이어링 제안: "안에 화이트 티를 받쳐 입으면 더 세련돼요"
   - 액세서리 매칭: "여기에 실버 체인 목걸이 하나면 완벽"
   - 시간대/TPO 변주: "저녁엔 자켓을 어깨에 걸치면 분위기 UP"

5. **킬링 포인트 마무리** (자신감 넘치는 한 줄):
   - "킬링 포인트? 바로 [선택한 브랜드]의 [선택한 아이템]과 [선택한 브랜드]의 만남이에요!"
   - "이 조합의 백미는 단연 [구체적인 포인트]죠."
   - "솔직히 이 가격에 이 무드? 거의 범죄 수준이에요 🔥"

🎯 위트 예시:
- "이 조합 보고 안 사시면, 솔직히 패션 테러입니다 😏"
- "지금 장바구니에 안 담으면 미래의 당신이 후회해요"
- "거리에서 '저 사람 뭐 입은 거야?' 시선 각오하세요"
- "이건 찰떡궁합 그 자체예요. 마치 된장찌개에 두부 같은!"
- "${ageGroupLabel}이라고요? 나이는 숫자에 불과해요. 스타일에는 정년이 없거든요 ✨"

반드시 유효한 JSON만 응답하세요.`;

  const excludeNote = stage1Result.excludeItems.length > 0 
    ? `\n⚠️ 제외 필수: ${stage1Result.excludeItems.join(', ')}` 
    : '';

  // 상품 목록에서 브랜드 추출 (AI에게 사용 가능한 브랜드 명시)
  const availableBrands = [...new Set(productListContext.split('\n').map(line => {
    const parts = line.split('|');
    return parts[1] || '';
  }).filter(Boolean))];

  const stage2UserPrompt = `요청: "${userRequest.slice(0, 80)}"
타겟: ${gender} ${ageGroupLabel}
상황: ${occasion}

TPO 분석 결과 (Stage 1):
- 드레스코드: ${stage1Result.dressCodeHint}
- 격식도: F${stage1Result.formalityMin}~${stage1Result.formalityMax}
- 컨셉: ${stage1Result.concepts.join(', ')}
- 필수 아이템: ${stage1Result.requiredItems.join(', ')}${excludeNote}
- 분석 의견: ${stage1Result.reasoning}

🚨 **사용 가능한 브랜드 목록 (이 브랜드들만 언급하세요!):**
${availableBrands.join(', ')}

상품 목록 (이미 조건에 맞게 필터링됨):
${productListContext}

💡 [NEW] 태그가 붙은 상품은 최근 입고된 신상품입니다.
동일한 스타일 적합도라면 신상품을 우선 선택하세요.

${isFormalOccasion 
  ? `[필수] 상의(top) 1개 + 하의(bottom) 1개 + 신발(shoes) 1개`
  : `[필수] 상의(top) 1개 + 하의(bottom) 1개`}

⚠️⚠️⚠️ 최우선 규칙: 
- **위 상품 목록에 있는 ID, 브랜드, 상품명만 사용하세요!**
- **상품 목록에 없는 브랜드(몽클레어, 캉골, 구찌, 발렌시아가 등)는 절대 언급 금지!**
- 정확히 4개 상품을 선택하세요 (서로 다른 item_slot에서: top/bottom/outer/shoes/bag)
- selectedProductIds의 ID는 반드시 위 상품 목록에 있는 ID만 사용!
- styleReasoning에서 언급하는 모든 브랜드/상품은 selectedProductIds에 해당하는 것만!
- styleReasoning은 최소 200자 이상, 풍부하고 전문적으로 작성하세요
- "~이(가)" 같은 어색한 조사 쓰지 마세요. 자연스러운 한국어로!

JSON만 응답:
{"lookName":"캐치한 코디명 (예: 홍대 클럽 킬러룩)","styleConcept":"이 룩의 무드 한줄","styleReasoning":"[200자 이상] 후킹 오프닝 → TPO 맥락 분석 → 각 아이템 전문가 해설 → 스타일링 팁 → 킬링 포인트 마무리","selectedProductIds":["id1","id2","id3","id4"]}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STAGE2_TIMEOUT);
    
    const startTime = Date.now();
    
    // 모든 모델을 Lovable AI Gateway로 통일
    const apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    
    if (!LOVABLE_API_KEY) {
      console.error(`[style-recommend] Stage 2: LOVABLE_API_KEY missing`);
      return null;
    }

    const response = await fetch(
      apiUrl,
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
          max_tokens: 1200,
          temperature: 0.8,
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
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false, age, ageGroup, stylePreferences, photoAnalysisItems } = requestPayload;
    userId = requestPayload.userId || null;
    
    const hasPhotoAnalysis = photoAnalysisItems && photoAnalysisItems.items && photoAnalysisItems.items.length > 0;

    if (!userRequest) {
      return new Response(JSON.stringify({ error: 'userRequest is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
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
    if (hasPhotoAnalysis) {
      console.log(`[style-recommend] 📷 Photo analysis mode: ${photoAnalysisItems.items.length} items detected`);
    }

    // ============= PHASE 1: 캐시 체크 =============
    
    if (!forceRefresh && !hasPhotoAnalysis) {
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
    // 📷 사진 분석 모드에서는 Stage 1 스킵 (이미 구조화된 분석 완료)
    
    let stage1Result: Stage1Result | null = null;
    let stage1Source = 'gpt';
    const stage1Start = Date.now();

    if (hasPhotoAnalysis) {
      // 📷 사진 분석 결과에서 Stage 1 결과 직접 생성 (AI 호출 스킵)
      const photoData = photoAnalysisItems as PhotoAnalysisData;
      const photoTPO = photoData.tpo || '데일리';
      const photoStyle = photoData.overallStyle || '캐주얼';
      
      stage1Result = {
        concepts: [photoStyle],
        formalityMin: 2,
        formalityMax: 7,
        requiredItems: photoData.items.map((item: PhotoAnalysisItem) => {
          switch (item.type) {
            case 'top': return '상의';
            case 'bottom': case 'set': return '하의';
            case 'outer': return '아우터';
            case 'shoes': return '신발';
            default: return '액세서리';
          }
        }),
        excludeItems: [],
        dressCodeHint: `사진 속 스타일: ${photoStyle} (${photoTPO})`,
        colorSuggestions: photoData.items.map((item: PhotoAnalysisItem) => item.color).filter(Boolean),
        reasoning: `📷 사진 분석 기반: ${photoData.items.map((item: PhotoAnalysisItem) => `${item.color} ${item.category}`).join(', ')}`,
      };
      
      stage1Source = 'photo_analysis';
      metrics.stage1Success = true;
      metrics.stage1Model = 'photo_analysis_skip';
      console.log(`[style-recommend] 📷 Stage 1 스킵 - 사진 분석 결과 직접 사용: ${stage1Result.reasoning}`);
    } else if (LOVABLE_API_KEY || OPENAI_API_KEY) {
      // 1차: Primary 모델
      stage1Result = await runStage1WithModel(
        stage1Primary,
        userRequest,
        gender,
        ageGroupLabel,
        occasion,
        LOVABLE_API_KEY || '',
        OPENAI_API_KEY || undefined
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
          LOVABLE_API_KEY || '',
          OPENAI_API_KEY || undefined
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
      '신발': [],    // 🔥 신발 별도 카테고리
      '아우터': [],
      '액세서리': [], // 🔥 액세서리 별도 카테고리 (가방, 모자, 벨트 등)
      'unknown': []
    };

    // DB 쿼리 - 페이지네이션으로 전체 상품 가져오기 (1000행 제한 우회)
    const allProductsRaw = await fetchAllProducts(supabase);
    
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
    
    // 🔥 키즈/주니어 상품 필터링 (성인에게 키즈 상품 추천 방지)
    allProducts = filterKidsProductsForAdults(allProducts, isKids);
    console.log(`[style-recommend] After kids filter (isKids=${isKids}): ${allProducts.length}`);
    
    // 🔥 성별 기반 브랜드 필터링 (남성에게 여성 전용 브랜드 추천 방지)
    allProducts = filterByGenderBrand(allProducts, gender);
    console.log(`[style-recommend] After gender brand filter (gender=${gender}): ${allProducts.length}`);
    
    // 타겟 필터링 (dna_meta.target 기반)
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
    
    // 🎲 다양성을 위한 랜덤 시드 생성 (요청마다 다름)
    const randomSeed = Date.now() % 1000;
    
    const scoredProducts = allProducts.map(p => {
      const feedbackScore = p.feedback_score || 0.5;
      const conceptScore = calculateConceptScore(p, stage1Result.concepts);
      
      let formalityScore = 0;
      if (p.dna_meta?.formality !== undefined) {
        const targetFormality = (stage1Result.formalityMin + stage1Result.formalityMax) / 2;
        const diff = Math.abs(p.dna_meta.formality - targetFormality);
        formalityScore = Math.max(0, 1 - diff * 0.15);
      }
      
      // 🆕 Freshness Boost: 신상품 가산점
      const freshnessBonus = calculateFreshnessBoost(p.collected_at);
      
      // 🎲 랜덤 다양성 요소 추가 (0~0.15 범위의 랜덤 보너스)
      const idHash = p.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const diversityBonus = ((idHash + randomSeed) % 100) / 666;  // 0 ~ 0.15 범위
      
      // 가중치 조정: feedback 0.25→0.20, formality 0.25→0.20, freshness 추가
      const totalScore = (feedbackScore * 0.20) + (conceptScore * 0.35) + (formalityScore * 0.20) + freshnessBonus + diversityBonus;
      
      return { product: p, score: totalScore };
    });
    
    // 점수순 정렬 후 상위 권 내에서 섞기
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
    
    // 📷 사진 분석 모드: 카테고리별 상품을 매칭 점수로 재정렬
    if (hasPhotoAnalysis) {
      const photoData = photoAnalysisItems as PhotoAnalysisData;
      filterProductsByPhotoAnalysis(allProducts, photoData.items, productsByPriority);
      console.log(`[style-recommend] 📷 Photo matching applied - products re-ranked by similarity`);
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
    
    // GPT에 보낼 상품 목록 준비 - 다양성 강화
    const getProductsForStage2 = () => {
      const result: CachedProduct[] = [];
      const usedBrands = new Map<string, number>();
      
      for (const cat of CATEGORY_PRIORITY) {
        const catProducts = productsByPriority[cat] || [];
        let selectedFromCat = 0;
        const maxPerCategory = hasPhotoAnalysis ? 8 : 10;
        
        // 📷 사진 분석 모드: 매칭 순서 유지 / 일반 모드: 랜덤 샘플링
        const topCandidates = catProducts.slice(0, 25);
        const shuffledCandidates = hasPhotoAnalysis 
          ? topCandidates  // 사진 매칭 점수순 유지
          : [...topCandidates].sort(() => Math.random() - 0.5);
        
        for (const p of shuffledCandidates) {
          if (selectedFromCat >= maxPerCategory) break;
          
          const brand = p.brand || 'unknown';
          const brandCount = usedBrands.get(brand) || 0;
          
          // 브랜드당 최대 2개로 다양성 확보
          if (brandCount < 2) {
            result.push(p);
            usedBrands.set(brand, brandCount + 1);
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
      const newTag = isNewProduct(p.collected_at) ? '[NEW]' : '';
      return `${p.id}|${p.brand || ''}|${p.name.slice(0, 25)}|${slot}|₩${Math.floor(p.price/1000)}k|F${p.dna_meta?.formality || 5}|${concepts}|${color}${newTag ? '|' + newTag : ''}`;
    }).join('\n');

    // 📷 사진 분석 모드: Stage 2에 원본 사진 분석 컨텍스트 추가
    let photoContextForStage2 = '';
    if (hasPhotoAnalysis) {
      const photoData = photoAnalysisItems as PhotoAnalysisData;
      const itemDescriptions = photoData.items.map((item: PhotoAnalysisItem) => 
        `${item.type === 'top' ? '상의' : item.type === 'bottom' ? '하의' : item.type === 'outer' ? '아우터' : item.type === 'shoes' ? '신발' : '액세서리'}: ${item.color} ${item.category} (${item.material}, ${item.fit}, ${item.pattern})`
      ).join('\n');
      
      photoContextForStage2 = `
🚨🚨🚨 **최우선 지시: 사진 매칭 모드**
사용자가 참고 사진을 업로드했습니다. 아래 사진 속 아이템과 **가장 유사한** 상품을 선택하세요.
색상, 카테고리, 소재, 핏이 사진 속 아이템과 최대한 일치해야 합니다!

📷 사진 속 아이템:
${itemDescriptions}

전체 스타일: ${photoData.overallStyle || ''}
계절: ${photoData.season || ''} / TPO: ${photoData.tpo || ''}

⚠️ 상품 목록에서 위 아이템들과 가장 유사한 색상/카테고리/소재를 가진 상품을 우선 선택하세요!
`;
    }

    let ragResponse: RAGStyleResponse | null = null;
    let apiCalls = { gpt5: 1, gemini: 0 };
    const stage2Start = Date.now();
    
    if ((LOVABLE_API_KEY || OPENAI_API_KEY) && stage2Products.length > 0) {
      // 1차: Primary 모델
      const stage2Context = photoContextForStage2 + productListContext;
      ragResponse = await runStage2WithModel(
        stage2Primary,
        stage1Result,
        stage2Context,
        userRequest,
        gender,
        ageGroupLabel,
        occasion,
        LOVABLE_API_KEY || '',
        OPENAI_API_KEY || undefined
      );
      
      // 2차: Primary 실패 시 Backup 모델로 교차 Fallback
      if (!ragResponse) {
        console.log(`[style-recommend] Stage 2 ${stage2Primary} 실패, ${stage2Backup}으로 교차 Fallback...`);
        metrics.stage2Model = stage2Backup;
        ragResponse = await runStage2WithModel(
          stage2Backup,
          stage1Result,
          stage2Context,
          userRequest,
          gender,
          ageGroupLabel,
          occasion,
          LOVABLE_API_KEY || '',
          OPENAI_API_KEY || undefined
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
      
      // ============= 🔥 Reasoning 검증 및 교정 =============
      // AI가 잘못된 브랜드/상품을 언급했을 경우 교정
      const actualBrands = sortedProducts.map(p => p.brand?.toLowerCase()).filter(Boolean);
      
      // 상품 목록에 없는 브랜드가 reasoning에 언급되었는지 확인
      const reasoning = ragResponse.styleReasoning || '';
      const reasoningLower = reasoning.toLowerCase();
      
      // 흔히 잘못 언급되는 유명 브랜드 목록
      const HALLUCINATED_BRANDS = ['몽클레어', 'moncler', '캉골', 'kangol', '구찌', 'gucci', 
        '발렌시아가', 'balenciaga', '프라다', 'prada', '샤넬', 'chanel', '루이비통', 'louis vuitton',
        '버버리', 'burberry', '디올', 'dior', '생로랑', 'saint laurent', '보테가', 'bottega',
        '셀린느', 'celine', '펜디', 'fendi', '지방시', 'givenchy', '발렌티노', 'valentino'];
      
      const hasHallucinatedBrand = HALLUCINATED_BRANDS.some(brand => {
        if (reasoningLower.includes(brand)) {
          // 실제 선택된 상품에 해당 브랜드가 있으면 OK
          return !actualBrands.some(ab => ab?.includes(brand));
        }
        return false;
      });
      
      if (hasHallucinatedBrand) {
        console.log(`[style-recommend] ⚠️ Reasoning에 잘못된 브랜드 언급 감지, 재생성...`);
        
        // 실제 선택된 상품 기반으로 reasoning 재생성
        // 🔥 item_slot 대신 실제 카테고리 분류 사용
        const topProduct = sortedProducts.find(p => 
          p.dna_meta?.item_slot === 'top' || 
          getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '상의'
        );
        const bottomProduct = sortedProducts.find(p => 
          p.dna_meta?.item_slot === 'bottom' || 
          getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '하의'
        );
        const outerProduct = sortedProducts.find(p => 
          p.dna_meta?.item_slot === 'outer' || 
          getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '아우터'
        );
        const shoesProduct = sortedProducts.find(p => 
          p.dna_meta?.item_slot === 'shoes' || 
          getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '신발'
        );
        // 🎩 액세서리(모자 포함) vs 가방 구분
        const accessoryProduct = sortedProducts.find(p => 
          hasHatKeyword(p.name) || 
          p.dna_meta?.item_slot === 'accessory' ||
          getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '액세서리'
        );
        const bagProduct = sortedProducts.find(p => 
          !hasHatKeyword(p.name) && (
            p.dna_meta?.item_slot === 'bag' || 
            getDisplaySubCategory(p.category, p.sub_category, p.name, p.dna_meta) === '가방'
          )
        );
        
        let correctedReasoning = getRandomWittyOpener() + ' ';
        correctedReasoning += `${occasion}에 완벽한 룩을 준비했어요. `;
        
        if (topProduct) {
          correctedReasoning += `상의는 **${topProduct.brand}의 ${topProduct.name}**으로, `;
          const topConcepts = topProduct.dna_meta?.concepts?.slice(0, 2).join('/') || '세련된';
          correctedReasoning += `${topConcepts} 무드를 잡아줍니다. `;
        }
        
        if (bottomProduct) {
          correctedReasoning += `하의는 **${bottomProduct.brand}의 ${bottomProduct.name}**을 매치했어요. `;
        }
        
        if (outerProduct) {
          correctedReasoning += `아우터로 **${outerProduct.brand}의 ${outerProduct.name}**을 더해 스타일을 완성했죠. `;
        }
        
        if (shoesProduct) {
          correctedReasoning += `신발은 **${shoesProduct.brand}의 ${shoesProduct.name}**으로, 전체 룩의 포인트가 됩니다. `;
        }
        
        // 🎩 액세서리(모자)와 가방을 별도로 처리
        if (accessoryProduct) {
          const accCategory = getDisplaySubCategory(accessoryProduct.category, accessoryProduct.sub_category, accessoryProduct.name, accessoryProduct.dna_meta);
          correctedReasoning += `${accCategory}는 **${accessoryProduct.brand}의 ${accessoryProduct.name}**으로 스타일에 포인트를 더했어요. `;
        }
        
        if (bagProduct) {
          correctedReasoning += `가방은 **${bagProduct.brand}의 ${bagProduct.name}**으로 실용성과 스타일을 모두 챙겼어요. `;
        }
        
        correctedReasoning += getRandomWittyCloser();
        
        ragResponse.styleReasoning = correctedReasoning;
        console.log(`[style-recommend] Reasoning 교정 완료`);
      }
      
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
