// style-recommend v2.1 - fixed null target check
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    // target이 문자열인지 확인 (JSON 파싱 오류 또는 객체일 수 있음)
    const target = typeof meta.target === 'string' ? meta.target : String(meta.target || '');
    if (!target) return true;
    
    if (isKids) {
      // 키즈 요청 -> kids 타겟만
      return target.startsWith('kids_') || target === 'unisex';
    } else {
      // 성인 요청 -> kids 제외
      if (target.startsWith('kids_')) return false;
      
      // 성별 필터
      if (gender === '남성' && target === 'adult_female') return false;
      if (gender === '여성' && target === 'adult_male') return false;
      
      return true;
    }
  });
}

// 2차 필터: 컨셉 매칭 점수 계산
function calculateConceptScore(product: CachedProduct, requestedConcepts: string[]): number {
  const meta = product.dna_meta;
  if (!meta || !meta.concepts || requestedConcepts.length === 0) return 0.5; // 중립 점수
  
  const overlap = meta.concepts.filter(c => 
    requestedConcepts.some(rc => c.includes(rc) || rc.includes(c))
  );
  return overlap.length / Math.max(requestedConcepts.length, 1);
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

  try {
    const startTime = Date.now();
    const { userRequest, gender = '여성', budget = 200000, forceRefresh = false, age } = await req.json();

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

    const isKids = age !== undefined && age <= 12;
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

          const elapsed = Date.now() - startTime;
          console.log(`[style-recommend] Cache response in ${elapsed}ms`);

          return new Response(JSON.stringify({
            success: true,
            cacheHit: true,
            look: {
              name: `${gender} ${occasion} 추천 룩`,
              styleConcept: `🎨 ${gender} ${occasion} 스타일\n\n요청하신 "${userRequest}"에 맞춰 DNA 2.0 기반으로 코디를 구성했습니다.`,
              styleReasoning: `${gender}의 ${occasion} 상황에 적합한 아이템들을 DNA 2.0의 formality 매칭으로 선택했습니다.`,
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

    // Step 2: Fetch products with dna_meta (최적화된 쿼리)
    console.log(`[style-recommend] Fetching products with DNA 2.0 filtering...`);
    
    const productsByPriority: Record<string, CachedProduct[]> = {
      '상의': [],
      '하의': [],
      '아우터': [],
      '기타': [],
      'unknown': []
    };
    
    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? '봄' 
      : currentMonth >= 6 && currentMonth <= 8 ? '여름'
      : currentMonth >= 9 && currentMonth <= 11 ? '가을' : '겨울';
    const requestedSeason = detectSeason(userRequest) || currentSeason;
    
    // 최적화: 카테고리별로 분리 쿼리 + boost_score 반영
    const { data: allProductsRaw, error: productError } = await supabase
      .from('products_cache')
      .select('*, dna_text, dna_meta, dna_generated_at')
      .eq('is_active', true)
      .eq('is_in_stock', true)
      .not('image_url', 'is', null)
      .lte('price', budget * 1.5)
      .order('dna_generated_at', { ascending: false, nullsFirst: false })
      .limit(300); // 500 → 300으로 줄임 (속도 개선)
    
    if (productError) {
      console.error('[style-recommend] Product fetch error:', productError);
    }
    
    let allProducts: CachedProduct[] = allProductsRaw || [];
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
    
    // ============= DNA 2.0 2차 필터링: 컨셉/occasion/boost 점수 =============
    // 점수 기반 정렬 (boost_score 반영)
    const scoredProducts = allProducts.map(p => {
      const boostScore = (p.dna_meta as any)?.boost_score || 0;
      const isPatternSuggested = patternBasedIds.includes(p.id);
      
      return {
        product: p,
        conceptScore: calculateConceptScore(p, requestedConcepts),
        occasionScore: calculateOccasionScore(p, requestedOccasions),
        hasDNA: !!p.dna_meta,
        boostScore,
        isPatternSuggested,
        totalScore: 0, // 아래에서 계산
      };
    });
    
    // 종합 점수 계산
    for (const scored of scoredProducts) {
      scored.totalScore = 
        (scored.hasDNA ? 0.3 : 0) +
        (scored.conceptScore * 0.25) +
        (scored.occasionScore * 0.2) +
        (scored.boostScore * 0.15) +
        (scored.isPatternSuggested ? 0.1 : 0);
    }
    
    // 점수 기반 정렬 (총점 > DNA 있음 > 컨셉 점수)
    scoredProducts.sort((a, b) => {
      if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
      if (a.hasDNA !== b.hasDNA) return a.hasDNA ? -1 : 1;
      return b.conceptScore - a.conceptScore;
    });
    
    const topScoredProducts = scoredProducts.slice(0, 200);
    console.log(`[style-recommend] Top scored products: ${topScoredProducts.length}`);
    if (topScoredProducts.length > 0) {
      const topProduct = topScoredProducts[0];
      console.log(`[style-recommend] Best match: ${topProduct.product.name} (concept: ${topProduct.conceptScore.toFixed(2)}, occasion: ${topProduct.occasionScore.toFixed(2)})`);
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
    
    function diversifyByBrand(products: CachedProduct[], maxPerBrand: number = 5): CachedProduct[] {
      const byBrand: Record<string, CachedProduct[]> = {};
      
      for (const p of products) {
        const brand = p.brand || 'unknown';
        if (!byBrand[brand]) byBrand[brand] = [];
        byBrand[brand].push(p);
      }
      
      const diversified: CachedProduct[] = [];
      for (const brand of Object.keys(byBrand)) {
        const brandProducts = byBrand[brand].slice(0, maxPerBrand); // 이미 정렬됨
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
    
    // 각 카테고리에서 브랜드 다양성 적용
    for (const cat of CATEGORY_PRIORITY) {
      if (productsByPriority[cat]) {
        productsByPriority[cat] = diversifyByBrand(productsByPriority[cat], 8);
      }
    }
    productsByPriority['unknown'] = diversifyByBrand(productsByPriority['unknown'] || [], 5);
    
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

    // Step 4: RAG with GPT-5 (DNA 2.0 활용)
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
      console.log(`[style-recommend] Products for GPT: ${gptProducts.length} (diverse brands)`);
      
      // DNA 2.0 기반 컨텍스트 생성
      const dna2Products = gptProducts.filter(p => p.dnaMeta).slice(0, 25);
      const dna1Products = gptProducts.filter(p => p.dna && !p.dnaMeta).slice(0, 15);
      const noDnaProducts = gptProducts.filter(p => !p.dna && !p.dnaMeta).slice(0, 10);
      
      const dna2Context = dna2Products.length > 0 
        ? `\n🧬 DNA 2.0 분석 완료 (최우선):\n${dna2Products.map(p => 
            `• ${p.id}: [${p.brand}] ${p.name} [${p.priorityCategory}] ₩${p.price.toLocaleString()}\n  → 타겟: ${p.dnaMeta?.target}, 슬롯: ${p.dnaMeta?.slot}, 컨셉: ${p.dnaMeta?.concepts?.join(',')}, 격식: ${p.dnaMeta?.formality}/10, 색감: ${p.dnaMeta?.colorFamily}`
          ).join('\n')}`
        : '';
      
      const dna1Context = dna1Products.length > 0
        ? `\n📝 DNA 텍스트만 (차선):\n${dna1Products.map(p => `• ${p.id}: [${p.brand}] ${p.name} [${p.priorityCategory}] ₩${p.price.toLocaleString()} - ${p.dna}`).join('\n')}`
        : '';
      
      const noDnaContext = noDnaProducts.length > 0
        ? `\n📦 DNA 미분석:\n${noDnaProducts.map(p => `• ${p.id}: [${p.brand}] ${p.name} [${p.priorityCategory}] ₩${p.price.toLocaleString()}`).join('\n')}`
        : '';

      // 강화된 시스템 프롬프트 (DNA 2.0 + formality 매칭)
      const systemPrompt = `당신은 서울 청담동 20년 경력 셀럽 스타일리스트입니다.

🎯 DNA 2.0 기반 필수 규칙:
1. 정확히 4개 카테고리에서 각 1개씩 선택 (총 4개)
   - 상의 (slot: top)
   - 하의 (slot: bottom/dress)
   - 아우터 (slot: outer)
   - 기타 (slot: shoes/bag/accessory 중 1개)

2. 🔥 DNA 2.0 우선 선택! formality 점수 ±2 이내로 매칭!
   - 예: 상의 formality=7이면 하의도 5~9 범위에서 선택

3. 컨셉 일치: 요청 컨셉 "${requestedConcepts.join(', ')}"과 concepts 필드 매칭

4. 같은 브랜드 3개 이상 선택 금지!

5. 예산: ${budget.toLocaleString()}원 이내
6. 타겟: ${isKids ? '키즈' : gender}, 시즌: ${requestedSeason}
7. occasion: ${requestedOccasions.join(', ')}`;

      const userPrompt = `📍 고객 요청: "${userRequest}"
${dna2Context}
${dna1Context}
${noDnaContext}

⚠️ 중요: 
- DNA 2.0 상품 우선! formality 비슷한 것끼리 매칭!
- 상의 1개 + 하의 1개 + 아우터 1개 + 기타 1개 = 총 4개!
- 다양한 브랜드 조합으로 세련된 믹스매치!

JSON 응답:
{
  "lookName": "코디명",
  "styleConcept": "한줄 스타일 설명",
  "styleReasoning": "2문장 추천 이유 (formality 매칭 언급)",
  "selectedProductIds": ["상의id", "하의id", "아우터id", "기타id"]
}`;

      try {
        console.log('[style-recommend] Using GPT-5 with DNA 2.0 context...');
        const startTime = Date.now();
        
        const gptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        });

        gptCalls++;
        const elapsed = Date.now() - startTime;
        console.log(`[style-recommend] GPT-5 response in ${elapsed}ms`);

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          const content = gptData.choices?.[0]?.message?.content || '';
          
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            ragResponse = JSON.parse(jsonMatch[0]) as RAGStyleResponse;
            console.log(`[style-recommend] GPT-5 selected ${ragResponse.selectedProductIds.length} products in ${elapsed}ms`);
          }
        } else {
          const errorText = await gptResponse.text();
          console.error('[style-recommend] GPT-5 error:', gptResponse.status, errorText);
        }
      } catch (e) {
        console.error('[style-recommend] GPT-5 parsing error:', e);
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
      
      ragResponse = {
        lookName: `${gender} ${occasion} 추천 룩`,
        styleConcept: `🎨 ${gender} ${occasion} 스타일\n\n요청하신 "${userRequest}"에 맞춰 DNA 2.0 기반으로 코디를 구성했습니다.`,
        styleReasoning: `${gender}의 ${occasion} 상황에 적합한 아이템들을 DNA 2.0의 formality 매칭으로 선택했습니다.`,
        selectedProductIds: selectedIds,
        stylingTips: '자신만의 개성을 더해 스타일링해보세요.'
      };
    }

    // Step 5: Enforce STRICT 1 per category
    const { data: selectedProducts } = await supabase
      .from('products_cache')
      .select('*')
      .in('id', ragResponse.selectedProductIds);

    const lookItems: LookItem[] = [];
    let runningTotal = 0;
    const usedCategories = new Set<string>();
    
    if (selectedProducts) {
      // Sort by priority
      const sortedProducts = selectedProducts.sort((a, b) => {
        const aPriorityCat = a.dna_meta?.item_slot 
          ? itemSlotToPriorityCategory(a.dna_meta.item_slot)
          : mapToPriorityCategory(a.category, a.sub_category, a.name);
        const bPriorityCat = b.dna_meta?.item_slot
          ? itemSlotToPriorityCategory(b.dna_meta.item_slot)
          : mapToPriorityCategory(b.category, b.sub_category, b.name);
        const aIdx = CATEGORY_PRIORITY.indexOf(aPriorityCat);
        const bIdx = CATEGORY_PRIORITY.indexOf(bPriorityCat);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
      
      for (const product of sortedProducts) {
        const priorityCat = product.dna_meta?.item_slot
          ? itemSlotToPriorityCategory(product.dna_meta.item_slot)
          : mapToPriorityCategory(product.category, product.sub_category, product.name);
        const displayCat = getDisplaySubCategory(product.category, product.sub_category, product.name, product.dna_meta);
        
        if (priorityCat === 'unknown') continue;
        if (usedCategories.has(priorityCat)) continue;
        
        usedCategories.add(priorityCat);
        
        const affiliateUrl = await generateAffiliateUrl(product, merchants || [], LINKPRICE_AFFILIATE_ID);
        
        const wouldBeWithinBudget = runningTotal + product.price <= budget;
        const isAutoSelected = wouldBeWithinBudget;
        
        if (isAutoSelected) {
          runningTotal += product.price;
        }
        
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
    
    if (lookItems.length > 0 && lookItems[0].product?.dna_meta?.formality) {
      lastFormality = lookItems[0].product.dna_meta.formality;
    }
    
    if (lookItems.length < MIN_ITEMS) {
      console.log(`[style-recommend] Only ${lookItems.length} items, need ${MIN_ITEMS}. Auto-filling with formality matching...`);
      
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

    // Save to cache
    if (lookItems.length >= 2) {
      const lookData = {
        cache_key: cacheKey,
        product_ids: lookItems.map(l => l.product!.id),
        image_url: lookItems[0].product!.image_url || '',
        use_count: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      await supabase.from('style_cache').upsert(lookData, { onConflict: 'cache_key' });
    }

    const response = {
      success: true,
      cacheHit: false,
      look: {
        name: ragResponse.lookName,
        styleConcept: ragResponse.styleConcept,
        styleReasoning: ragResponse.styleReasoning,
        items: lookItems,
        totalPrice,
        autoSelectedTotal,
        autoSelectedCount,
        budget,
        stylingTips: ragResponse.stylingTips,
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

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[style-recommend] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
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
        // Not JSON, try as plain text
        if (responseText.startsWith('http')) {
          return responseText.trim();
        }
      }
    }
  } catch (error) {
    console.error('[generateAffiliateUrl] Error:', error);
  }

  // Fallback: 머천트별 딥링크 템플릿
  if (product.merchant_id) {
    const merchant = merchants.find(m => m.id === product.merchant_id);
    if (merchant?.deeplink_template) {
      return merchant.deeplink_template.replace('{url}', encodeURIComponent(product.product_url));
    }
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
