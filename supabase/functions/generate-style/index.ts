// generate-style v2.1 - with error logging and retry logic
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        console.log(`[generate-style] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[generate-style] Network error, waiting ${waitTime}ms before retry ${attempt + 1}...`);
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
    console.log(`[generate-style] Error logged: ${errorCode} - ${errorMessage.slice(0, 100)}`);
  } catch (logError) {
    console.error('[generate-style] Failed to log error:', logError);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let userId: string | null = null;
  let requestPayload: any = null;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user ID from token
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    } catch (e) {
      console.log('[generate-style] Could not extract user from token');
    }

    requestPayload = await req.json();
    const {
      style,
      products,
      productDetails,
      productImageUrls,
      userProfile,
      useFaceComposite,
      userAvatarUrl,
      styleTrendId,
      productIds
    } = requestPayload;

    console.log('[generate-style] Starting generation');
    console.log('[generate-style] Style:', style);
    console.log('[generate-style] Products:', products);
    console.log('[generate-style] Product details count:', productDetails?.length || 0);
    console.log('[generate-style] Product images count:', productImageUrls?.length || 0);
    console.log('[generate-style] Face composite:', useFaceComposite);
    console.log('[generate-style] Avatar URL:', userAvatarUrl ? userAvatarUrl.substring(0, 80) + '...' : 'none');

    // Build products description with color constraints and size hints from productDetails
    const buildProductsWithColors = (productDetails: any[], fallbackProducts: string): string => {
      if (!productDetails || productDetails.length === 0) {
        return fallbackProducts;
      }
      
      // 확장된 색상 키워드 매핑 (영문/한국어)
      const COLOR_KEYWORDS: Record<string, string> = {
        'white': 'white', '화이트': 'white', '흰': 'white', '백': 'white', 'wht': 'white',
        'black': 'black', '블랙': 'black', '검정': 'black', '흑': 'black', 'blk': 'black',
        'navy': 'navy', '네이비': 'navy',
        'blue': 'blue', '블루': 'blue', '파랑': 'blue', '파란': 'blue',
        'gray': 'gray', 'grey': 'gray', '그레이': 'gray', '회색': 'gray', '차콜': 'charcoal', 'charcoal': 'charcoal',
        'beige': 'beige', '베이지': 'beige',
        'brown': 'brown', '브라운': 'brown', '갈색': 'brown',
        'cream': 'cream', '크림': 'cream', 'ivory': 'ivory', '아이보리': 'ivory',
        'red': 'red', '레드': 'red', '빨강': 'red',
        'pink': 'pink', '핑크': 'pink',
        'green': 'green', '그린': 'green', '초록': 'green', 'olive': 'olive', '올리브': 'olive',
        'yellow': 'yellow', '옐로우': 'yellow', '노랑': 'yellow',
        'orange': 'orange', '오렌지': 'orange',
        'purple': 'purple', '퍼플': 'purple', '보라': 'purple',
        'khaki': 'khaki', '카키': 'khaki',
        'camel': 'camel', '카멜': 'camel', '캐멀': 'camel',
        'wine': 'wine', '와인': 'wine', 'burgundy': 'burgundy', '버건디': 'burgundy',
        'wheat': 'wheat/tan', 'tan': 'tan', '탄': 'tan',
        'sand': 'sand', '샌드': 'sand',
        'mint': 'mint', '민트': 'mint',
        'lavender': 'lavender', '라벤더': 'lavender',
        'coral': 'coral', '코랄': 'coral',
        'denim': 'denim blue', '데님': 'denim blue',
        'mocha': 'mocha brown', '모카': 'mocha brown',
        'oatmeal': 'oatmeal', '오트밀': 'oatmeal',
        'silver': 'silver', '실버': 'silver',
        'gold': 'gold', '골드': 'gold',
      };

      const parseColorsFromString = (str: string): string[] => {
        if (!str) return [];
        const lower = str.toLowerCase();
        const found: string[] = [];
        for (const [keyword, colorName] of Object.entries(COLOR_KEYWORDS)) {
          if (lower.includes(keyword)) {
            if (!found.includes(colorName)) found.push(colorName);
          }
        }
        return found;
      };

      return productDetails.map((p: any, idx: number) => {
        const brandPart = p.brand ? `${p.brand} ` : '';
        const name = p.name || 'Item';
        
        // Extract color_family from dna_meta or direct color field
        let colors: string[] = [];
        if (p.dna_meta?.color_family) {
          const rawColors = Array.isArray(p.dna_meta.color_family) 
            ? p.dna_meta.color_family 
            : [p.dna_meta.color_family];
          colors = rawColors.filter((c: string) => c && c !== 'unknown');
        }
        
        if (colors.length === 0 && p.color_family) {
          const rawColors = Array.isArray(p.color_family) ? p.color_family : [p.color_family];
          colors = rawColors.filter((c: string) => c && c !== 'unknown');
        }
        
        // color 필드에서 확장 파서로 추출
        if (colors.length === 0 && p.color) {
          colors = parseColorsFromString(String(p.color));
        }
        
        // 상품명에서도 색상 추출 시도
        if (colors.length === 0) {
          colors = parseColorsFromString(name);
        }
        
        // 다중 색상이 너무 많으면 (4개 이상) 상품 이미지 참조로 전환
        if (colors.length > 3) {
          colors = []; // 이미지 참조로 대체
        }
        
        // Build constraints array
        const constraints: string[] = [];
        
        // Add color constraint
        if (colors.length > 0) {
          constraints.push(`MUST be ${colors.join(' or ')} color ONLY`);
        } else {
          // 색상 정보 없으면 이미지 참조 지시
          constraints.push(`match the EXACT color from product image #${idx + 1}`);
        }
        
        // Check for small_accessory (wallet, card holder, etc.)
        const productName = p.name?.toLowerCase() || '';
        const isCardWallet = productName.includes('카드지갑') || productName.includes('카드홀더') || productName.includes('카드케이스');
        const isWallet = productName.includes('지갑') || productName.includes('반지갑') || productName.includes('머니클립');
        const isSmallAccessory = p.dna_meta?.small_accessory === true || 
                                 p.dna_meta?.small_accessory === 'true' ||
                                 isCardWallet || isWallet;
        
        if (isSmallAccessory) {
          if (isCardWallet) {
            constraints.push(`CRITICAL SIZE: This is a TINY card wallet - approximately 10cm x 7cm, about the size of a credit card. It should fit in ONE PALM. Do NOT render as a bag, purse, or handbag. Show it held between fingers or in a single hand, NOT slung over shoulder or arm.`);
          } else if (isWallet) {
            constraints.push(`SIZE: This is a small wallet - palm-sized accessory that fits in a pocket. Do NOT render as a bag or handbag. Show it held in one hand, NOT carried like a purse.`);
          } else {
            const sizeHint = p.dna_meta?.size_hint || 'palm-sized small accessory, NOT a bag';
            constraints.push(`SIZE: ${sizeHint} - this is a SMALL accessory held in hand, NOT a large bag`);
          }
        }
        
        return `${brandPart}${name} (${constraints.join('; ')})`;
      }).join('\n');
    };

    const productsWithColors = buildProductsWithColors(productDetails, products);
    console.log('[generate-style] Products with colors:', productsWithColors);

    // Build the image generation prompt
    const genderValue = userProfile?.gender?.toLowerCase() || '';
    const isFemale = genderValue === 'female' || genderValue === '여성' || genderValue === '여';
    const gender = isFemale ? '여성' : '남성';
    const height = userProfile?.height || 170;
    const bodyType = userProfile?.body_type || 'average';
    const fullName = userProfile?.full_name || '';
    const ageGroup = userProfile?.age_group || '';
    
    console.log('[generate-style] Profile gender:', userProfile?.gender, '-> Resolved:', gender);
    console.log('[generate-style] Profile name:', fullName);
    console.log('[generate-style] Age group:', ageGroup);

    // age_group을 분석하여 나이 범위 결정
    const parseAgeGroup = (ageGroup: string): { minAge: number; maxAge: number; category: string } => {
      if (!ageGroup) return { minAge: 30, maxAge: 40, category: 'adult_30s' };
      
      const ag = ageGroup.toLowerCase();
      
      if (ag.includes('infant') || ag.includes('영아') || ag.includes('baby') || ag.includes('0-12') || ag.includes('개월')) {
        return { minAge: 0, maxAge: 1, category: 'infant' };
      }
      if (ag.includes('toddler') || ag.includes('유아') || ag.includes('1-3') || ag.includes('2세') || ag.includes('3세')) {
        return { minAge: 1, maxAge: 3, category: 'toddler' };
      }
      if (ag.includes('preschool') || ag.includes('4-6') || ag.includes('4세') || ag.includes('5세') || ag.includes('6세')) {
        return { minAge: 4, maxAge: 6, category: 'preschool' };
      }
      if (ag.includes('child') || ag.includes('아동') || ag.includes('kids') || ag.includes('초등') || ag.includes('7-12') || ag.match(/[789]세|10세|11세|12세/)) {
        return { minAge: 7, maxAge: 12, category: 'child' };
      }
      if (ag.includes('teen') || ag.includes('청소년') || ag.includes('10대') || ag.includes('13-18') || ag.match(/1[345678]세/)) {
        return { minAge: 13, maxAge: 19, category: 'teen' };
      }
      if (ag.includes('20s') || ag.includes('20대')) {
        return { minAge: 20, maxAge: 29, category: 'adult_20s' };
      }
      if (ag.includes('30s') || ag.includes('30대')) {
        return { minAge: 30, maxAge: 39, category: 'adult_30s' };
      }
      if (ag.includes('40s') || ag.includes('40대')) {
        return { minAge: 40, maxAge: 49, category: 'adult_40s' };
      }
      if (ag.includes('50s') || ag.includes('50대')) {
        return { minAge: 50, maxAge: 59, category: 'adult_50s' };
      }
      if (ag.includes('60') || ag.includes('60대') || ag.includes('60plus') || ag.includes('60+') || ag.includes('60세 이상')) {
        return { minAge: 60, maxAge: 70, category: 'adult_60s' };
      }
      return { minAge: 30, maxAge: 40, category: 'adult_30s' };
    };

    const ageInfo = parseAgeGroup(ageGroup);
    console.log('[generate-style] Parsed age info:', ageInfo);
    
    // 체형 설명 생성 (키와 몸무게 기반)
    const weight = userProfile?.weight || null;
    const getBodyDescription = (height: number, weight: number | null, bodyType: string): string => {
      if (!weight) {
        // weight 없으면 bodyType만 사용
        switch (bodyType) {
          case 'slim': return 'slim build';
          case 'muscular': return 'muscular build';
          case 'curvy': return 'curvy/full-figured build';
          default: return 'average build';
        }
      }
      
      // BMI 계산
      const heightM = height / 100;
      const bmi = weight / (heightM * heightM);
      
      if (bmi < 18.5) {
        return 'slim/thin build, slender body';
      } else if (bmi >= 18.5 && bmi < 23) {
        return 'average/healthy build';
      } else if (bmi >= 23 && bmi < 25) {
        return 'slightly full build, average to slightly curvy';
      } else if (bmi >= 25 && bmi < 30) {
        return 'full-figured/curvy build, with a fuller midsection';
      } else {
        return 'plus-size/full-figured build, with a rounder physique';
      }
    };
    
    const bodyDescription = getBodyDescription(height, weight, bodyType);
    console.log('[generate-style] Body description:', bodyDescription, '(height:', height, 'weight:', weight, ')');

    const getModelDescription = (ageInfo: { minAge: number; maxAge: number; category: string }, gender: string, bodyDesc: string): string => {
      const genderKo = gender === '여성' ? '여자' : '남자';
      
      switch (ageInfo.category) {
        case 'infant':
          return `adorable Korean baby ${gender === '여성' ? 'girl' : 'boy'} (under 1 year old, ${ageInfo.minAge}-${ageInfo.maxAge} months old baby). The baby should have chubby cheeks, round face, and look like an actual infant`;
        case 'toddler':
          return `cute Korean toddler ${gender === '여성' ? 'girl' : 'boy'} (${ageInfo.minAge}-${ageInfo.maxAge} years old). The child should be very small, have round baby face, short limbs, and look like an actual toddler`;
        case 'preschool':
          return `adorable Korean ${gender === '여성' ? 'girl' : 'boy'} child (${ageInfo.minAge}-${ageInfo.maxAge} years old, preschool age). The child should have childish proportions, small body, and innocent look`;
        case 'child':
          return `stylish Korean ${gender === '여성' ? 'girl' : 'boy'} child (${ageInfo.minAge}-${ageInfo.maxAge} years old, elementary school age). The child should look like an actual ${ageInfo.minAge}-${ageInfo.maxAge} year old kid`;
        case 'teen':
          return `trendy Korean teenage ${gender === '여성' ? 'girl' : 'boy'} (${ageInfo.minAge}-${ageInfo.maxAge} years old). The teenager should have youthful appearance appropriate for their age`;
        case 'adult_20s':
          return `stylish Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} 20s (ages ${ageInfo.minAge}-${ageInfo.maxAge}), ${bodyDesc}`;
        case 'adult_30s':
          return `stylish Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} 30s (ages ${ageInfo.minAge}-${ageInfo.maxAge}), ${bodyDesc}`;
        case 'adult_40s':
          return `vibrant Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} mid-40s, ${bodyDesc}, with youthful energy and sophisticated style, looking healthy and active`;
        case 'adult_50s':
          return `dynamic Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} early 50s, ${bodyDesc}, with vibrant and youthful appearance for their age, looking energetic and stylish like a well-groomed middle-aged professional`;
        case 'adult_60s':
          return `graceful senior Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} 60s or older (ages ${ageInfo.minAge}+), ${bodyDesc}, with natural gray/white hair or age-appropriate hairstyle, gentle wrinkles and lines on face, mature and dignified appearance reflecting their age`;
        default:
          return `stylish Korean ${gender === '여성' ? 'woman' : 'man'} in ${gender === '여성' ? 'her' : 'his'} 30s, ${bodyDesc}`;
      }
    };

    const modelDescription = getModelDescription(ageInfo, gender, bodyDescription);
    const isChildProfile = ageInfo.category === 'infant' || 
                          ageInfo.category === 'toddler' ||
                          ageInfo.category === 'preschool' ||
                          ageInfo.category === 'child';
    const isAdultProfile = ageInfo.category.startsWith('adult_');

    const getBodyProportionHint = (category: string, bodyDesc: string): string => {
      switch (category) {
        case 'infant':
          return 'CRITICAL: The baby must have infant body proportions - very short limbs, large head relative to body, no neck visible, chubby baby legs and arms.';
        case 'toddler':
          return 'CRITICAL: The toddler must have toddler body proportions - short legs, round tummy, large head, small hands, typical of a 2-3 year old child.';
        case 'preschool':
          return 'CRITICAL: The child must have young child body proportions - shorter legs relative to adults, rounder face, smaller hands, typical of a 4-6 year old.';
        case 'child':
          return 'CRITICAL: The child must look like an elementary school student with appropriate body proportions for their age.';
        case 'teen':
          return 'The teenager should have youthful proportions appropriate for adolescence.';
        case 'adult_50s':
          return `The model should look like a vibrant, well-maintained person in their 50s - youthful for their age, healthy skin, modern hairstyle. Body type: ${bodyDesc}.`;
        case 'adult_60s':
          return `IMPORTANT: The model must look like a mature adult in their 60s or older. Show natural signs of aging - some wrinkles, age-appropriate skin texture, possibly gray/white hair. Body type: ${bodyDesc}.`;
        default:
          return bodyDesc ? `Body build: ${bodyDesc}.` : '';
      }
    };

    const bodyProportionHint = getBodyProportionHint(ageInfo.category, bodyDescription);
    
    // Watermark is now handled in the frontend UI overlay
    // No longer adding watermark via AI prompt to avoid canvas expansion issues
    console.log('[generate-style] Watermark will be handled by frontend UI overlay');
    
    // 성인 연령대 프롬프트 강화 - 중장년(40-50대)은 젊고 활기차게
    const getAgeEmphasis = (category: string, gender: string): string => {
      if (category === 'adult_60s') {
        return `\n\nCRITICAL AGE REQUIREMENT: This model MUST appear to be 60+ years old. DO NOT generate a young-looking person. The face MUST show:
- Natural wrinkles and fine lines around eyes, forehead, and mouth
- Age-appropriate skin texture (not smooth youthful skin)
- Gray/silver/white hair or age-appropriate natural hair color
- Mature facial features typical of someone in their 60s
- Distinguished, graceful appearance reflecting life experience\n`;
      }
      if (category === 'adult_50s') {
        return `\n\nMIDDLE-AGED STYLING: This is a vibrant middle-aged person in their early 50s. They should look:
- Healthy, energetic, and youthful for their age
- Well-groomed with modern hairstyle
- Like a successful professional in their prime
- NOT elderly or showing prominent aging signs
- Think "active 50s" - someone who exercises and takes care of themselves\n`;
      }
      if (category === 'adult_40s') {
        return `\n\nMIDDLE-AGED STYLING: This is an active person in their 40s. They should look:
- Vibrant, confident, and stylish
- Youthful energy with mature sophistication
- Like someone at the peak of their career\n`;
      }
      return '';
    };
    
    const ageEmphasis = getAgeEmphasis(ageInfo.category, gender);
    
    let prompt = `${!isAdultProfile && ageInfo.category !== 'teen' ? `CRITICAL AGE REQUIREMENT: Generate a ${ageInfo.minAge}-${ageInfo.maxAge} year old ${gender === '여성' ? 'girl' : 'boy'}. DO NOT generate an adult or teenager if the age is under 13.\n\n` : ''}${ageEmphasis}Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}${!isChildProfile && weight ? `, approximately ${weight}kg` : ''}.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST be rendered in its EXACT real-world color. If a color is specified (e.g. "MUST be cream color ONLY"), use exactly that color. If an item says "match the EXACT color from product image #N", carefully look at the corresponding product image and reproduce its exact color and pattern. Do NOT guess or substitute colors - always refer to the product images provided below for accurate color reproduction.

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;

    // 얼굴 합성 프롬프트 추가
    if (useFaceComposite && userAvatarUrl) {
      if (isChildProfile) {
        prompt = `CRITICAL AGE REQUIREMENT: Generate a ${ageInfo.minAge}-${ageInfo.maxAge} year old ${gender === '여성' ? 'girl' : 'boy'}. The model MUST look like a ${ageInfo.category === 'infant' ? 'baby under 1 year old' : ageInfo.category === 'toddler' ? 'toddler aged 2-3 years' : ageInfo.category === 'preschool' ? 'young child aged 4-6 years' : 'child aged 7-12 years'}.

Fashion photography of a ${modelDescription} with a similar look and feel to the reference photo provided.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST match its real-world color exactly. If a color is specified, use it. If it says "match from product image", refer to the product images for accurate color. Do NOT substitute colors.

IMPORTANT: The child model should have a similar cute and adorable appearance inspired by the reference photo, but MUST maintain the correct age appearance (${ageInfo.minAge}-${ageInfo.maxAge} years old). Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Professional studio lighting, clean white background, high fashion editorial style for kids, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      } else {
        // 성인 얼굴 합성 - 연령대와 체형 반영
        const getAdultFaceCompositeAgeHint = (category: string, gender: string): string => {
          if (category === 'adult_60s') {
            return `
CRITICAL AGE MATCHING: The person in the reference photo is in their 60s or older. The generated model MUST:
- Show the same age as the reference photo (60+ years old)
- Have natural wrinkles, age lines, and mature facial features matching the reference
- Have gray/silver/white hair or age-appropriate hair as in the reference
- Show a mature body build appropriate for their age`;
          }
          if (category === 'adult_50s') {
            return `
IMPORTANT: The person in the reference photo is in their 50s. The model should show mature features matching the reference - some wrinkles, age-appropriate appearance.`;
          }
          if (category === 'adult_40s') {
            return `
Note: The person is in their 40s. Show mature, sophisticated features matching the reference photo.`;
          }
          return '';
        };
        
        const faceCompositeAgeHint = getAdultFaceCompositeAgeHint(ageInfo.category, gender);
        
        prompt = `CRITICAL INSTRUCTION: You MUST use the face from the reference photo I'm providing. Create a fashion image where the model has EXACTLY the same face as the person in the reference photo.
${faceCompositeAgeHint}

Fashion photography of a ${modelDescription}${fullName ? ` (${fullName})` : ''}${height ? `, ${height}cm tall` : ''}${weight ? `, ${weight}kg` : ''}.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST match its real-world color exactly. If a color is specified, use it. If it says "match from product image", refer to the product images for accurate color. Do NOT substitute colors.

IMPORTANT: The model's face MUST match the reference photo exactly - same facial features, expression style, age appearance, and overall look. The body should reflect the specified build (${bodyDescription}). Blend the face naturally with the outfit while maintaining the person's identity from the reference photo.

CRITICAL: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      }
    }

    console.log('[generate-style] Prompt length:', prompt.length);
    console.log('[generate-style] Is child profile:', isChildProfile);

    // Prepare messages for Nano Banana (Gemini image generation)
    const messages: any[] = [];
    
    // Build content array with prompt + product images for color reference
    const contentArray: any[] = [
      { type: 'text', text: prompt }
    ];

    // 🔥 상품 이미지를 AI에 전달하여 정확한 색상 매칭 보장
    if (productImageUrls && Array.isArray(productImageUrls) && productImageUrls.length > 0) {
      console.log(`[generate-style] Including ${productImageUrls.length} product images for color reference`);
      for (let i = 0; i < productImageUrls.length; i++) {
        const imgUrl = productImageUrls[i];
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          contentArray.push({
            type: 'image_url',
            image_url: { url: imgUrl }
          });
          console.log(`[generate-style] Product image #${i + 1}: ${imgUrl.substring(0, 80)}...`);
        }
      }
    } else {
      console.log('[generate-style] No product images provided for color reference');
    }

    messages.push({
      role: 'user',
      content: contentArray.length > 1 ? contentArray : prompt
    });

    // If face composite is enabled, include the avatar image
    let avatarFetchSuccess = false;
    if (useFaceComposite && userAvatarUrl) {
      let avatarDataUrl = userAvatarUrl;
      
      if (userAvatarUrl.includes('supabase.co/storage')) {
        try {
          console.log('[generate-style] Fetching avatar from storage...');
          
          const urlMatch = userAvatarUrl.match(/\/avatars\/([^?]+)/);
          if (urlMatch) {
            const avatarPath = urlMatch[1];
            console.log('[generate-style] Avatar path:', avatarPath);
            
            const { data: signedData, error: signedError } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(avatarPath, 300);
            
            if (signedData?.signedUrl) {
              console.log('[generate-style] Got fresh signed URL');
              const avatarResponse = await fetch(signedData.signedUrl);
              if (avatarResponse.ok) {
                const avatarBuffer = await avatarResponse.arrayBuffer();
                const base64Avatar = btoa(
                  new Uint8Array(avatarBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                const contentType = avatarResponse.headers.get('content-type') || 'image/png';
                avatarDataUrl = `data:${contentType};base64,${base64Avatar}`;
                console.log('[generate-style] Avatar converted to base64, length:', avatarDataUrl.length);
                avatarFetchSuccess = true;
              } else {
                console.error('[generate-style] Failed to fetch avatar with fresh URL:', avatarResponse.status);
              }
            } else {
              console.error('[generate-style] Failed to create signed URL:', signedError);
            }
          }
          
          if (!avatarFetchSuccess) {
            console.log('[generate-style] Trying original avatar URL...');
            const avatarResponse = await fetch(userAvatarUrl);
            if (avatarResponse.ok) {
              const avatarBuffer = await avatarResponse.arrayBuffer();
              const base64Avatar = btoa(
                new Uint8Array(avatarBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              const contentType = avatarResponse.headers.get('content-type') || 'image/png';
              avatarDataUrl = `data:${contentType};base64,${base64Avatar}`;
              console.log('[generate-style] Avatar converted to base64 from original URL, length:', avatarDataUrl.length);
              avatarFetchSuccess = true;
            } else {
              console.error('[generate-style] Failed to fetch avatar with original URL:', avatarResponse.status);
            }
          }
        } catch (fetchError) {
          console.error('[generate-style] Error fetching avatar:', fetchError);
        }
      } else if (userAvatarUrl.startsWith('data:')) {
        avatarDataUrl = userAvatarUrl;
        avatarFetchSuccess = true;
      }
      
      if (avatarFetchSuccess) {
        // Rebuild content array: prompt + product images + avatar
        const fullContentArray: any[] = [
          { type: 'text', text: prompt }
        ];
        
        // Add product images first
        if (productImageUrls && Array.isArray(productImageUrls)) {
          for (const imgUrl of productImageUrls) {
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
              fullContentArray.push({
                type: 'image_url',
                image_url: { url: imgUrl }
              });
            }
          }
        }
        
        // Add avatar last (reference photo)
        fullContentArray.push({
          type: 'image_url',
          image_url: { url: avatarDataUrl }
        });
        
        console.log('[generate-style] Avatar included in request');
        
        messages[0] = {
          role: 'user',
          content: fullContentArray
        };
      } else {
        console.log('[generate-style] Avatar fetch failed, proceeding without face composite');
        prompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST match its real-world color exactly. If a color is specified, use it. If it says "match from product image", refer to the product images for accurate color. Do NOT substitute colors.

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
        
        // Keep product images even without avatar
        const fallbackContent: any[] = [{ type: 'text', text: prompt }];
        if (productImageUrls && Array.isArray(productImageUrls)) {
          for (const imgUrl of productImageUrls) {
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
              fallbackContent.push({ type: 'image_url', image_url: { url: imgUrl } });
            }
          }
        }
        
        messages[0] = {
          role: 'user',
          content: fallbackContent.length > 1 ? fallbackContent : prompt
        };
      }
    }

    // Call Lovable AI Gateway with retry logic
    console.log('[generate-style] Calling Lovable AI Gateway with retry...');
    const aiStartTime = Date.now();

    const response = await fetchWithRetry(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: messages,
          modalities: ['image', 'text']
        }),
      },
      3 // Max retries
    );

    const elapsed = Date.now() - aiStartTime;
    console.log(`[generate-style] AI response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-style] AI error:', errorText);
      
      // Log the error
      await logError(
        supabase,
        'generate-style',
        String(response.status),
        errorText.slice(0, 1000),
        userId,
        { style, useFaceComposite, hasAvatar: !!userAvatarUrl },
        Date.now() - startTime
      );
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again later.',
            errorCode: '429',
            retryAfter: 30
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required. Please add credits to your workspace.',
            errorCode: '402'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('[generate-style] AI result received');

    // Extract image from response
    let generatedImage = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // 이미지 생성 실패 시 얼굴 합성 없이 재시도
    if (!generatedImage && useFaceComposite && userAvatarUrl) {
      console.log('[generate-style] No image with face composite, retrying without...');
      
      const fallbackPrompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      
      const fallbackResponse = await fetchWithRetry(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: fallbackPrompt }],
            modalities: ['image', 'text']
          }),
        },
        2 // Fewer retries for fallback
      );
      
      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        generatedImage = fallbackResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        console.log('[generate-style] Fallback result:', generatedImage ? 'success' : 'failed');
      }
    }
    
    if (!generatedImage) {
      console.error('[generate-style] No image in response:', JSON.stringify(aiResult).slice(0, 500));
      
      // Log the error
      await logError(
        supabase,
        'generate-style',
        'NO_IMAGE',
        'AI returned no image data',
        userId,
        { style, useFaceComposite, aiResponseSnippet: JSON.stringify(aiResult).slice(0, 500) },
        Date.now() - startTime
      );
      
      throw new Error('No image generated from AI');
    }

    console.log('[generate-style] Image generated, length:', generatedImage.length);

    // Watermark is now added via prompt, no post-processing needed
    const finalGeneratedImage = generatedImage;

    // Upload to Supabase Storage
    const imageData = finalGeneratedImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    
    // Use user folder structure for proper RLS enforcement
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('generated-looks')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('[generate-style] Upload error:', uploadError);
      
      // Log but don't fail - return base64 instead
      await logError(
        supabase,
        'generate-style',
        'UPLOAD_ERROR',
        uploadError.message,
        userId,
        { fileName },
        Date.now() - startTime
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: generatedImage,
          style: style,
          productIds: productIds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generated-looks')
      .getPublicUrl(fileName); // fileName now includes userId folder prefix

    const finalImageUrl = urlData?.publicUrl || generatedImage;
    const totalTime = Date.now() - startTime;
    console.log(`[generate-style] Final image URL: ${finalImageUrl.slice(0, 100)}`);
    console.log(`[generate-style] Total execution time: ${totalTime}ms`);

    // ===== 생성 횟수 증가 (한국시간 기준) =====
    if (userId) {
      try {
        // KST (UTC+9) 기준 오늘 날짜 계산
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        const kstTime = new Date(now.getTime() + kstOffset);
        const todayKST = kstTime.toISOString().split('T')[0];
        
        console.log(`[generate-style] Incrementing usage for user ${userId} on date ${todayKST} (KST)`);
        
        // Upsert: 오늘 데이터가 있으면 증가, 없으면 새로 생성
        const { data: existingUsage, error: fetchError } = await supabase
          .from('daily_generation_usage')
          .select('id, generation_count')
          .eq('user_id', userId)
          .eq('usage_date', todayKST)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows found (정상적인 상황)
          console.error('[generate-style] Error fetching usage:', fetchError);
        }
        
        if (existingUsage) {
          // 기존 레코드 업데이트
          const { error: updateError } = await supabase
            .from('daily_generation_usage')
            .update({ 
              generation_count: (existingUsage.generation_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUsage.id);
          
          if (updateError) {
            console.error('[generate-style] Error updating usage:', updateError);
          } else {
            console.log(`[generate-style] Usage incremented to ${(existingUsage.generation_count || 0) + 1}`);
          }
        } else {
          // 새 레코드 생성
          const { error: insertError } = await supabase
            .from('daily_generation_usage')
            .insert({
              user_id: userId,
              usage_date: todayKST,
              generation_count: 1,
            });
          
          if (insertError) {
            console.error('[generate-style] Error inserting usage:', insertError);
          } else {
            console.log('[generate-style] New usage record created with count 1');
          }
        }
      } catch (usageError) {
        console.error('[generate-style] Failed to update usage count:', usageError);
        // 생성 횟수 업데이트 실패해도 이미지 생성은 성공했으므로 계속 진행
      }
    }

    // ===== 생성 시점 태그 위치 anchor 계산 =====
    const tagPositions = buildTagPositions(productDetails || []);
    console.log(`[generate-style] Tag positions generated: ${tagPositions.length} items`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: finalImageUrl,
        storagePath: fileName,
        style: style,
        productIds: productIds,
        executionTime: totalTime,
        tagPositions: tagPositions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-style] Error:', error);
    
    // Log the error
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await logError(
        supabase,
        'generate-style',
        'EXCEPTION',
        error instanceof Error ? error.message : String(error),
        userId,
        requestPayload ? { style: requestPayload.style } : null,
        Date.now() - startTime
      );
    } catch (logErr) {
      console.error('[generate-style] Failed to log error:', logErr);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Generation failed',
        errorCode: 'EXCEPTION',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
