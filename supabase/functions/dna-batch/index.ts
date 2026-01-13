import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  target: 'adult_female' | 'adult_male' | 'kids_female' | 'kids_male' | 'kids_unisex' | 'unisex';
  item_slot: 'top' | 'bottom' | 'outer' | 'shoes' | 'bag' | 'accessory' | 'dress';
  concepts: string[];
  formality: number;
  pair_slots: string[];
  occasions: string[];
  color_family: 'neutral' | 'warm' | 'cool' | 'bold' | 'pastel';
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

// 성별 정규화 (키즈 포함)
function normalizeTarget(gender: string | null, name: string): DNAMeta['target'] {
  const nameLower = name.toLowerCase();
  const genderLower = (gender || '').toLowerCase();
  
  const kidsKeywords = ['키즈', 'kids', 'children', '아동', '유아', '주니어', 'junior', 'baby', '베이비', 'boy', 'girl', '남아', '여아'];
  const isKids = kidsKeywords.some(k => nameLower.includes(k) || genderLower.includes(k));
  
  if (isKids) {
    if (['여아', 'girl', '여자아이'].some(k => nameLower.includes(k) || genderLower.includes(k))) return 'kids_female';
    if (['남아', 'boy', '남자아이'].some(k => nameLower.includes(k) || genderLower.includes(k))) return 'kids_male';
    return 'kids_unisex';
  }
  
  if (['여성', 'women', 'woman', 'female', 'f', 'w', 'ladies', 'lady'].some(k => genderLower.includes(k))) return 'adult_female';
  if (['남성', 'men', 'man', 'male', 'm', 'gentleman'].some(k => genderLower.includes(k))) return 'adult_male';
  if (['unisex', '유니섹스', '공용'].some(k => genderLower.includes(k))) return 'unisex';
  
  if (['여성', 'women', 'woman', 'ladies'].some(k => nameLower.includes(k))) return 'adult_female';
  if (['남성', 'men', 'man', 'gentleman'].some(k => nameLower.includes(k))) return 'adult_male';
  
  return 'unisex';
}

// 색상 패밀리 추론
function inferColorFamily(color: string | null, name: string): DNAMeta['color_family'] {
  const combined = `${color || ''} ${name}`.toLowerCase();
  
  const neutralColors = ['검정', 'black', '블랙', '흰색', 'white', '화이트', '회색', 'gray', 'grey', '그레이', '베이지', 'beige', '아이보리', 'ivory', '크림', 'cream', '브라운', 'brown', '갈색', '카키', 'khaki', '네이비', 'navy'];
  const warmColors = ['빨강', 'red', '레드', '오렌지', 'orange', '주황', '노랑', 'yellow', '옐로우', '핑크', 'pink', '분홍', '코랄', 'coral', '버건디', 'burgundy', '와인', 'wine', '테라코타', 'terracotta'];
  const coolColors = ['파랑', 'blue', '블루', '민트', 'mint', '하늘색', 'sky', '청록', 'teal', '퍼플', 'purple', '보라', '라벤더', 'lavender'];
  const boldColors = ['형광', 'neon', '비비드', 'vivid', '브라이트', 'bright', '원색', '강렬'];
  const pastelColors = ['파스텔', 'pastel', '연한', '라이트', 'light', '소프트', 'soft', '밝은'];
  
  if (boldColors.some(c => combined.includes(c))) return 'bold';
  if (pastelColors.some(c => combined.includes(c))) return 'pastel';
  if (warmColors.some(c => combined.includes(c))) return 'warm';
  if (coolColors.some(c => combined.includes(c))) return 'cool';
  if (neutralColors.some(c => combined.includes(c))) return 'neutral';
  
  return 'neutral';
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

// 컨셉 추론 (스타일 태그 + 가격대 + 브랜드)
function inferConcepts(product: Product, formality: number): string[] {
  const concepts: string[] = [];
  const nameLower = product.name.toLowerCase();
  
  // 스타일 태그에서 추출
  if (product.style_tags && product.style_tags.length > 0) {
    concepts.push(...product.style_tags.slice(0, 3));
  }
  
  // 이름에서 스타일 키워드 추출
  const styleMap: Record<string, string[]> = {
    '캐주얼': ['캐주얼', 'casual', '데일리', 'daily'],
    '미니멀': ['미니멀', 'minimal', '심플', 'simple', '베이직', 'basic'],
    '모던': ['모던', 'modern', '시크', 'chic'],
    '클래식': ['클래식', 'classic', '트래디셔널', 'traditional'],
    '스트릿': ['스트릿', 'street', '힙합', 'hiphop', '오버사이즈', 'oversize'],
    '스포티': ['스포티', 'sporty', '애슬레저', 'athleisure', '액티브', 'active'],
    '로맨틱': ['로맨틱', 'romantic', '페미닌', 'feminine', '러블리', 'lovely'],
    '빈티지': ['빈티지', 'vintage', '레트로', 'retro'],
  };
  
  for (const [style, keywords] of Object.entries(styleMap)) {
    if (keywords.some(k => nameLower.includes(k))) {
      if (!concepts.includes(style)) {
        concepts.push(style);
      }
    }
  }
  
  // 포멀리티 기반 기본 컨셉 추가
  if (concepts.length === 0) {
    if (formality >= 7) {
      concepts.push('포멀', '비즈니스');
    } else if (formality >= 5) {
      concepts.push('세미캐주얼', '스마트');
    } else {
      concepts.push('캐주얼', '데일리');
    }
  }
  
  return concepts.slice(0, 5);
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

// DNA 2.0 생성 (AI 없이 빠르게 처리)
function generateDNA(product: Product): DNAResult {
  const { category: inferredCategory, subCategory } = inferCategory(product.name, product.category);
  
  const target = normalizeTarget(product.gender, product.name);
  const itemSlot = categoryToItemSlot(inferredCategory, subCategory);
  const colorFamily = inferColorFamily(product.color, product.name);
  const seasonFit = inferSeasonFit(product.name, inferredCategory);
  
  // 가격대로 formality 추론
  let formality = 5;
  if (product.price > 300000) formality = 8;
  else if (product.price > 150000) formality = 7;
  else if (product.price > 80000) formality = 6;
  else if (product.price < 30000) formality = 3;
  else if (product.price < 50000) formality = 4;
  
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
  
  // dna_text는 dna_meta 기반으로 자동 생성
  const dnaText = generateDNAText(product, dnaMeta, subCategory);
  
  return {
    id: product.id,
    dna_text: dnaText,
    dna_meta: dnaMeta,
    category: inferredCategory,
    sub_category: subCategory || undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 50 } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 배치 사이즈 제한 (AI 호출 없으므로 더 많이 처리 가능)
    const effectiveBatchSize = Math.min(batchSize, 100);
    
    console.log(`[dna-batch] DNA 2.0 빠른 생성 시작, batchSize: ${effectiveBatchSize}`);
    
    // dna_meta가 없는 상품 조회
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
      
      return new Response(JSON.stringify({
        success: true,
        message: 'DNA 2.0 생성 완료 - 모든 상품에 dna_meta가 있습니다',
        processed: 0,
        remaining: 0,
        total: totalCount || 0,
        coverage: totalCount ? `${Math.round((withMetaCount || 0) / totalCount * 100)}%` : '100%',
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
    
    // 통계 계산
    const targetStats: Record<string, number> = {};
    const slotStats: Record<string, number> = {};
    const formalitySum = results.reduce((sum, r) => sum + r.dna_meta.formality, 0);
    
    for (const result of results) {
      targetStats[result.dna_meta.target] = (targetStats[result.dna_meta.target] || 0) + 1;
      slotStats[result.dna_meta.item_slot] = (slotStats[result.dna_meta.item_slot] || 0) + 1;
    }
    
    console.log(`[dna-batch] 완료: ${updatedCount}개 업데이트, ${errors.length}개 에러, ${(remainingCount || 0) - products.length}개 남음, 총 ${totalTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      processed: products.length,
      updated: updatedCount,
      errors: errors.length,
      remaining: Math.max(0, (remainingCount || 0) - products.length),
      timeMs: totalTime,
      avgTimePerProduct: Math.round(totalTime / products.length),
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
