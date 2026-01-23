// style-recommend v5.0 - 2-Stage RAG: GPT가 DB 검색 조건 생성 → 정밀 검색 → 최종 선택
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// RAG Stage 1: 검색 조건 인터페이스
interface SearchConditions {
  concepts: string[];
  occasions: string[];
  formalityMin: number;
  formalityMax: number;
  colorFamilies: string[];
  excludeCategories: string[];
  seasonFit: string[];
  reasoning: string; // GPT가 왜 이 조건을 선택했는지 설명
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      
      // Rate limit (429) - wait and retry
      if (response.status === 429 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
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
  // 피드백 점수 (조인 시 추가됨)
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

interface RAGStyleResponse {
  lookName: string;
  styleConcept: string;
  styleReasoning: string;
  selectedProductIds: string[];
  stylingTips: string;
  productDNAs?: { id: string; dna: string }[];
}

// Category priority for auto-selection (순서: 상의 → 하의 → 아우터 → 기타)
const CATEGORY_PRIORITY = ['상의', '하의', '아우터', '기타'];

// 연령대 코드를 한글 레이블로 변환
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

// Generate cache key from request parameters
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

// Map item_slot to priority category
function itemSlotToPriorityCategory(itemSlot: string | undefined): string {
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

// Map product category to priority category (fallback when no dna_meta)
function mapToPriorityCategory(category: string, subCategory?: string | null, productName?: string | null): string {
  const combined = `${category || ''} ${subCategory || ''} ${productName || ''}`.toLowerCase();
  
  // 1. 아우터
  if (['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'jackets', 'coats', '패딩', 'padding', 'puffer', 'blazer', '블레이저', '야상', '트렌치', 'trench'].some(v => combined.includes(v))) {
    if (!['니트', 'knit', '스웨터', 'sweater', '티셔츠', 't-shirt', '맨투맨'].some(v => combined.includes(v))) {
      return '아우터';
    }
  }
  
  // 2. 상의
  if (['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'shirts', 'polo', 'sweater', '스웨터', '맨투맨', '후드', 'hoodie'].some(v => combined.includes(v))) {
    return '상의';
  }
  
  // 3. 하의 (원피스/드레스 포함)
  if (['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress', 'dresses', '드레스', 'shorts', '반바지', 'leggings', '레깅스', '슬랙스', 'slacks'].some(v => combined.includes(v))) {
    return '하의';
  }
  
  // 4. 기타 (신발, 가방, 액세서리)
  if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'loafers', '로퍼', '힐', '가방', 'bag', 'bags', '백', '클러치', 'tote', '액세서리', 'accessory', 'accessories', '스카프', '모자', 'hat', '벨트', 'belt', '목걸이', '반지', '귀걸이', '팔찌', '시계', '선글라스'].some(v => combined.includes(v))) {
    return '기타';
  }
  
  // 성별/대분류만 있는 경우
  if (['여성', '남성', '여성의류', '남성의류', '라이프', '뷰티', '키즈', '골프', '스포츠', '명품'].includes(category)) {
    return 'unknown';
  }
  
  return 'unknown';
}

// Get display category for UI
function getDisplaySubCategory(category: string, subCategory?: string | null, productName?: string | null, dnaMeta?: DNAMeta | null): string {
  // dna_meta가 있으면 item_slot 기반으로 표시
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

// 1차 필터: 타겟(성별/연령) 필터링
function filterByTarget(products: CachedProduct[], isKids: boolean, gender: string): CachedProduct[] {
  return products.filter(p => {
    const meta = p.dna_meta;
    if (!meta) return true; // DNA 없으면 일단 포함
    if (!meta.target) return true; // target 없으면 일단 포함
    
    let targetGender = '';
    let isKidsTarget = false;
    
    // target이 객체 형식인 경우 처리 (StockX 등 일부 제품)
    if (typeof meta.target === 'object' && meta.target !== null) {
      const targetObj = meta.target as { age?: string; gender?: string };
      targetGender = targetObj.gender || '';
      isKidsTarget = targetObj.age === 'kids';
    } else {
      // 문자열 형식 처리 (정상)
      const target = String(meta.target || '');
      if (!target) return true;
      
      isKidsTarget = target.startsWith('kids_');
      if (target.includes('female')) targetGender = 'female';
      else if (target.includes('male')) targetGender = 'male';
      else targetGender = 'unisex';
    }
    
    if (isKids) {
      // 키즈 요청 -> kids 타겟만
      return isKidsTarget || targetGender === 'unisex';
    } else {
      // 성인 요청 -> kids 제외
      if (isKidsTarget) return false;
      
      // 성별 필터
      if (gender === '남성' && targetGender === 'female') return false;
      if (gender === '여성' && targetGender === 'male') return false;
      
      return true;
    }
  });
}

// 2차 필터: 컨셉 매칭 점수 계산
// 정제된 컨셉 추출 (카테고리 경로 제거)
function cleanConcept(concept: string): string {
  // "여성 > 의류 가방 신발..." 같은 카테고리 경로 제거
  if (concept.includes('>')) return '';
  // 너무 긴 컨셉은 유효하지 않음
  if (concept.length > 15) return '';
  return concept.toLowerCase().trim();
}

// 한글/영문 컨셉 정규화 매핑
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
};

// 컨셉 정규화
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
  if (!meta || !meta.concepts || requestedConcepts.length === 0) return 0.3; // 낮은 기본 점수
  
  // 정제된 컨셉 목록
  const productConcepts = meta.concepts
    .map(c => normalizeConcept(c))
    .filter(c => c.length > 0);
  
  if (productConcepts.length === 0) return 0.3;
  
  const normalizedRequests = requestedConcepts.map(c => normalizeConcept(c)).filter(c => c);
  
  // 정확한 매칭 + 부분 매칭 점수
  let exactMatches = 0;
  let partialMatches = 0;
  
  for (const reqConcept of normalizedRequests) {
    if (productConcepts.includes(reqConcept)) {
      exactMatches++;
    } else if (productConcepts.some(pc => pc.includes(reqConcept) || reqConcept.includes(pc))) {
      partialMatches++;
    }
  }
  
  // 점수 = 정확 매칭 * 1.0 + 부분 매칭 * 0.5
  const score = (exactMatches * 1.0 + partialMatches * 0.5) / Math.max(normalizedRequests.length, 1);
  return Math.min(score, 1.0);
}

// 3차 필터: formality 유사도 (같은 격식 수준끼리 매칭)
function formalityMatch(product1: CachedProduct, product2: CachedProduct): boolean {
  const f1 = product1.dna_meta?.formality || 5;
  const f2 = product2.dna_meta?.formality || 5;
  return Math.abs(f1 - f2) <= 2; // 2단계 이내면 호환
}

// 요청에서 컨셉 키워드 추출
function extractConcepts(request: string): string[] {
  const conceptKeywords: Record<string, string[]> = {
    '캐주얼': ['캐주얼', '편한', '데일리', '일상'],
    '미니멀': ['미니멀', '심플', '단순', '깔끔'],
    '모던': ['모던', '현대적', '세련'],
    '클래식': ['클래식', '정통', '전통', '클라식'],
    '스트릿': ['스트릿', '힙합', '래퍼', '그런지'],
    '페미닌': ['페미닌', '여성스러운', '로맨틱', '러블리'],
    '시크': ['시크', '세련', '우아', '모던'],
    '보헤미안': ['보헤미안', '히피', '자유로운'],
    '스포티': ['스포티', '운동', '애슬레저', '활동적'],
    '빈티지': ['빈티지', '레트로', '복고'],
    '오피스': ['오피스', '출근', '비즈니스', '정장'],
    '포멀': ['포멀', '정장', '격식', '드레스코드'],
  };
  
  const found: string[] = [];
  for (const [concept, keywords] of Object.entries(conceptKeywords)) {
    if (keywords.some(kw => request.includes(kw))) {
      found.push(concept);
    }
  }
  
  return found.length > 0 ? found : ['캐주얼'];
}

// 요청에서 occasion 추출
function extractOccasions(request: string): string[] {
  const occasionKeywords: Record<string, string[]> = {
    '데이트': ['데이트', '소개팅', '만남'],
    '출근': ['출근', '회사', '오피스', '직장'],
    '미팅': ['미팅', '비즈니스', '회의'],
    '여행': ['여행', '휴가', '나들이', '소풍'],
    '결혼식': ['결혼식', '하객', '청첩장', '웨딩'],
    '파티': ['파티', '클럽', '모임'],
    '캠퍼스': ['학교', '대학', '캠퍼스'],
    '운동': ['운동', '헬스', '러닝', '조깅'],
    '데일리': ['일상', '데일리', '평소'],
  };
  
  const found: string[] = [];
  for (const [occasion, keywords] of Object.entries(occasionKeywords)) {
    if (keywords.some(kw => request.includes(kw))) {
      found.push(occasion);
    }
  }
  
  return found.length > 0 ? found : ['데일리'];
}

// occasion 매칭 점수
function calculateOccasionScore(product: CachedProduct, requestedOccasions: string[]): number {
  const meta = product.dna_meta;
  if (!meta || !meta.occasions || requestedOccasions.length === 0) return 0.5;
  
  const overlap = meta.occasions.filter(o => 
    requestedOccasions.some(ro => o.includes(ro) || ro.includes(o))
  );
  return overlap.length / Math.max(requestedOccasions.length, 1);
}

// ============= 기존 함수들 =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestPayload: any = null;

  try {
    requestPayload = await req.json();
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false, age, ageGroup, stylePreferences } = requestPayload;

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

    // 연령대 처리 - ageGroup이 있으면 우선 사용, 없으면 age로 계산
    const isKids = ageGroup === 'child' || (age !== undefined && age <= 12);
    const ageGroupLabel = ageGroup ? getAgeGroupLabel(ageGroup) : (age ? `${Math.floor(age / 10) * 10}대` : '성인');
    
    const requestedConcepts = extractConcepts(userRequest);
    const requestedOccasions = extractOccasions(userRequest);
    const occasion = requestedOccasions[0] || '캐주얼';
    const cacheKey = generateCacheKey(gender, userRequest.substring(0, 20), occasion, budget);
    
    // 패턴 키 생성 (자체 학습용)
    const patternKey = generatePatternKey(gender, occasion, requestedConcepts, budget);
    
    console.log(`[style-recommend] Request: "${userRequest}"`);
    console.log(`[style-recommend] Gender: ${gender}, Budget: ${budget}, Pattern: ${patternKey}`);
    console.log(`[style-recommend] Concepts: ${requestedConcepts.join(', ')}, Occasions: ${requestedOccasions.join(', ')}`);

    // ============= PHASE 1: 캐시 및 패턴 기반 빠른 추천 =============
    
    // 1-1. 캐시 히트 체크 (forceRefresh가 아닌 경우)
    if (!forceRefresh) {
      const { data: cachedLook } = await supabase
        .from('style_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedLook && cachedLook.product_ids && cachedLook.product_ids.length >= 3) {
        console.log(`[style-recommend] Cache HIT! Key: ${cacheKey}`);
        
        // 캐시된 상품 조회
        const { data: cachedProducts } = await supabase
          .from('products_cache')
          .select('*')
          .in('id', cachedLook.product_ids)
          .eq('is_active', true);

        if (cachedProducts && cachedProducts.length >= 3) {
          // 캐시 사용 횟수 증가
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

          // 🎯 캐시에 저장된 GPT 설명이 있으면 그대로 사용!
          let styleReasoning = cachedLook.style_reasoning || '';
          let styleConcept = cachedLook.style_concept || '';
          let lookName = cachedLook.look_name || '';
          
          // 캐시에 저장된 설명이 없는 경우에만 템플릿 생성 (구버전 캐시 호환)
          if (!styleReasoning) {
            const topItem = lookItems.find(i => i.category === '상의');
            const bottomItem = lookItems.find(i => i.category === '하의' || i.category === '원피스');
            const outerItem = lookItems.find(i => i.category === '아우터');
            const etcItems = lookItems.filter(i => ['신발', '가방', '액세서리'].includes(i.category));
            
            const brandMix = [...new Set(lookItems.map(i => i.product?.brand).filter(Boolean))].slice(0, 3).join(' × ');
            const conceptTags = [...new Set(lookItems.flatMap(i => i.product?.dna_meta?.concepts || []))].slice(0, 3);
            
            lookName = conceptTags.length > 0 
              ? `${conceptTags[0]} ${gender} ${occasion} 룩`
              : `${gender} ${occasion} 추천 룩`;
            
            if (topItem?.product && bottomItem?.product) {
              const topBrand = topItem.product.brand || '';
              const topName = topItem.product.name.split(' ').slice(0, 2).join(' ');
              const bottomBrand = bottomItem.product.brand || '';
              const bottomName = bottomItem.product.name.split(' ').slice(0, 2).join(' ');
              
              styleReasoning = `이 룩의 핵심은 '${conceptTags[0] || '세련된 조화'}'예요. `;
              styleReasoning += `${topBrand} ${topName}의 실루엣이 상체 비율을 잡아주고, ${bottomBrand} ${bottomName}이(가) 하체 라인을 정돈해주거든요. `;
            } else if (topItem?.product) {
              const topBrand = topItem.product.brand || '';
              const topName = topItem.product.name.split(' ').slice(0, 3).join(' ');
              styleReasoning = `${topBrand} ${topName}이(가) 이 룩의 시그니처 피스예요. 깔끔한 핏감이 전체 무드를 좌우하죠. `;
            }
            
            if (outerItem?.product) {
              const outerBrand = outerItem.product.brand || '';
              const outerName = outerItem.product.name.split(' ').slice(0, 2).join(' ');
              const formalityDesc = (outerItem.product.dna_meta?.formality ?? 5) > 6 ? '격식 있는' : '편안한';
              styleReasoning += `여기에 ${outerBrand} ${outerName}으로 레이어링하면 ${formalityDesc} ${occasion} 무드가 완성되죠. `;
            }
            
            if (etcItems.length > 0 && etcItems[0]?.product) {
              const etcName = etcItems[0].product.name.split(' ').slice(0, 2).join(' ');
              const etcCategory = etcItems[0].category;
              styleReasoning += `킬링 포인트? ${etcCategory}로 선택한 ${etcName}이(가) 전체 룩에 임팩트를 더해요!`;
            } else {
              styleReasoning += `킬링 포인트? 심플한 듯 디테일한 조화가 ${occasion}에서 시선을 사로잡죠!`;
            }
            
            styleConcept = brandMix 
              ? `👗 ${gender} ${occasion} 요청에 맞춘 "${brandMix}" 브랜드 믹스 스타일링`
              : `👗 ${gender} ${occasion} 스타일 - "${userRequest.slice(0, 30)}..."에 맞춘 코디`;
              
            console.log(`[style-recommend] Cache had no styleReasoning, generated fallback`);
          } else {
            console.log(`[style-recommend] Using cached styleReasoning (${styleReasoning.length} chars)`);
          }

          const elapsed = Date.now() - startTime;
          console.log(`[style-recommend] Cache response in ${elapsed}ms`);

          return new Response(JSON.stringify({
            success: true,
            cacheHit: true,
            look: {
              name: lookName,
              styleConcept,
              styleReasoning,
              items: lookItems,
              totalPrice: lookItems.reduce((sum, i) => sum + (i.product?.price || 0), 0),
              autoSelectedTotal: lookItems.reduce((sum, i) => sum + (i.product?.price || 0), 0),
              autoSelectedCount: lookItems.length,
              budget,
            },
            apiCalls: { gpt5: 0, serpapi: 0 },
            stats: { cacheHit: true, responseTime: elapsed },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 1-2. 패턴 기반 빠른 추천 (성공률 높은 패턴이 있는 경우)
    const { data: pattern } = await supabase
      .from('recommendation_patterns')
      .select('*')
      .eq('pattern_key', patternKey)
      .gte('success_rate', 0.3) // 30% 이상 전환율
      .gte('use_count', 5) // 5회 이상 사용
      .single();

    let patternBasedIds: string[] = [];
    if (pattern && pattern.popular_combos) {
      const combos = pattern.popular_combos as { product_ids: string[]; score: number }[];
      patternBasedIds = combos
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .flatMap(c => c.product_ids);
      console.log(`[style-recommend] Pattern HIT! ${patternBasedIds.length} suggested products`);
    }

    // Step 1: Get merchants list
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

    // ============= 🔥 Stage 1: 규칙 기반 검색 조건 생성 (GPT 없이 비용 절약) =============
    console.log(`[style-recommend] 🔥 Stage 1: Rule-based search condition generation (no GPT cost)...`);
    
    // 키워드 → 컨셉 매핑
    const CONCEPT_KEYWORDS: Record<string, string[]> = {
      '캐주얼': ['캐주얼', 'casual', '편한', '데일리', '일상', '평상복'],
      '미니멀': ['미니멀', 'minimal', '심플', 'simple', '깔끔', '모던'],
      '클래식': ['클래식', 'classic', '정장', '격식', '포멀', 'formal', '오피스', '회사'],
      '스트릿': ['스트릿', 'street', '힙합', '오버사이즈', '후드', '스케이터'],
      '스포티': ['스포티', 'sporty', '운동', '애슬레저', 'athleisure', '짐', '헬스'],
      '로맨틱': ['로맨틱', 'romantic', '데이트', '여성스러운', '플로럴', '레이스'],
      '프레피': ['프레피', 'preppy', '학교', '캠퍼스', '단정한'],
      '럭셔리': ['럭셔리', 'luxury', '고급', '하이엔드', '명품'],
    };
    
    // 키워드 → 상황 매핑
    const OCCASION_KEYWORDS: Record<string, string[]> = {
      '데일리': ['데일리', '일상', '평소', '매일'],
      '출근': ['출근', '오피스', '회사', '비즈니스', '미팅'],
      '데이트': ['데이트', '소개팅', '만남'],
      '여행': ['여행', '휴가', '나들이', '외출'],
      '운동': ['운동', '짐', '헬스', '조깅', '러닝'],
      '파티': ['파티', '행사', '결혼식', '웨딩'],
    };
    
    // 키워드 → 격식도 매핑
    const FORMALITY_KEYWORDS: { pattern: string[]; min: number; max: number }[] = [
      { pattern: ['정장', '포멀', 'formal', '면접', '결혼식', '비즈니스'], min: 7, max: 10 },
      { pattern: ['오피스', '출근', '회사', '세미포멀'], min: 5, max: 8 },
      { pattern: ['스마트캐주얼', '데이트', '약속'], min: 4, max: 7 },
      { pattern: ['캐주얼', '편한', '일상', '데일리'], min: 2, max: 5 },
      { pattern: ['운동', '스포티', '애슬레저', '짐'], min: 0, max: 3 },
    ];
    
    const requestLower = userRequest.toLowerCase();
    
    // 컨셉 추출
    const detectedConcepts: string[] = [];
    for (const [concept, keywords] of Object.entries(CONCEPT_KEYWORDS)) {
      if (keywords.some(kw => requestLower.includes(kw.toLowerCase()))) {
        detectedConcepts.push(concept);
      }
    }
    
    // 상황 추출
    const detectedOccasions: string[] = [];
    for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
      if (keywords.some(kw => requestLower.includes(kw.toLowerCase()))) {
        detectedOccasions.push(occasion);
      }
    }
    
    // 격식도 추출
    let formalityMin = 0;
    let formalityMax = 10;
    for (const { pattern, min, max } of FORMALITY_KEYWORDS) {
      if (pattern.some(kw => requestLower.includes(kw.toLowerCase()))) {
        formalityMin = min;
        formalityMax = max;
        break;
      }
    }
    
    // 색상 키워드 추출
    const COLOR_KEYWORDS: Record<string, string[]> = {
      'neutral': ['블랙', 'black', '화이트', 'white', '그레이', 'gray', '베이지', '뉴트럴'],
      'warm': ['브라운', 'brown', '오렌지', '레드', '와인', '베이지'],
      'cool': ['블루', 'blue', '네이비', 'navy', '민트', '그린'],
      'bold': ['레드', 'red', '옐로우', '핑크', '퍼플', '비비드'],
      'pastel': ['파스텔', '라벤더', '민트', '피치', '연한'],
    };
    
    const detectedColors: string[] = [];
    for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
      if (keywords.some(kw => requestLower.includes(kw.toLowerCase()))) {
        detectedColors.push(color);
      }
    }
    
    // 검색 조건 생성 (GPT 호출 없음!)
    const searchConditions: SearchConditions = {
      concepts: detectedConcepts.length > 0 ? detectedConcepts : requestedConcepts,
      occasions: detectedOccasions.length > 0 ? detectedOccasions : requestedOccasions,
      formalityMin,
      formalityMax,
      colorFamilies: detectedColors,
      excludeCategories: [],
      seasonFit: [seasonEn],
      reasoning: `Rule-based: concepts=${detectedConcepts.join(',')}, occasions=${detectedOccasions.join(',')}, formality=${formalityMin}-${formalityMax}`,
    };
    
    console.log(`[style-recommend] Stage 1 complete (no GPT cost): ${JSON.stringify(searchConditions)}`);

    // ============= 🔥 Stage 2: GPT 조건 기반 DB 쿼리 =============
    console.log(`[style-recommend] 🔥 Stage 2: Querying DB with GPT-generated conditions...`);
    
    const productsByPriority: Record<string, CachedProduct[]> = {
      '상의': [],
      '하의': [],
      '아우터': [],
      '기타': [],
      'unknown': []
    };

    // GPT가 생성한 조건으로 상품 쿼리
    let query = supabase
      .from('products_cache')
      .select('*, dna_text, dna_meta, dna_generated_at')
      .eq('is_active', true)
      .eq('is_in_stock', true)
      .not('image_url', 'is', null)
      .not('dna_meta', 'is', null); // DNA가 있는 상품만

    // 제외 카테고리 적용
    if (searchConditions.excludeCategories?.length > 0) {
      for (const cat of searchConditions.excludeCategories) {
        query = query.neq('category', cat);
      }
    }

    const { data: allProductsRaw, error: productError } = await query
      .order('dna_generated_at', { ascending: false, nullsFirst: false })
      .limit(500); // 더 많은 상품에서 필터링
    
    if (productError) {
      console.error('[style-recommend] Product fetch error:', productError);
    }
    
    // 피드백 점수 조회 (별도 쿼리)
    const { data: feedbackScores } = await supabase
      .from('product_feedback_scores')
      .select('product_id, overall_score, style_weights');
    
    // 피드백 점수 맵 생성
    const feedbackMap = new Map<string, { score: number; weights: Record<string, number> }>();
    if (feedbackScores) {
      for (const fs of feedbackScores) {
        feedbackMap.set(fs.product_id, {
          score: parseFloat(fs.overall_score) || 0.5,
          weights: fs.style_weights || {}
        });
      }
    }
    console.log(`[style-recommend] Feedback scores loaded: ${feedbackMap.size} products`);
    
    // 상품에 피드백 점수 병합
    let allProducts: CachedProduct[] = (allProductsRaw || []).map(p => {
      const feedback = feedbackMap.get(p.id);
      return {
        ...p,
        feedback_score: feedback?.score || 0.5,
        style_weights: feedback?.weights || {}
      };
    });
    console.log(`[style-recommend] Raw products fetched: ${allProducts.length}`);
    
    // ============= DNA 2.0 1차 필터링: 타겟 =============
    allProducts = filterByTarget(allProducts, isKids, gender);
    console.log(`[style-recommend] After target filter: ${allProducts.length}`);
    
    // ============= 시즌 필터링 =============
    const seasonExcludeKeywords: Record<string, string[]> = {
      '겨울': ['shorts', '반바지', '샌들', 'sandal', '민소매', 'sleeveless', 'crop', '크롭', '린넨', 'linen', '슬리퍼'],
      '여름': ['패딩', 'padding', 'puffer', '코트', 'coat', '기모', '털', 'fur', '울', 'wool', '캐시미어', '다운', 'down'],
      '봄': ['패딩', 'padding', 'puffer', '기모', '털', 'fur'],
      '가을': ['샌들', 'sandal', '슬리퍼', '반바지', 'shorts'],
    };
    
    const excludeKeywords = seasonExcludeKeywords[requestedSeason] || [];
    
    allProducts = allProducts.filter(product => {
      const combined = `${product.name} ${product.category} ${product.sub_category || ''}`.toLowerCase();
      
      // dna_meta season_fit 체크
      if (product.dna_meta?.season_fit) {
        const seasonMap: Record<string, string> = { '봄': 'spring', '여름': 'summer', '가을': 'fall', '겨울': 'winter' };
        const seasonEn = seasonMap[requestedSeason] || 'spring';
        if (!product.dna_meta.season_fit.includes(seasonEn)) {
          return false;
        }
      }
      
      // 키워드 기반 시즌 필터
      return !excludeKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
    });
    
    console.log(`[style-recommend] After season filter (${requestedSeason}): ${allProducts.length}`);
    
    // ============= 🔥 GPT 조건 기반 추가 필터링 =============
    if (searchConditions) {
      const beforeCount = allProducts.length;
      
      allProducts = allProducts.filter(product => {
        const meta = product.dna_meta;
        if (!meta) return false; // DNA 없는 상품 제외
        
        // 1. Formality 범위 체크
        if (meta.formality < searchConditions!.formalityMin || meta.formality > searchConditions!.formalityMax) {
          return false;
        }
        
        // 2. 컨셉 매칭 (하나라도 일치하면 OK)
        if (searchConditions!.concepts.length > 0) {
          const productConcepts = meta.concepts?.map(c => normalizeConcept(c)) || [];
          const requestConcepts = searchConditions!.concepts.map(c => normalizeConcept(c));
          const hasMatchingConcept = productConcepts.some(pc => 
            requestConcepts.some(rc => pc.includes(rc) || rc.includes(pc))
          );
          if (!hasMatchingConcept && productConcepts.length > 0) {
            // 완전 불일치는 제외 (컨셉이 있는 경우에만)
            return false;
          }
        }
        
        // 3. 색상 계열 매칭 (선택사항)
        if (searchConditions!.colorFamilies?.length > 0 && meta.color_family) {
          if (!searchConditions!.colorFamilies.includes(meta.color_family)) {
            // 색상 불일치 시 점수 감점만 하고 완전 제외는 안함
            // return false; 
          }
        }
        
        return true;
      });
      
      console.log(`[style-recommend] After GPT conditions filter: ${beforeCount} → ${allProducts.length}`);
      console.log(`[style-recommend] GPT filter criteria: concepts=${searchConditions.concepts.join(',')}, formality=${searchConditions.formalityMin}-${searchConditions.formalityMax}`);
    }
    
    // ============= 최근 추천된 상품 ID 가져오기 (24시간 내) =============
    let recentlyUsedProductIds: Set<string> = new Set();
    try {
      const { data: recentRecs } = await supabase
        .from('recommendation_history')
        .select('items')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);
      
      if (recentRecs) {
        for (const rec of recentRecs) {
          const items = rec.items as any[];
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item?.product_id) {
                recentlyUsedProductIds.add(item.product_id);
              }
            }
          }
        }
      }
      console.log(`[style-recommend] Recently used products (24h): ${recentlyUsedProductIds.size}`);
    } catch (e) {
      console.log('[style-recommend] Could not fetch recent products, continuing...');
    }
    
    // ============= DNA 2.0 + 피드백 기반 점수 계산 =============
    // 점수 기반 정렬 (피드백 점수 + 스타일별 가중치 반영)
    const scoredProducts = allProducts.map(p => {
      const boostScore = (p.dna_meta as any)?.boost_score || 0;
      const isPatternSuggested = patternBasedIds.includes(p.id);
      const wasRecentlyUsed = recentlyUsedProductIds.has(p.id);
      
      // 피드백 점수 (0.5 = 중립, >0.5 = 긍정, <0.5 = 부정)
      const feedbackScore = p.feedback_score || 0.5;
      
      // 스타일별 가중치 계산 (현재 요청된 컨셉과 매칭)
      let styleBonus = 0;
      const styleWeights = p.style_weights || {};
      for (const concept of requestedConcepts) {
        const normalizedConcept = normalizeConcept(concept);
        if (styleWeights[normalizedConcept]) {
          // 스타일 가중치가 0.5 이상이면 보너스, 미만이면 페널티
          styleBonus += (styleWeights[normalizedConcept] - 0.5) * 0.3;
        }
      }
      
      return {
        product: p,
        conceptScore: calculateConceptScore(p, requestedConcepts),
        occasionScore: calculateOccasionScore(p, requestedOccasions),
        hasDNA: !!p.dna_meta,
        boostScore,
        isPatternSuggested,
        wasRecentlyUsed,
        feedbackScore,
        styleBonus,
        totalScore: 0, // 아래에서 계산
      };
    });
    
    // 종합 점수 계산 (피드백 + 스타일 가중치 포함)
    for (const scored of scoredProducts) {
      scored.totalScore = 
        (scored.hasDNA ? 0.20 : 0) +                    // DNA 유무
        (scored.conceptScore * 0.25) +                  // 컨셉 매칭
        (scored.occasionScore * 0.15) +                 // TPO 매칭
        (scored.boostScore * 0.05) +                    // boost 점수
        (scored.isPatternSuggested ? 0.10 : 0) +        // 패턴 추천
        ((scored.feedbackScore - 0.5) * 0.20) +         // 피드백 점수 (-0.1 ~ +0.1)
        (scored.styleBonus) +                            // 스타일별 가중치
        (scored.wasRecentlyUsed ? -0.25 : 0);           // 최근 사용 페널티
    }
    
    // 상위 피드백 상품 로깅
    const topFeedback = scoredProducts
      .filter(s => s.feedbackScore > 0.5)
      .sort((a, b) => b.feedbackScore - a.feedbackScore)
      .slice(0, 5);
    if (topFeedback.length > 0) {
      console.log(`[style-recommend] Top feedback products: ${topFeedback.map(s => `${s.product.name.slice(0, 20)}(${s.feedbackScore})`).join(', ')}`);
    }
    
    // 같은 점수권 내 랜덤 셔플 (점수를 0.05 단위로 그룹화)
    const scoreGrouped = new Map<number, typeof scoredProducts>();
    for (const scored of scoredProducts) {
      const bucket = Math.floor(scored.totalScore * 20) / 20; // 0.05 단위
      if (!scoreGrouped.has(bucket)) scoreGrouped.set(bucket, []);
      scoreGrouped.get(bucket)!.push(scored);
    }
    
    // 각 그룹 내 셔플
    const shuffledScored: typeof scoredProducts = [];
    const buckets = Array.from(scoreGrouped.keys()).sort((a, b) => b - a);
    for (const bucket of buckets) {
      const group = scoreGrouped.get(bucket)!;
      // Fisher-Yates shuffle
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
      shuffledScored.push(...group);
    }
    
    const topScoredProducts = shuffledScored.slice(0, 200);
    console.log(`[style-recommend] Top scored products: ${topScoredProducts.length}`);
    if (topScoredProducts.length > 0) {
      const topProduct = topScoredProducts[0];
      console.log(`[style-recommend] Best match: ${topProduct.product.name} (concept: ${topProduct.conceptScore.toFixed(2)}, occasion: ${topProduct.occasionScore.toFixed(2)}, recentlyUsed: ${topProduct.wasRecentlyUsed})`);
    }
    
    // 브랜드 다양성 적용
    function shuffleArray<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    
    function diversifyByBrand(products: CachedProduct[], maxPerBrand: number = 3): CachedProduct[] {
      const byBrand: Record<string, CachedProduct[]> = {};
      
      for (const p of products) {
        const brand = p.brand || 'unknown';
        if (!byBrand[brand]) byBrand[brand] = [];
        byBrand[brand].push(p);
      }
      
      const diversified: CachedProduct[] = [];
      // 브랜드 순서도 랜덤하게
      const brandKeys = shuffleArray(Object.keys(byBrand));
      for (const brand of brandKeys) {
        // 각 브랜드 내에서도 셔플 후 제한
        const brandProducts = shuffleArray(byBrand[brand]).slice(0, maxPerBrand);
        diversified.push(...brandProducts);
      }
      
      return shuffleArray(diversified);
    }
    
    // 카테고리별로 분류 (dna_meta.item_slot 우선 사용)
    for (const scored of topScoredProducts) {
      const product = scored.product;
      let priorityCat: string;
      
      if (product.dna_meta?.item_slot) {
        priorityCat = itemSlotToPriorityCategory(product.dna_meta.item_slot);
      } else {
        priorityCat = mapToPriorityCategory(product.category, product.sub_category, product.name);
      }
      
      if (productsByPriority[priorityCat]) {
        productsByPriority[priorityCat].push(product);
      } else {
        productsByPriority['unknown'].push(product);
      }
    }
    
    // 각 카테고리에서 브랜드 다양성 적용 (카테고리당 브랜드 2개로 제한)
    for (const cat of CATEGORY_PRIORITY) {
      if (productsByPriority[cat]) {
        productsByPriority[cat] = diversifyByBrand(productsByPriority[cat], 2);
      }
    }
    productsByPriority['unknown'] = diversifyByBrand(productsByPriority['unknown'] || [], 2);
    
    // 통계 로깅
    const dnaStats = {
      withMeta: topScoredProducts.filter(s => s.hasDNA).length,
      withoutMeta: topScoredProducts.filter(s => !s.hasDNA).length,
    };
    console.log(`[style-recommend] DNA 2.0 stats: ${dnaStats.withMeta} with meta, ${dnaStats.withoutMeta} without`);
    console.log(`[style-recommend] Products: 상의=${productsByPriority['상의']?.length || 0}, 하의=${productsByPriority['하의']?.length || 0}, 아우터=${productsByPriority['아우터']?.length || 0}, 기타=${productsByPriority['기타']?.length || 0}`);

    const uniqueProducts = topScoredProducts.map(s => s.product);
    
    if (uniqueProducts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '추천할 수 있는 상품이 없습니다.',
        look: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Create product context with DNA 2.0
    const productContext = uniqueProducts.slice(0, 50).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      priorityCategory: p.dna_meta?.item_slot 
        ? itemSlotToPriorityCategory(p.dna_meta.item_slot)
        : mapToPriorityCategory(p.category, p.sub_category, p.name),
      sub_category: p.sub_category,
      color: p.color,
      style_tags: p.style_tags,
      dna: p.dna_text || null,
      dnaMeta: p.dna_meta ? {
        target: p.dna_meta.target,
        slot: p.dna_meta.item_slot,
        concepts: p.dna_meta.concepts?.slice(0, 3),
        formality: p.dna_meta.formality,
        colorFamily: p.dna_meta.color_family,
      } : null,
    }));

    const productsWithDNA = productContext.filter(p => p.dna || p.dnaMeta);
    console.log(`[style-recommend] Products for GPT: ${productContext.length} (${productsWithDNA.length} with DNA 2.0)`);

    // ============= 🔥 Stage 3: GPT 최종 선택 (필터링된 상품만 제공) =============
    console.log(`[style-recommend] 🔥 Stage 3: GPT final selection from filtered products...`);
    
    let ragResponse: RAGStyleResponse | null = null;
    let gptCalls = 0;
    
    if (LOVABLE_API_KEY) {
      // 카테고리별로 다양한 브랜드의 상품 선택
      const getProductsForGPT = () => {
        const result: typeof productContext = [];
        
        for (const cat of CATEGORY_PRIORITY) {
          const catProducts = productsByPriority[cat] || [];
          let selectedFromCat = 0;
          const maxPerCategory = 12;
          
          for (const p of catProducts) {
            if (selectedFromCat >= maxPerCategory) break;
            
            const brand = p.brand || 'unknown';
            const brandCountInCat = result.filter(r => r.brand === brand && r.priorityCategory === cat).length;
            if (brandCountInCat < 2) {
              const pCtx = productContext.find(pc => pc.id === p.id);
              if (pCtx) {
                result.push(pCtx);
                selectedFromCat++;
              }
            }
          }
        }
        
        return result;
      };
      
      const gptProducts = getProductsForGPT();
      console.log(`[style-recommend] Stage 3: ${gptProducts.length} filtered products for final selection`);
      
      // 모든 상품을 DNA 형식으로 정리 (이미 필터링됨)
      const productListContext = gptProducts.map(p => 
        `• ${p.id}: [${p.brand}] ${p.name} [${p.priorityCategory}] ₩${p.price.toLocaleString()}\n  → 컨셉: ${p.dnaMeta?.concepts?.join(',') || 'N/A'}, 격식: ${p.dnaMeta?.formality || 5}/10, 색감: ${p.dnaMeta?.colorFamily || 'neutral'}`
      ).join('\n');

      // Stage 3 시스템 프롬프트 - 필터링된 상품에서 최종 선택
      const systemPrompt = `당신은 "STYLOX" - 전설적인 AI 스타일리스트입니다.

🎯 당신의 임무:
아래에 제시된 상품들은 이미 고객의 요청에 맞게 **데이터베이스에서 검색된 상품**입니다.
이 상품들 중에서 **가장 완벽한 4개 조합**을 선택하세요.

📋 검색 조건 (Stage 1에서 분석됨):
- 컨셉: ${searchConditions?.concepts.join(', ') || requestedConcepts.join(', ')}
- 상황: ${searchConditions?.occasions.join(', ') || requestedOccasions.join(', ')}
- 격식 범위: ${searchConditions?.formalityMin || 0} ~ ${searchConditions?.formalityMax || 10}
- 시즌: ${requestedSeason}
- 타겟: ${isKids ? '키즈' : gender} ${ageGroupLabel}
${stylePreferences?.length > 0 ? `- 고객 선호 스타일: ${stylePreferences.join(', ')}` : ''}

🔥 선택 규칙:
1. **상의 1개 + 하의 1개 + 아우터 1개 + 기타(신발/가방/악세서리) 1개 = 총 4개**
2. formality 수치가 비슷한 아이템끼리 매칭 (±2 이내)
3. 색감(colorFamily)이 조화로운 조합
4. 🚨 같은 브랜드 2개 이상 금지!
5. 아래 목록에 있는 상품 ID만 선택 가능

✍️ styleReasoning 작성 규칙:
- 선택한 상품의 **정확한 브랜드명과 상품명**을 언급
- "이 룩의 핵심은 ~" 으로 시작
- 각 아이템이 왜 어울리는지 구체적으로 설명
- 마지막에 "킬링 포인트?"로 핵심 마무리`;

      const userPrompt = `🌟 고객 요청: "${userRequest}"

📦 검색된 상품 목록 (이 중에서만 선택하세요):
${productListContext}

위 상품들 중 4개를 선택하여 완벽한 룩을 완성하세요.

JSON 응답:
{
  "lookName": "감각적인 코디명",
  "styleConcept": "한 줄 스타일 에센스",
  "styleReasoning": "선택한 상품의 브랜드명/상품명을 정확히 언급하며 3-4문장으로 설명",
  "selectedProductIds": ["상의id", "하의id", "아우터id", "기타id"]
}`;

      try {
        console.log('[style-recommend] Stage 3: Calling GPT for final selection...');
        const gptStartTime = Date.now();
        
        const gptResponse = await fetchWithRetry(
          'https://ai.gateway.lovable.dev/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'openai/gpt-5',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
            }),
          },
          3
        );

        gptCalls++;
        const elapsed = Date.now() - gptStartTime;
        console.log(`[style-recommend] Stage 3: GPT response in ${elapsed}ms`);

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          const content = gptData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            ragResponse = JSON.parse(jsonMatch[0]) as RAGStyleResponse;
            console.log(`[style-recommend] Stage 3: GPT selected ${ragResponse.selectedProductIds.length} products`);
            console.log(`[style-recommend] Selected IDs: ${ragResponse.selectedProductIds.join(', ')}`);
            console.log(`[style-recommend] styleReasoning: ${ragResponse.styleReasoning?.slice(0, 200)}...`);
          }
        } else {
          const errorText = await gptResponse.text();
          console.error('[style-recommend] Stage 3 GPT error:', gptResponse.status, errorText);
          
          await logError(
            supabase,
            'style-recommend',
            String(gptResponse.status),
            errorText.slice(0, 1000),
            null,
            { userRequest: userRequest?.slice(0, 100), gender, budget },
            Date.now() - startTime
          );
        }
      } catch (e) {
        console.error('[style-recommend] Stage 3 GPT parsing error:', e);
      }
    }

    // Fallback if AI fails
    if (!ragResponse) {
      console.log(`[style-recommend] AI failed, using DNA 2.0 fallback selection`);
      
      const selectedIds: string[] = [];
      let remainingBudget = budget;
      let lastFormality = 5;
      
      // Select ONE from each priority category with formality matching
      for (const cat of CATEGORY_PRIORITY) {
        let catProducts = productsByPriority[cat]?.filter(p => p.price <= remainingBudget) || [];
        
        // Formality 유사도로 정렬
        catProducts = catProducts.sort((a, b) => {
          const fA = a.dna_meta?.formality || 5;
          const fB = b.dna_meta?.formality || 5;
          return Math.abs(fA - lastFormality) - Math.abs(fB - lastFormality);
        });
        
        if (catProducts.length > 0) {
          const selected = catProducts[0];
          selectedIds.push(selected.id);
          remainingBudget -= selected.price;
          lastFormality = selected.dna_meta?.formality || 5;
        }
      }
      
      // DNA 기반 fallback도 풍부한 설명 생성
      const selectedFallbackProducts = selectedIds.map(id => {
        for (const cat of CATEGORY_PRIORITY) {
          const found = productsByPriority[cat]?.find(p => p.id === id);
          if (found) return found;
        }
        return null;
      }).filter(Boolean);
      
      const fallbackBrands = [...new Set(selectedFallbackProducts.map(p => p?.brand).filter(Boolean))].slice(0, 2);
      const fallbackConcepts = [...new Set(selectedFallbackProducts.flatMap(p => p?.dna_meta?.concepts || []))].slice(0, 3);
      
      // 🎯 Fallback도 최고의 스타일리스트 톤으로!
      const topProduct = selectedFallbackProducts.find(p => p?.dna_meta?.item_slot === 'top');
      const bottomProduct = selectedFallbackProducts.find(p => p?.dna_meta?.item_slot === 'bottom' || p?.dna_meta?.item_slot === 'dress');
      const outerProduct = selectedFallbackProducts.find(p => p?.dna_meta?.item_slot === 'outer');
      const etcProduct = selectedFallbackProducts.find(p => ['shoes', 'bag', 'accessory'].includes(p?.dna_meta?.item_slot || ''));
      
      // 훅 문장 - 핵심 포인트
      let fallbackReasoning = '';
      if (fallbackConcepts.length > 0) {
        fallbackReasoning = `이 룩의 핵심은 '${fallbackConcepts[0]}'예요. `;
      } else {
        fallbackReasoning = `이 룩의 핵심은 '${occasion}에 완벽한 균형감'이에요. `;
      }
      
      // 중간 설명 - 상하의 조화
      if (topProduct && bottomProduct) {
        const topBrand = topProduct.brand || '';
        const topName = (topProduct.name || '').split(' ').slice(0, 2).join(' ');
        const bottomBrand = bottomProduct.brand || '';
        const bottomName = (bottomProduct.name || '').split(' ').slice(0, 2).join(' ');
        const topFormality = topProduct.dna_meta?.formality || 5;
        const bottomFormality = bottomProduct.dna_meta?.formality || 5;
        const avgFormality = (topFormality + bottomFormality) / 2;
        const formalityDesc = avgFormality > 6 ? '격식 있으면서도 자연스러운' : '캐주얼하면서도 세련된';
        
        fallbackReasoning += `${topBrand} ${topName}이(가) 상체 비율을 잡아주고, ${bottomBrand} ${bottomName}이(가) 하체 라인을 정돈해주거든요. ${formalityDesc} 무드가 완성되죠. `;
      }
      
      // 아우터나 액세서리로 킬링 포인트
      if (outerProduct) {
        const outerName = (outerProduct.name || '').split(' ').slice(0, 2).join(' ');
        fallbackReasoning += `킬링 포인트? ${outerProduct.brand || ''} ${outerName}의 레이어링이 ${occasion} 분위기를 완성해요!`;
      } else if (etcProduct) {
        const etcName = (etcProduct.name || '').split(' ').slice(0, 2).join(' ');
        fallbackReasoning += `킬링 포인트? ${etcProduct.brand || ''} ${etcName}이(가) 전체 룩에 센스를 더해요!`;
      } else {
        fallbackReasoning += `킬링 포인트? 각 아이템의 formality 밸런스가 ${occasion}에서 자연스러운 시선 집중을 만들죠!`;
      }
      
      ragResponse = {
        lookName: fallbackConcepts.length > 0 
          ? `${fallbackConcepts[0]} ${gender} ${occasion} 룩`
          : `${gender} ${occasion} 추천 룩`,
        styleConcept: fallbackBrands.length > 0
          ? `👗 "${fallbackBrands.join(' × ')}" 브랜드로 완성한 ${gender} ${occasion} 스타일`
          : `👗 ${gender} ${occasion} 스타일 - "${userRequest.slice(0, 25)}..."에 맞춘 코디`,
        styleReasoning: fallbackReasoning,
        selectedProductIds: selectedIds,
        stylingTips: '나만의 악세서리로 포인트를 더해보세요!'
      };
    }

    // Step 5: Enforce STRICT 1 per category - GPT 선택 제품만 사용
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    const lookItems: LookItem[] = [];
    let runningTotal = 0;
    const usedCategories = new Set<string>();
    
    // GPT가 선택한 제품 ID 목록 (순서 유지)
    const gptSelectedIds = ragResponse.selectedProductIds || [];
    console.log(`[style-recommend] GPT selected IDs: ${gptSelectedIds.join(', ')}`);
    console.log(`[style-recommend] DB returned products: ${selectedProducts?.length || 0}`);
    
    if (selectedProducts && selectedProducts.length > 0) {
      // GPT가 선택한 순서대로 정렬 (중요: reasoning과 일치하도록)
      const sortedProducts = gptSelectedIds
        .map(id => selectedProducts.find(p => p.id === id))
        .filter(Boolean) as typeof selectedProducts;
      
      console.log(`[style-recommend] Products matched to GPT order: ${sortedProducts.length}`);
      
      for (const product of sortedProducts) {
        const priorityCat = product.dna_meta?.item_slot
          ? itemSlotToPriorityCategory(product.dna_meta.item_slot)
          : mapToPriorityCategory(product.category, product.sub_category, product.name);
        const displayCat = getDisplaySubCategory(product.category, product.sub_category, product.name, product.dna_meta);
        
        if (priorityCat === 'unknown') continue;
        if (usedCategories.has(priorityCat)) continue;
        
        usedCategories.add(priorityCat);
        
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        
        // 모든 추천 상품은 기본 선택 (예산 제한 제거)
        const isAutoSelected = true;
        
        lookItems.push({
          category: displayCat,
          product: product,
          affiliateUrl,
          source: 'cache',
          isAutoSelected
        });
        
        console.log(`[style-recommend] Added ${priorityCat} (${displayCat}): ${product.name} (formality: ${product.dna_meta?.formality || 'N/A'})`);
      }
    }

    // Step 6: ENSURE MINIMUM 4 ITEMS with formality matching
    const MIN_ITEMS = 4;
    let lastFormality = 5;
    let wasAutoFilled = false;
    
    if (lookItems.length > 0 && lookItems[0].product?.dna_meta?.formality) {
      lastFormality = lookItems[0].product.dna_meta.formality;
    }
    
    if (lookItems.length < MIN_ITEMS) {
      console.log(`[style-recommend] Only ${lookItems.length} items, need ${MIN_ITEMS}. Auto-filling with formality matching...`);
      wasAutoFilled = true;
      
      for (const cat of CATEGORY_PRIORITY) {
        if (usedCategories.has(cat)) continue;
        if (lookItems.length >= MIN_ITEMS) break;
        
        let catProducts = productsByPriority[cat] || [];
        
        // Formality 유사도로 정렬
        catProducts = catProducts.sort((a, b) => {
          const fA = a.dna_meta?.formality || 5;
          const fB = b.dna_meta?.formality || 5;
          return Math.abs(fA - lastFormality) - Math.abs(fB - lastFormality);
        });
        
        if (catProducts.length > 0) {
          const product = catProducts[0];
          const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
          const displayCat = getDisplaySubCategory(product.category, product.sub_category, product.name, product.dna_meta);
          
          const wouldBeWithinBudget = runningTotal + product.price <= budget;
          if (wouldBeWithinBudget) {
            runningTotal += product.price;
          }
          
          lookItems.push({
            category: displayCat,
            product: product,
            affiliateUrl,
            source: 'cache',
            isAutoSelected: wouldBeWithinBudget
          });
          usedCategories.add(cat);
          lastFormality = product.dna_meta?.formality || lastFormality;
          console.log(`[style-recommend] Auto-added ${cat} (${displayCat}): ${product.name} (formality: ${product.dna_meta?.formality || 'N/A'})`);
        }
      }
    }
    
    // Step 7: Final sort by priority
    lookItems.sort((a, b) => {
      const aPriorityCat = a.product?.dna_meta?.item_slot
        ? itemSlotToPriorityCategory(a.product.dna_meta.item_slot)
        : mapToPriorityCategory(a.product?.category || '', a.product?.sub_category, a.product?.name);
      const bPriorityCat = b.product?.dna_meta?.item_slot
        ? itemSlotToPriorityCategory(b.product.dna_meta.item_slot)
        : mapToPriorityCategory(b.product?.category || '', b.product?.sub_category, b.product?.name);
      const aIdx = CATEGORY_PRIORITY.indexOf(aPriorityCat);
      const bIdx = CATEGORY_PRIORITY.indexOf(bPriorityCat);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    console.log(`[style-recommend] Final item count: ${lookItems.length}, Categories: ${Array.from(usedCategories).join(', ')}`);

    const totalPrice = lookItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedTotal = lookItems.filter(i => i.isAutoSelected).reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const autoSelectedCount = lookItems.filter(i => i.isAutoSelected).length;

    // Step 8: 🎯 실제 선택된 제품 기반으로 styleReasoning 재생성 (불일치 방지)
    let finalStyleReasoning = ragResponse?.styleReasoning || ragResponse?.stylingTips || '';
    
    // GPT가 선택하지 않은 제품이 추가된 경우 OR reasoning이 비어있는 경우 → 실제 제품 기반 재생성
    if (wasAutoFilled || !finalStyleReasoning) {
      console.log(`[style-recommend] Regenerating styleReasoning based on actual products (wasAutoFilled: ${wasAutoFilled})`);
      
      const topProduct = lookItems.find(l => {
        const slot = l.product?.dna_meta?.item_slot;
        return slot === 'top';
      })?.product;
      const bottomProduct = lookItems.find(l => {
        const slot = l.product?.dna_meta?.item_slot;
        return slot === 'bottom' || slot === 'dress';
      })?.product;
      const outerProduct = lookItems.find(l => {
        const slot = l.product?.dna_meta?.item_slot;
        return slot === 'outer';
      })?.product;
      const etcProduct = lookItems.find(l => {
        const slot = l.product?.dna_meta?.item_slot;
        return slot === 'shoes' || slot === 'bag' || slot === 'accessory';
      })?.product;
      
      const actualBrands = [...new Set(lookItems.map(l => l.product?.brand).filter(Boolean))].slice(0, 3);
      const actualConcepts = [...new Set(lookItems.flatMap(l => l.product?.dna_meta?.concepts || []))].slice(0, 3);
      
      // 실제 아이템 기반 reasoning 생성
      let newReasoning = '';
      
      // 훅 문장
      if (actualConcepts.length > 0) {
        newReasoning = `이 룩의 핵심은 '${actualConcepts[0]}'예요. `;
      } else {
        newReasoning = `이 룩의 핵심은 '${occasion}에 어울리는 균형감'이에요. `;
      }
      
      // 중간 설명 - 실제 상하의 조화
      if (topProduct && bottomProduct) {
        const topBrand = topProduct.brand || '';
        const topName = (topProduct.name || '').split(' ').slice(0, 3).join(' ');
        const bottomBrand = bottomProduct.brand || '';
        const bottomName = (bottomProduct.name || '').split(' ').slice(0, 3).join(' ');
        newReasoning += `${topBrand} ${topName}이(가) 상체 라인을 잡아주고, ${bottomBrand} ${bottomName}이(가) 하체 실루엣을 완성해주거든요. `;
      } else if (topProduct) {
        const topBrand = topProduct.brand || '';
        const topName = (topProduct.name || '').split(' ').slice(0, 3).join(' ');
        newReasoning += `${topBrand} ${topName}이(가) 이 룩의 중심을 잡아줘요. `;
      }
      
      // 킬링 포인트 - 아우터 또는 액세서리
      if (outerProduct) {
        const outerBrand = outerProduct.brand || '';
        const outerName = (outerProduct.name || '').split(' ').slice(0, 3).join(' ');
        newReasoning += `킬링 포인트? ${outerBrand} ${outerName}의 레이어링이 ${occasion} 무드를 완성해요!`;
      } else if (etcProduct) {
        const etcBrand = etcProduct.brand || '';
        const etcName = (etcProduct.name || '').split(' ').slice(0, 3).join(' ');
        newReasoning += `킬링 포인트? ${etcBrand} ${etcName}이(가) 전체 룩에 센스를 더해요!`;
      } else {
        newReasoning += `킬링 포인트? 각 아이템의 조화로운 밸런스가 ${occasion}에서 자연스러운 시선 집중을 만들어요!`;
      }
      
      finalStyleReasoning = newReasoning;
      console.log(`[style-recommend] Generated new reasoning: ${finalStyleReasoning.slice(0, 150)}...`);
    }

    // Save to cache - 이제 styleReasoning도 함께 저장!
    if (lookItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: lookItems.map(l => l.product!.id),
        image_url: lookItems[0].product!.image_url || '',
        use_count: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // 🎯 GPT 생성 내용도 캐시에 저장!
        style_reasoning: finalStyleReasoning || null,
        style_concept: ragResponse?.styleConcept || null,
        look_name: ragResponse?.lookName || null,
      };

      await supabase.from('style_cache').upsert(lookData, { onConflict: 'cache_key' });
      console.log(`[style-recommend] Cached with styleReasoning (${finalStyleReasoning?.length || 0} chars)`);
    }
    
    const response = {
      success: true,
      cacheHit: false,
      look: {
        name: ragResponse?.lookName || '스타일 추천',
        styleConcept: ragResponse?.styleConcept || '오늘의 룩',
        styleReasoning: finalStyleReasoning,
        items: lookItems,
        totalPrice,
        autoSelectedTotal,
        autoSelectedCount,
        budget,
        stylingTips: ragResponse?.stylingTips || finalStyleReasoning,
      },
      apiCalls: { gpt5: gptCalls, serpapi: 0 },
      stats: {
        productsInContext: uniqueProducts.length,
        selectedProducts: lookItems.length,
        autoSelectedProducts: autoSelectedCount,
        dna2Stats: dnaStats,
      }
    };

    console.log(`[style-recommend] Complete. ${lookItems.length} items, Total: ₩${totalPrice}`);
    console.log(`[style-recommend] Final styleReasoning length: ${finalStyleReasoning.length}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[style-recommend] Error:', error);
    
    // Log the error
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await logError(
        supabase,
        'style-recommend',
        'EXCEPTION',
        error instanceof Error ? error.message : String(error),
        null,
        requestPayload ? { userRequest: requestPayload.userRequest?.slice(0, 100), gender: requestPayload.gender } : null,
        Date.now() - startTime
      );
    } catch (logErr) {
      console.error('[style-recommend] Failed to log error:', logErr);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'EXCEPTION'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function detectSeason(request: string): string | null {
  const seasonKeywords: Record<string, string[]> = {
    '봄': ['봄', '봄철', '3월', '4월', '5월', '벚꽃', '나들이', '산뜻'],
    '여름': ['여름', '여름철', '6월', '7월', '8월', '더운', '시원한', '바캉스', '휴가', '해변'],
    '가을': ['가을', '가을철', '9월', '10월', '11월', '단풍', '선선한'],
    '겨울': ['겨울', '겨울철', '12월', '1월', '2월', '추운', '따뜻한', '크리스마스', '눈', '스키'],
  };
  
  for (const [season, keywords] of Object.entries(seasonKeywords)) {
    if (keywords.some(kw => request.includes(kw))) {
      return season;
    }
  }
  return null;
}

async function generateAffiliateUrl(
  product: CachedProduct, 
  merchants: any[], 
  affiliateId: string
): Promise<string | null> {
  if (!product.product_url) return null;

  // 머천트 딥링크 템플릿 우선 사용 (더 안정적)
  if (product.merchant_id) {
    const merchant = merchants.find(m => m.id === product.merchant_id);
    if (merchant?.deeplink_template) {
      const encodedUrl = encodeURIComponent(product.product_url);
      const affiliateUrl = merchant.deeplink_template
        .replace('{affiliate_id}', affiliateId)
        .replace('{encoded_url}', encodedUrl)
        .replace('{url}', encodedUrl);
      console.log(`[generateAffiliateUrl] ${merchant.name}: ${product.product_url} -> ${affiliateUrl}`);
      return affiliateUrl;
    }
  }

  // Fallback: LinkPrice API (머천트 템플릿이 없는 경우)
  try {
    const encodedUrl = encodeURIComponent(product.product_url);
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${affiliateId}&url=${encodedUrl}&mode=json`;
    
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const responseText = await response.text();
      try {
        const linkPriceData = JSON.parse(responseText);
        if (linkPriceData.result === 'S' && linkPriceData.url) {
          console.log(`[generateAffiliateUrl] LinkPrice API: ${product.product_url} -> ${linkPriceData.url}`);
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

// 패턴 키 생성 (자체 학습용)
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
