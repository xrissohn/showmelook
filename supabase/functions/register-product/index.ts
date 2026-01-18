import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= Interfaces =============
interface ProductInput {
  merchant_id: string;
  product_url: string;
  external_id?: string;
  name: string;
  brand?: string;
  price: number;
  original_price?: number;
  image_url: string;  // 필수
  category: string;
  sub_category?: string;
  sizes?: string[];
  is_in_stock?: boolean;
  style_tags?: string[];
  gender?: string;
  color?: string;
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

interface RegistrationResult {
  success: boolean;
  product_id?: string;
  image_stored: boolean;
  dna_generated: boolean;
  error?: string;
  step_failed?: 'upsert' | 'image' | 'dna';
}

// ============= DNA Generation Functions =============
function inferCategory(name: string, currentCategory: string): { category: string; subCategory: string } {
  const nameLower = name.toLowerCase();
  const nameKr = name;
  
  const topKeywords = ['니트', '스웨터', '셔츠', '블라우스', '티셔츠', 't-shirt', 'tee', 'shirt', 'sweater', 'knit', 'top', '탑', '카디건', 'cardigan', '후드', 'hoodie', '맨투맨', 'sweatshirt', '폴로', 'polo', '베스트', 'vest', '조끼'];
  const bottomKeywords = ['팬츠', '바지', 'pants', 'trousers', 'jeans', '진', '청바지', '슬랙스', 'slacks', '쇼츠', 'shorts', '반바지', '스커트', 'skirt', '치마', '레깅스', 'leggings'];
  const outerKeywords = ['코트', 'coat', '재킷', 'jacket', '점퍼', 'jumper', '블레이저', 'blazer', '패딩', 'puffer', '다운', 'down', '파카', 'parka', '트렌치', 'trench', '후리스', 'fleece', '무스탕', '야상'];
  const shoeKeywords = ['신발', 'shoes', '스니커즈', 'sneakers', '부츠', 'boots', '로퍼', 'loafers', '샌들', 'sandals', '슬리퍼', 'slippers', '펌프스', 'pumps', '힐', 'heels', '플랫', 'flats', '더비', 'derby', '옥스포드', 'oxford', '슈즈'];
  const bagKeywords = ['가방', 'bag', '백', '토트', 'tote', '크로스백', 'crossbody', '숄더백', 'shoulder', '클러치', 'clutch', '백팩', 'backpack', '파우치', 'pouch', '사첼'];
  const accessoryKeywords = ['액세서리', 'accessory', '목걸이', 'necklace', '귀걸이', 'earring', '반지', 'ring', '팔찌', 'bracelet', '시계', 'watch', '모자', 'hat', '캡', 'cap', '스카프', 'scarf', '벨트', 'belt', '선글라스', 'sunglasses', '안경', '머플러', 'muffler'];
  const dressKeywords = ['원피스', 'dress', '드레스', '점프수트', 'jumpsuit', '롬퍼', 'romper'];
  
  const checkKeywords = (keywords: string[]) => keywords.some(kw => nameLower.includes(kw) || nameKr.includes(kw));
  
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

function inferSeasonFit(name: string, category: string): string[] {
  const combined = `${name} ${category}`.toLowerCase();
  
  const summerKeywords = ['반팔', '반바지', 'shorts', '샌들', 'sandal', '린넨', 'linen', '슬리퍼', 'sleeveless', '민소매', '크롭', 'crop'];
  const winterKeywords = ['패딩', 'padding', 'puffer', '코트', 'coat', '다운', 'down', '기모', '울', 'wool', '캐시미어', 'cashmere', '부츠', 'boots', '털', 'fur', '머플러', 'muffler', '장갑', 'gloves'];
  const springFallKeywords = ['가디건', 'cardigan', '트렌치', 'trench', '자켓', 'jacket', '니트', 'knit'];
  
  const seasons: string[] = [];
  
  if (summerKeywords.some(k => combined.includes(k))) seasons.push('summer');
  if (winterKeywords.some(k => combined.includes(k))) seasons.push('winter');
  if (springFallKeywords.some(k => combined.includes(k))) seasons.push('spring', 'fall');
  
  if (seasons.length === 0) return ['spring', 'summer', 'fall', 'winter'];
  
  return [...new Set(seasons)];
}

function inferConcepts(name: string, styleTags: string[] | null, formality: number): string[] {
  const concepts: string[] = [];
  const nameLower = name.toLowerCase();
  
  if (styleTags && styleTags.length > 0) {
    concepts.push(...styleTags.slice(0, 3));
  }
  
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
      if (!concepts.includes(style)) concepts.push(style);
    }
  }
  
  if (concepts.length === 0) {
    if (formality >= 7) concepts.push('클래식', '포멀');
    else if (formality >= 5) concepts.push('세미캐주얼', '스마트');
    else concepts.push('캐주얼', '데일리');
  }
  
  return concepts.slice(0, 5);
}

function inferOccasions(formality: number, itemSlot: DNAMeta['item_slot'], concepts: string[]): string[] {
  const occasions: string[] = [];
  
  if (formality >= 7) occasions.push('출근', '미팅', '비즈니스', '면접');
  else if (formality >= 5) occasions.push('데이트', '약속', '모임', '세미포멀');
  else occasions.push('데일리', '캐주얼', '주말', '여행');
  
  if (concepts.includes('스포티') || concepts.includes('액티브')) occasions.push('운동', '레저');
  if (concepts.includes('로맨틱') || concepts.includes('페미닌')) occasions.push('데이트', '파티');
  
  return [...new Set(occasions)].slice(0, 5);
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
  }
  
  return pairs;
}

function generateDNAText(name: string, brand: string | null, meta: DNAMeta, subCategory: string): string {
  const conceptsStr = meta.concepts.slice(0, 3).join(',');
  const brandInfo = brand || '데일리';
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

function generateDNA(product: ProductInput): { dna_meta: DNAMeta; dna_text: string; category: string; sub_category: string } {
  const { category: inferredCategory, subCategory } = inferCategory(product.name, product.category);
  
  const target = normalizeTarget(product.gender || null, product.name);
  const itemSlot = categoryToItemSlot(inferredCategory, subCategory);
  const colorFamily = inferColorFamily(product.color || null, product.name);
  const seasonFit = inferSeasonFit(product.name, inferredCategory);
  
  let formality = 5;
  if (product.price > 300000) formality = 8;
  else if (product.price > 150000) formality = 7;
  else if (product.price > 80000) formality = 6;
  else if (product.price < 30000) formality = 3;
  else if (product.price < 50000) formality = 4;
  
  const concepts = inferConcepts(product.name, product.style_tags || null, formality);
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
  
  const dnaText = generateDNAText(product.name, product.brand || null, dnaMeta, subCategory);
  
  return {
    dna_meta: dnaMeta,
    dna_text: dnaText,
    category: inferredCategory,
    sub_category: subCategory,
  };
}

// ============= Image Download & Storage =============
function getHighResImageUrl(imageUrl: string, merchantId: string): string {
  if (!imageUrl) return imageUrl;
  
  if (merchantId === 'paulsmith' && imageUrl.includes('w_614')) {
    return imageUrl.replace('w_614', 'w_1200');
  }
  if (merchantId === 'wconcept' && imageUrl.includes('w=')) {
    return imageUrl.replace(/w=\d+/, 'w=1200');
  }
  if (merchantId === 'posty' && imageUrl.includes('/resize/')) {
    return imageUrl.replace(/\/resize\/\d+/, '/resize/1200');
  }
  if (merchantId === 'stockx' && imageUrl.includes('?w=')) {
    return imageUrl.split('?')[0];
  }
  
  return imageUrl;
}

async function downloadAndStoreImage(
  supabase: any,
  productId: string,
  imageUrl: string,
  merchantId: string
): Promise<string | null> {
  try {
    const highResUrl = getHighResImageUrl(imageUrl, merchantId);
    console.log(`[Image] Downloading: ${highResUrl.substring(0, 80)}...`);
    
    const imageResponse = await fetch(highResUrl, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': highResUrl.split('/').slice(0, 3).join('/'),
      },
    });

    if (!imageResponse.ok) {
      console.error(`[Image] Failed to fetch: HTTP ${imageResponse.status}`);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('avif')) extension = 'avif';
    else if (contentType.includes('gif')) extension = 'gif';

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageUint8 = new Uint8Array(imageBuffer);

    if (imageUint8.length > 5 * 1024 * 1024) {
      console.error(`[Image] Too large: ${imageUint8.length} bytes`);
      return null;
    }
    
    if (imageUint8.length < 1000) {
      console.error(`[Image] Too small (likely error page): ${imageUint8.length} bytes`);
      return null;
    }

    const fileName = `${merchantId}/${productId}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageUint8, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Image] Upload failed:`, uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    console.log(`[Image] Stored: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`[Image] Error:`, error);
    return null;
  }
}

// ============= Main Registration Function =============
async function registerProduct(supabase: any, product: ProductInput): Promise<RegistrationResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/product-images`;
  
  // Step 1: Initial upsert with is_active = false (pending state)
  console.log(`[Register] Step 1: Upserting product "${product.name}"...`);
  
  const { data: upsertedProduct, error: upsertError } = await supabase
    .from('products_cache')
    .upsert({
      merchant_id: product.merchant_id,
      product_url: product.product_url,
      external_id: product.external_id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      original_price: product.original_price,
      image_url: product.image_url,  // Original URL initially
      category: product.category,
      sub_category: product.sub_category,
      sizes: product.sizes,
      is_in_stock: product.is_in_stock ?? true,
      style_tags: product.style_tags || [],
      gender: product.gender,
      color: product.color,
      is_active: false,  // Initially inactive until all steps complete
      updated_at: new Date().toISOString(),
      collected_at: new Date().toISOString(),
    }, {
      onConflict: 'product_url',
    })
    .select('id')
    .single();

  if (upsertError || !upsertedProduct) {
    console.error(`[Register] Upsert failed:`, upsertError);
    return {
      success: false,
      image_stored: false,
      dna_generated: false,
      error: `제품 등록 실패: ${upsertError?.message || 'Unknown error'}`,
      step_failed: 'upsert',
    };
  }

  const productId = upsertedProduct.id;
  console.log(`[Register] Product ID: ${productId}`);

  // Step 2: Download and store image (REQUIRED)
  console.log(`[Register] Step 2: Storing image...`);
  
  let storageUrl: string | null = null;
  
  // Skip if already stored in our storage
  if (product.image_url && !product.image_url.startsWith(storageBaseUrl)) {
    storageUrl = await downloadAndStoreImage(
      supabase,
      productId,
      product.image_url,
      product.merchant_id
    );
    
    if (!storageUrl) {
      // Rollback: Delete the product
      await supabase.from('products_cache').delete().eq('id', productId);
      
      return {
        success: false,
        product_id: productId,
        image_stored: false,
        dna_generated: false,
        error: `이미지 저장 실패: 원본 URL에서 이미지를 다운로드할 수 없습니다. URL: ${product.image_url?.substring(0, 100)}`,
        step_failed: 'image',
      };
    }
  } else {
    // Already in storage
    storageUrl = product.image_url;
  }

  // Step 3: Generate DNA metadata (REQUIRED)
  console.log(`[Register] Step 3: Generating DNA...`);
  
  try {
    const dnaResult = generateDNA(product);
    
    // Step 4: Final update with all data and activate
    console.log(`[Register] Step 4: Finalizing registration...`);
    
    const { error: finalUpdateError } = await supabase
      .from('products_cache')
      .update({
        image_url: storageUrl,
        category: dnaResult.category,
        sub_category: dnaResult.sub_category,
        dna_meta: dnaResult.dna_meta,
        dna_text: dnaResult.dna_text,
        dna_generated_at: new Date().toISOString(),
        is_active: true,  // Now active!
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (finalUpdateError) {
      // Rollback: Delete the product
      await supabase.from('products_cache').delete().eq('id', productId);
      
      return {
        success: false,
        product_id: productId,
        image_stored: true,
        dna_generated: false,
        error: `최종 업데이트 실패: ${finalUpdateError.message}`,
        step_failed: 'dna',
      };
    }

    console.log(`[Register] ✅ Product "${product.name}" registered successfully!`);
    
    return {
      success: true,
      product_id: productId,
      image_stored: true,
      dna_generated: true,
    };
    
  } catch (dnaError) {
    // Rollback: Delete the product
    await supabase.from('products_cache').delete().eq('id', productId);
    
    return {
      success: false,
      product_id: productId,
      image_stored: true,
      dna_generated: false,
      error: `DNA 생성 실패: ${dnaError}`,
      step_failed: 'dna',
    };
  }
}

// ============= HTTP Handler =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { products } = body as { products: ProductInput[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '등록할 제품이 없습니다. products 배열을 제공해주세요.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[register-product] Processing ${products.length} products...`);

    const results: RegistrationResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      // Validate required fields
      if (!product.name || !product.price || !product.merchant_id || !product.product_url) {
        results.push({
          success: false,
          image_stored: false,
          dna_generated: false,
          error: '필수 필드 누락: name, price, merchant_id, product_url 필요',
        });
        failCount++;
        continue;
      }

      if (!product.image_url) {
        results.push({
          success: false,
          image_stored: false,
          dna_generated: false,
          error: '이미지 URL이 없습니다. image_url은 필수입니다.',
        });
        failCount++;
        continue;
      }

      const result = await registerProduct(supabase, product);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    const allSuccess = failCount === 0;

    return new Response(JSON.stringify({
      success: allSuccess,
      message: allSuccess 
        ? `${successCount}개 제품이 모두 성공적으로 등록되었습니다.`
        : `${successCount}개 성공, ${failCount}개 실패. 실패한 제품은 재등록이 필요합니다.`,
      total: products.length,
      success_count: successCount,
      fail_count: failCount,
      results,
    }), {
      status: allSuccess ? 200 : 207,  // 207 Multi-Status for partial success
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[register-product] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
