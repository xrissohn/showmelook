import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 수집 대상 카테고리 (패션만)
const FASHION_CATEGORIES = [
  { id: 1001, name: "여성패션" },
  { id: 1002, name: "남성패션" },
  { id: 1030, name: "유아동패션" },
];

// HMAC-SHA256 signature generation
async function generateHmacSignature(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const [path, query = ""] = url.split("?");
  
  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(2);
  
  const message = datetime + method + path + query;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${hexSignature}`;
}

// DNA 생성 함수
interface DNAMeta {
  target: string;
  item_slot: string;
  color_family: string;
  formality: number;
  season_fit: string[];
  concepts: string[];
  occasions: string[];
  pair_slots: string[];
}

// 패션 상품인지 확인하는 함수
function isFashionProduct(name: string, categoryName?: string): boolean {
  // 명확한 비패션 키워드 (전자기기, 생활용품 등)
  const nonFashionKeywords = /충전기|케이블|배터리|이어폰|헤드폰|스피커|마우스|키보드|USB|HDMI|어댑터|컨버터|메모리|SD카드|보조배터리|휴대폰|스마트폰|태블릿|노트북|PC|컴퓨터|모니터|TV|세탁기|냉장고|에어컨|청소기|밥솥|전자레인지|커피머신|믹서기|토스터|드라이기|고데기|면도기|칫솔|화장품|스킨|로션|에센스|크림|마스크팩|선크림|향수|영양제|비타민|프로틴|식품|간식|음료|커피|차|라면|과자|캔디|젤리|반려동물|사료|장난감|레고|블록|인형|완구|게임|피규어|카시트|유모차|젖병|기저귀|물티슈|세제|섬유유연제|주방세제|휴지|치약|샴푸|린스|바디워시|핸드크림|손소독제|마스크|의료기기|혈압계|체온계|보청기|안마기|운동기구|덤벨|요가|필라테스|캠핑|텐트|침낭|랜턴|버너|쿨러|아이스박스|낚시|골프공|골프채|자전거|킥보드|스케이트|보드|등산|트레킹폴|배낭|공구|드릴|망치|드라이버|렌치|페인트|벽지|타일|조명|전구|콘센트|멀티탭|정수기|가습기|공기청정기|선풍기|히터|온풍기|제습기|문구|펜|연필|노트|다이어리|스티커|테이프|가위|풀|클립|파일|바인더|책|도서|만화|잡지|음반|CD|DVD|악기|기타|피아노|드럼|바이올린|플루트|우쿨렐레|화분|식물|씨앗|비료|원예|공예|뜨개질|십자수|비즈|레진|캔버스|물감|붓|이젤/i;
  
  if (nonFashionKeywords.test(name)) {
    return false;
  }
  
  // 패션 관련 키워드
  const fashionKeywords = /자켓|재킷|블레이저|코트|패딩|점퍼|야상|무스탕|바람막이|집업|아우터|티셔츠|티|맨투맨|후드|스웨트|니트|가디건|셔츠|블라우스|상의|탑|팬츠|바지|진|청바지|데님|슬랙스|조거|트레이닝|레깅스|반바지|숏|하의|원피스|드레스|스커트|치마|신발|스니커즈|운동화|구두|로퍼|부츠|샌들|슬리퍼|가방|백|토트|숄더|크로스|클러치|백팩|목걸이|귀걸이|반지|팔찌|시계|주얼리|액세서리|넥워머|머플러|스카프|모자|장갑|벨트|지갑|양말|스타킹|언더웨어|속옷|브라|팬티|수영복|비키니|래시가드|정장|수트|블레이저|베스트|조끼|카디건|풀오버|크롭|오버핏|슬림핏|와이드|스트레이트|부츠컷|스키니|테이퍼드|플레어|미니|미디|맥시|롱|숏|캐주얼|포멀|스포츠|애슬레저|골프웨어|등산복|트레이닝복|운동복|홈웨어|파자마|잠옷|가운|슬립|캐미솔|탱크탑|나시|민소매|반팔|긴팔|7부|9부|루즈핏|레귤러핏|타이트|배기|조거팬츠|카고|치노|면바지|린넨|실크|울|캐시미어|코듀로이|벨벳|새틴|시폰|레이스|트위드|헤링본|체크|스트라이프|도트|플로럴|프린트|그래픽|자수|패치|워싱|빈티지|레트로|모던|클래식|미니멀|맥시멀|페미닌|매니시|유니섹스|키즈|아동|유아|베이비|주니어|여성|남성|우먼|맨|걸|보이|레이디|미씨/i;
  
  return fashionKeywords.test(name);
}

function inferCategory(name: string): { category: string; subCategory: string } | null {
  // 먼저 패션 상품인지 확인
  if (!isFashionProduct(name)) {
    return null; // 패션 상품이 아니면 null 반환
  }
  
  if (/자켓|재킷|블레이저|코트|패딩|점퍼|야상|무스탕|바람막이|집업|아우터/.test(name)) {
    if (/패딩|다운/.test(name)) return { category: "아우터", subCategory: "패딩" };
    if (/코트/.test(name)) return { category: "아우터", subCategory: "코트" };
    return { category: "아우터", subCategory: "자켓" };
  }
  if (/티셔츠|티|맨투맨|후드|스웨트|니트|가디건|셔츠|블라우스|상의|탑/.test(name)) {
    if (/맨투맨|스웨트/.test(name)) return { category: "상의", subCategory: "맨투맨" };
    if (/후드/.test(name)) return { category: "상의", subCategory: "후드" };
    if (/니트/.test(name)) return { category: "상의", subCategory: "니트" };
    if (/셔츠|블라우스/.test(name)) return { category: "상의", subCategory: "셔츠" };
    return { category: "상의", subCategory: "티셔츠" };
  }
  if (/팬츠|바지|진|청바지|데님|슬랙스|조거|트레이닝|레깅스|반바지|숏|하의/.test(name)) {
    if (/청바지|데님|진/.test(name)) return { category: "하의", subCategory: "데님" };
    if (/슬랙스/.test(name)) return { category: "하의", subCategory: "슬랙스" };
    return { category: "하의", subCategory: "팬츠" };
  }
  if (/원피스|드레스/.test(name)) {
    return { category: "원피스", subCategory: "원피스" };
  }
  if (/스커트|치마/.test(name)) {
    return { category: "하의", subCategory: "스커트" };
  }
  if (/신발|스니커즈|운동화|구두|로퍼|부츠|샌들|슬리퍼/.test(name)) {
    return { category: "신발", subCategory: "신발" };
  }
  if (/가방|백|토트|숄더|크로스|클러치|백팩/.test(name)) {
    return { category: "가방", subCategory: "가방" };
  }
  if (/목걸이|귀걸이|반지|팔찌|시계|주얼리|액세서리|넥워머|머플러|스카프|모자|장갑|벨트/.test(name)) {
    return { category: "액세서리", subCategory: "액세서리" };
  }
  
  // 패션 키워드가 있지만 구체적 분류가 안되면 기본값
  return { category: "기타", subCategory: "기타" };
}

function inferGender(categoryId: number, name: string): string {
  if (categoryId === 1001) return "female";
  if (categoryId === 1002) return "male";
  if (categoryId === 1030) return "kids";
  
  // 상품명에서 성별 추론
  if (/여성|우먼|레이디|걸|미씨/.test(name)) return "female";
  if (/남성|맨|보이즈/.test(name)) return "male";
  if (/아동|키즈|주니어|베이비/.test(name)) return "kids";
  
  return "unisex";
}

function generateDNA(product: {
  name: string;
  price: number;
  brand?: string;
  categoryId: number;
}): { dna_meta: DNAMeta; dna_text: string; category: string; subCategory: string } | null {
  const categoryInfo = inferCategory(product.name);
  
  // 패션 상품이 아니면 null 반환
  if (!categoryInfo) {
    return null;
  }
  
  const { category, subCategory } = categoryInfo;
  const gender = inferGender(product.categoryId, product.name);
  
  const dna_meta: DNAMeta = {
    target: gender === "kids" ? "kids_unisex" : `adult_${gender}`,
    item_slot: category === "아우터" ? "outer" :
               category === "상의" ? "top" :
               category === "하의" ? "bottom" :
               category === "원피스" ? "onepiece" :
               category === "신발" ? "shoes" :
               category === "가방" ? "bag" : "accessory",
    color_family: "neutral",
    formality: 5,
    season_fit: ["spring", "fall"],
    concepts: ["casual"],
    occasions: ["daily"],
    pair_slots: [],
  };
  
  // 가격대에 따른 포멀리티 조정
  if (product.price > 200000) {
    dna_meta.formality = 7;
    dna_meta.concepts = ["premium", "modern"];
  } else if (product.price > 100000) {
    dna_meta.formality = 6;
    dna_meta.concepts = ["smart", "casual"];
  } else if (product.price < 30000) {
    dna_meta.formality = 3;
    dna_meta.concepts = ["casual", "basic"];
  }
  
  // 시즌 추론
  if (/패딩|다운|코트|무스탕|기모|털|퍼/.test(product.name)) {
    dna_meta.season_fit = ["winter"];
  } else if (/반팔|반바지|린넨|여름/.test(product.name)) {
    dna_meta.season_fit = ["summer"];
  }
  
  // 스포츠 카테고리
  if (product.categoryId === 1017) {
    dna_meta.concepts = ["sporty", "athletic"];
    dna_meta.occasions = ["sports", "outdoor"];
  }
  
  const dna_text = `${product.brand || "브랜드"} ${subCategory}. ` +
    `${dna_meta.concepts.join(", ")} 스타일. ` +
    `${dna_meta.season_fit.join("/")} 시즌 적합. ` +
    `포멀리티 ${dna_meta.formality}/10.`;
  
  return { dna_meta, dna_text, category, subCategory };
}

// BestCategories API 호출
async function fetchBestProducts(
  categoryId: number,
  limit: number,
  accessKey: string,
  secretKey: string
): Promise<any[]> {
  const apiPath = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/bestcategories/${categoryId}`;
  const queryParams = `limit=${limit}`;
  const fullPath = `${apiPath}?${queryParams}`;
  
  const authorization = await generateHmacSignature("GET", fullPath, accessKey, secretKey);
  
  const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
    method: "GET",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`API Error for category ${categoryId}:`, response.status, text);
    return [];
  }
  
  const data = await response.json();
  return data.data || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get("COUPANG_ACCESS_KEY");
    const secretKey = Deno.env.get("COUPANG_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!accessKey || !secretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "쿠팡 API 키가 설정되지 않았습니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 요청 파라미터
    const body = await req.json().catch(() => ({}));
    const limitPerCategory = body.limit || 20;
    const categoryIds = body.categoryIds || FASHION_CATEGORIES.map(c => c.id);
    
    console.log(`Starting batch collection for categories: ${categoryIds.join(", ")}`);
    
    const results: { categoryId: number; categoryName: string; collected: number; saved: number; skipped: number; errors: number }[] = [];
    
    for (const catId of categoryIds) {
      const categoryInfo = FASHION_CATEGORIES.find(c => c.id === catId);
      const categoryName = categoryInfo?.name || `카테고리 ${catId}`;
      
      console.log(`Fetching category ${catId} (${categoryName})...`);
      
      // API 호출 간 딜레이 (rate limit 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const products = await fetchBestProducts(catId, limitPerCategory, accessKey, secretKey);
      
      let saved = 0;
      let errors = 0;
      
      let skipped = 0;
      
      for (const item of products) {
        try {
          const product = {
            name: item.productName || "상품명 없음",
            price: item.productPrice || 0,
            brand: item.vendorName || "쿠팡",
            categoryId: catId,
          };
          
          const dnaResult = generateDNA(product);
          
          // 패션 상품이 아니면 건너뛰기
          if (!dnaResult) {
            console.log(`Skipped non-fashion product: ${product.name}`);
            skipped++;
            continue;
          }
          
          const { dna_meta, dna_text, category } = dnaResult;
          const gender = inferGender(catId, product.name);
          
          const { error } = await supabase
            .from("products_cache")
            .upsert({
              name: product.name,
              price: product.price,
              brand: product.brand,
              image_url: item.productImage,
              product_url: item.productUrl,
              category: category, // 추론된 카테고리 사용
              gender: gender,
              merchant_id: "coupang",
              external_id: `coupang_${item.productId}`,
              dna_meta,
              dna_text,
              dna_generated_at: new Date().toISOString(),
              is_active: true,
              is_in_stock: true,
            }, { 
              onConflict: "external_id",
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`Save error for ${product.name}:`, error.message);
            errors++;
          } else {
            saved++;
          }
        } catch (e) {
          console.error(`Processing error:`, e);
          errors++;
        }
      }
      
      results.push({
        categoryId: catId,
        categoryName,
        collected: products.length,
        saved,
        skipped,
        errors,
      });
      
      console.log(`Category ${categoryName}: collected=${products.length}, saved=${saved}, skipped=${skipped}, errors=${errors}`);
    }
    
    const totalCollected = results.reduce((sum, r) => sum + r.collected, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    
    console.log(`Batch complete: total collected=${totalCollected}, saved=${totalSaved}, skipped=${totalSkipped}, errors=${totalErrors}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalCollected,
          totalSaved,
          totalSkipped,
          totalErrors,
          timestamp: new Date().toISOString(),
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Batch error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
