import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// 1. 수집 대상 카테고리 (세부 카테고리 확장)
// ═══════════════════════════════════════════════════════════════
interface CategoryConfig {
  id: number;
  name: string;
  gender: string;
  limit: number;
}

const FASHION_CATEGORIES: CategoryConfig[] = [
  // 대분류 카테고리 (쿠팡 API 지원)
  { id: 1001, name: "여성패션", gender: "female", limit: 100 },
  { id: 1002, name: "남성패션", gender: "male", limit: 100 },
  { id: 1010, name: "여성신발", gender: "female", limit: 50 },
  { id: 1011, name: "남성신발", gender: "male", limit: 50 },
  { id: 1012, name: "여성가방", gender: "female", limit: 30 },
  { id: 1013, name: "남성가방", gender: "male", limit: 30 },
];

// ═══════════════════════════════════════════════════════════════
// 2. 비패션 상품 필터 (강화 v2 — 식료품/가구/생활/우산/캐리어 차단)
// ═══════════════════════════════════════════════════════════════
const NON_FASHION_BLOCK_LIST = /충전기|케이블|배터리|이어폰|헤드폰|스피커|마우스|키보드|USB|HDMI|어댑터|컨버터|메모리|SD카드|보조배터리|휴대폰|스마트폰|태블릿|노트북|PC|컴퓨터|모니터|TV|세탁기|냉장고|에어컨|청소기|밥솥|전자레인지|커피머신|믹서기|토스터|드라이기|고데기|면도기|칫솔|화장품|스킨|로션|에센스|크림|마스크팩|선크림|향수|영양제|비타민|프로틴|식품|간식|음료|커피|차|라면|과자|캔디|젤리|반려동물|사료|장난감|레고|블록|인형|완구|게임|피규어|카시트|유모차|젖병|기저귀|물티슈|세제|섬유유연제|주방세제|휴지|치약|샴푸|린스|바디워시|핸드크림|손소독제|마스크(?!.*방한)|의료기기|혈압계|체온계|보청기|안마기|운동기구|덤벨|요가|필라테스|캠핑|텐트|침낭|랜턴|버너|쿨러|아이스박스|낚시|골프공|골프채|자전거|킥보드|스케이트|보드|공구|드릴|망치|드라이버|렌치|페인트|벽지|타일|조명|전구|콘센트|멀티탭|정수기|가습기|공기청정기|선풍기|히터|온풍기|제습기|문구|펜|연필|노트|다이어리|스티커|테이프|가위|풀|클립|파일|바인더|책|도서|만화|잡지|음반|CD|DVD|악기|피아노|드럼|바이올린|플루트|우쿨렐레|화분|식물|씨앗|비료|원예|공예|뜨개질|십자수|비즈|레진|캔버스|물감|붓|이젤|세척천|폴리싱천|클리너|광택제|변색제거|은세척|금세척|세정제|연마제|코팅제|왁스|방수스프레이|얼룩제거|표백|탈취제|살균|소독|세척액|클리닝|리무버|녹제거|곰팡이|배수구|하수구|욕조|변기|타일세정|유리세정|주방타올|행주|걸레|청소포|극세사|먼지떨이|빗자루|쓰레받기|고무장갑|비닐장갑|위생장갑|니트릴장갑|수세미|수저|젓가락|식기|그릇|접시|머그|텀블러|보온병|도마|냄비|프라이팬|밀폐용기|키친타올|종이컵|종이접시|일회용|디퓨저|캔들|방향|탈취|안경닦이|화장솜|토너(?!.*의류)|메이크업.*리무버|축구화|축구공|농구공|야구공|야구.*글러브|배구공|배드민턴|테니스공|라켓|스포츠백.*축구|우유|두유|어묵|식초|아메리카노|에스프레소|음용|제로슈거|식빵|명과|설탕|소금|밀가루|식자재|식재료|시리얼|꿀\b|잼\b|훈제|다짐육|국거리|반숙란|냉장|냉동|수산|고추|마늘|양파|파\b|상추|시금치|미나리|버섯|당근|오이|무\b|호박|배추|감자|고구마|쌀\b|햅쌀|꼬마참외|블루베리|새우살|토마토|아보카도|깻잎|두부|복사용지|샘물|생수|미네랄워터|파프리카|숙주나물|키친타월|마그네슘|종근당|박토킬|발스프레이|발 스프레이|악취|발냄새|무좀|배도라지|즙\b|캐리어|여행가방|기내용.*캐리어|하드.*캐리어|장우산|3단.*우산|자동.*우산|비닐우산|우산|우비|판초우의|레인코트|골프우산|제골기|슈트리|발볼확장|수선패드|뒤꿈치|옷걸이|버블건|신주머니|보조가방|짐색|머리핀|토슈즈|신발주머니|복주머니|용돈주머니|다짐|짜파게티|너구리|오징어|조미료|소스|육수|장류|간장|된장|고추장|음료수|콜라|사이다|펩시|초코.*음료|아몬드.*음료|아몬드브리즈|아몬드 분말/i;

// 코디 추천에 부적합한 아이템 (양말, 속옷, 실내화 등) - 방한용품(장갑/넥워머/바라클라바/귀마개)은 겨울 액세서리로 허용
const NON_COORDI_BLOCK_LIST = /양말|스타킹|팬티|브라|속옷|언더웨어|내의|런닝|드로즈|사각팬티|삼각팬티|보정|거들|실내화|슬리퍼(?!.*패션)|핫팩|발열|수건|타올|인솔|깔창|구두약|신발건조|제습제|방향제|발매트|욕실|주방|수납|정리|세트.*켤레|세트.*족|켤레.*세트|족.*세트/i;

// 패션 화이트리스트: 이 키워드 중 최소 하나는 반드시 포함되어야 한다 (강제 검증)
const FASHION_WHITELIST = /티셔츠|셔츠|블라우스|니트(?!릴)|스웨터|가디건|맨투맨|후드(?!.*우산)|후디|폴로|나시|민소매|반팔|긴팔|t-shirt|tee\b|바지(?!걸이)|팬츠|청바지|데님|슬랙스|조거|레깅스|반바지|숏팬츠|숏츠|치마|스커트|원피스|드레스(?!하우스|싱)|자켓|재킷|블레이저|코트(?!\.|로|니스)|패딩|점퍼|야상|무스탕|바람막이|집업|아노락|플리스(?!.*그릇|.*용기)|운동화|스니커즈|로퍼|구두|부츠|샌들|슬리퍼|아쿠아슈즈|크록스|컨버스|어그|첼시|더비|옥스포드|sneaker|loafer|sandal|boots|shoes|나이키|아디다스|뉴발란스|푸마|반스|아식스|호카|온러닝|살로몬|백팩|토트백|숄더백|크로스백|클러치|에코백|메신저백|힙색|힙백|힙쌕|러닝.*벨트|러닝.*가방|등산가방|아웃도어.*가방|장갑|글러브(?!.*야구|.*골프)|넥워머|넥게이터|목토시|바라클라바|귀마개|귀도리|이어머프|방한.*마스크|입체.*마스크|버킷햇|볼캡|비니|페도라|벙거지|모자(?!걸이|이크)|두건|헤어밴드|선캡|썬캡|헤어커치프|헤드스카프|벨트(?!.*수선|.*공구)|선글라스|스카프|머플러|목걸이|귀걸이|반지|팔찌|시계|주얼리|jacket|blazer|coat|hoodie|sweatshirt|knit|sweater|jeans|denim|pants|shorts|skirt|dress|bag/i;

function isFashionProduct(name: string): boolean {
  if (NON_FASHION_BLOCK_LIST.test(name)) return false;
  if (NON_COORDI_BLOCK_LIST.test(name)) return false;
  
  // 가격이 너무 낮은 묶음 상품 제외 (상품명으로 판단)
  if (/\d+켤레|\d+족|\d+장|\d+매|\d+개.*세트/.test(name) && !/코디|세트.*룩/.test(name)) return false;
  
  // 패션 화이트리스트에 매칭되는 키워드가 반드시 하나 이상 있어야 함
  if (!FASHION_WHITELIST.test(name)) return false;
  
  return true;
}

// ═══════════════════════════════════════════════════════════════
// 3. 카테고리 추론
// ═══════════════════════════════════════════════════════════════
function inferCategory(name: string, catName: string): { category: string; subCategory: string } | null {
  if (!isFashionProduct(name)) return null;
  
  const n = name.toLowerCase();
  const cn = catName.toLowerCase();
  
  // 아우터
  if (/코트|coat/.test(n) || cn.includes('코트')) return { category: "아우터", subCategory: "코트" };
  if (/재킷|jacket|블레이저|blazer/.test(n) || cn.includes('재킷')) return { category: "아우터", subCategory: "재킷" };
  if (/패딩|다운|puffer/.test(n)) return { category: "아우터", subCategory: "패딩" };
  if (/점퍼|jumper|야상|바람막이|집업/.test(n) || cn.includes('점퍼')) return { category: "아우터", subCategory: "점퍼" };
  if (/가디건|cardigan/.test(n) || cn.includes('가디건')) return { category: "아우터", subCategory: "가디건" };
  
  // 상의
  if (/맨투맨|스웨트|후드|hoodie|sweatshirt/.test(n) || cn.includes('맨투맨') || cn.includes('후드')) return { category: "상의", subCategory: "맨투맨/후디" };
  if (/니트|스웨터|knit|sweater/.test(n) || cn.includes('니트')) return { category: "상의", subCategory: "니트" };
  if (/셔츠|shirt|블라우스|blouse/.test(n) || cn.includes('셔츠') || cn.includes('블라우스')) return { category: "상의", subCategory: "셔츠" };
  if (/티셔츠|t-shirt|tee|반팔|긴팔/.test(n) || cn.includes('티셔츠')) return { category: "상의", subCategory: "티셔츠" };
  if (/폴로|polo/.test(n)) return { category: "상의", subCategory: "폴로" };
  if (/탱크탑|나시|민소매/.test(n)) return { category: "상의", subCategory: "민소매" };
  
  // 하의
  if (/청바지|데님|진|jeans|denim/.test(n) || cn.includes('청바지')) return { category: "하의", subCategory: "데님" };
  if (/슬랙스|slacks/.test(n)) return { category: "하의", subCategory: "슬랙스" };
  if (/반바지|쇼츠|shorts/.test(n)) return { category: "하의", subCategory: "반바지" };
  if (/스커트|치마|skirt/.test(n) || cn.includes('스커트')) return { category: "하의", subCategory: "스커트" };
  if (/레깅스|leggings/.test(n)) return { category: "하의", subCategory: "레깅스" };
  if (/팬츠|바지|pants|트레이닝|조거/.test(n) || cn.includes('바지') || cn.includes('팬츠')) return { category: "하의", subCategory: "팬츠" };
  
  // 원피스
  if (/원피스|드레스|dress/.test(n) || cn.includes('원피스')) return { category: "원피스", subCategory: "원피스" };
  
  // 신발
  if (/스니커즈|sneaker|운동화/.test(n)) return { category: "신발", subCategory: "스니커즈" };
  if (/부츠|boots/.test(n)) return { category: "신발", subCategory: "부츠" };
  if (/로퍼|loafer/.test(n)) return { category: "신발", subCategory: "로퍼" };
  if (/구두|펌프스|힐|heel/.test(n)) return { category: "신발", subCategory: "구두" };
  if (/샌들|sandal/.test(n)) return { category: "신발", subCategory: "샌들" };
  if (/신발|슈즈|shoes/.test(n) || cn.includes('신발')) return { category: "신발", subCategory: "신발" };
  
  // 가방
  if (/가방|백|bag|토트|숄더|크로스|클러치|백팩/.test(n) || cn.includes('가방')) return { category: "가방", subCategory: "가방" };
  
  // 겨울 방한 액세서리
  if (/장갑|글러브(?!.*야구)/.test(n)) return { category: "액세서리", subCategory: "장갑" };
  if (/바라클라바|넥워머|넥게이터|목토시/.test(n)) return { category: "액세서리", subCategory: "넥워머" };
  if (/귀마개|귀달이|이어밴드|이어머프/.test(n)) return { category: "액세서리", subCategory: "귀마개" };
  if (/방한.*마스크/.test(n)) return { category: "액세서리", subCategory: "방한마스크" };

  // 일반 액세서리
  if (/목걸이|귀걸이|반지|팔찌|시계|주얼리|모자|캡|벨트|선글라스|스카프|머플러/.test(n)) return { category: "액세서리", subCategory: "액세서리" };
  
  // 카테고리 이름으로 최종 추론
  if (cn.includes('여성') || cn.includes('남성')) return { category: "상의", subCategory: "기타 상의" };
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 4. HMAC-SHA256 서명
// ═══════════════════════════════════════════════════════════════
async function generateHmacSignature(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const [path, query = ""] = url.split("?");
  const now = new Date();
  const datetime = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").slice(2);
  const message = datetime + method + path + query;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const hexSignature = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${hexSignature}`;
}

// ═══════════════════════════════════════════════════════════════
// 5. BestCategories API 호출
// ═══════════════════════════════════════════════════════════════
async function fetchBestProducts(
  categoryId: number, limit: number, accessKey: string, secretKey: string
): Promise<any[]> {
  const apiPath = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/bestcategories/${categoryId}`;
  const queryParams = `limit=${limit}`;
  const fullPath = `${apiPath}?${queryParams}`;
  const authorization = await generateHmacSignature("GET", fullPath, accessKey, secretKey);

  const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
    method: "GET",
    headers: { "Authorization": authorization, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`API Error for category ${categoryId}:`, response.status, text);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

// ═══════════════════════════════════════════════════════════════
// 6. 메인 핸들러
// ═══════════════════════════════════════════════════════════════
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
    const body = await req.json().catch(() => ({}));
    
    // 파라미터: genderFilter로 특정 성별만, categoryFilter로 특정 카테고리만 수집 가능
    const genderFilter: string | null = body.genderFilter || null;
    const categoryFilter: number[] | null = body.categoryIds || null;
    const limitOverride: number | null = body.limit || null;

    let targetCategories = FASHION_CATEGORIES;
    if (genderFilter) {
      targetCategories = targetCategories.filter(c => c.gender === genderFilter);
    }
    if (categoryFilter && categoryFilter.length > 0) {
      targetCategories = targetCategories.filter(c => categoryFilter.includes(c.id));
    }

    console.log(`[coupang-batch] Starting: ${targetCategories.length} categories, gender=${genderFilter || 'all'}`);

    const results: { categoryId: number; categoryName: string; collected: number; saved: number; skipped: number; errors: number }[] = [];
    const seenProductIds = new Set<string>();

    for (const cat of targetCategories) {
      const effectiveLimit = limitOverride || cat.limit;
      console.log(`[coupang-batch] Fetching ${cat.name} (id=${cat.id}, limit=${effectiveLimit})...`);

      // API rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 800));

      const products = await fetchBestProducts(cat.id, effectiveLimit, accessKey, secretKey);
      let saved = 0, skipped = 0, errors = 0;

      for (const item of products) {
        try {
          const productId = String(item.productId);
          
          // 중복 제거 (같은 배치 내)
          if (seenProductIds.has(productId)) { skipped++; continue; }
          seenProductIds.add(productId);

          const name = item.productName || "상품명 없음";
          const categoryResult = inferCategory(name, cat.name);

          if (!categoryResult) {
            console.log(`[coupang-batch] Skip non-fashion: ${name.substring(0, 40)}`);
            skipped++;
            continue;
          }

          const { category, subCategory } = categoryResult;

          const { error } = await supabase
            .from("products_cache")
            .upsert({
              name,
              price: item.productPrice || 0,
              brand: item.vendorName || "쿠팡",
              image_url: item.productImage,
              product_url: item.productUrl,
              category,
              sub_category: subCategory,
              gender: cat.gender,
              merchant_id: "coupang",
              external_id: `coupang_${productId}`,
              is_active: true,
              is_in_stock: true,
            }, { onConflict: "external_id", ignoreDuplicates: false });

          if (error) {
            console.error(`[coupang-batch] Save error: ${error.message}`);
            errors++;
          } else {
            saved++;
          }
        } catch (e) {
          console.error(`[coupang-batch] Processing error:`, e);
          errors++;
        }
      }

      results.push({ categoryId: cat.id, categoryName: cat.name, collected: products.length, saved, skipped, errors });
      console.log(`[coupang-batch] ${cat.name}: collected=${products.length}, saved=${saved}, skipped=${skipped}, errors=${errors}`);
    }

    const totalCollected = results.reduce((s, r) => s + r.collected, 0);
    const totalSaved = results.reduce((s, r) => s + r.saved, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors, 0);

    console.log(`[coupang-batch] Done: collected=${totalCollected}, saved=${totalSaved}, skipped=${totalSkipped}, errors=${totalErrors}`);

    // 저장된 새 상품에 DNA 자동 생성 트리거 (dna_meta가 없는 것만)
    if (totalSaved > 0) {
      console.log(`[coupang-batch] Triggering DNA generation for new products...`);
      try {
        const dnaResponse = await fetch(`${supabaseUrl}/functions/v1/dna-batch`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ batchSize: 200, merchantId: "coupang" }),
        });
        const dnaResult = await dnaResponse.json();
        console.log(`[coupang-batch] DNA batch result:`, JSON.stringify(dnaResult).substring(0, 200));
      } catch (dnaErr) {
        console.warn(`[coupang-batch] DNA trigger failed (will run separately):`, dnaErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: { totalCollected, totalSaved, totalSkipped, totalErrors, categoriesProcessed: results.length, timestamp: new Date().toISOString() },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[coupang-batch] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
