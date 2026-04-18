import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HMAC-SHA256 signature generation for Coupang Partners API
async function generateHmacSignature(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const [path, query = ""] = url.split("?");
  
  // GMT 시간 형식: yyMMdd'T'HHmmss'Z'
  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(2); // YYMMDDTHHmmssZ 형식
  
  const message = datetime + method + path + query;
  
  // HMAC-SHA256 서명 생성
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

// DNA 생성 함수 (기존 dna-batch 로직 재사용)
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

// 비패션 차단 + 패션 화이트리스트 (coupang-batch와 동기화)
const NON_FASHION_BLOCK_LIST_TEST = /충전기|케이블|배터리|이어폰|헤드폰|전자|가전|화장품|영양제|비타민|식품|음료|커피|차\b|라면|과자|반려동물|장난감|세제|휴지|치약|샴푸|마스크(?!.*방한)|운동기구|캠핑|텐트|공구|페인트|문구|악기|화분|식물|세척천|클리너|광택제|변색제거|클리닝|리무버|수세미|식기|그릇|머그|텀블러|보온병|냄비|프라이팬|키친타올|일회용|디퓨저|캔들|우유|두유|어묵|식초|아메리카노|식빵|설탕|소금|밀가루|식자재|식재료|시리얼|꿀\b|잼\b|훈제|다짐육|냉장|냉동|상추|시금치|버섯|당근|오이|무\b|호박|배추|감자|쌀\b|토마토|아보카도|두부|복사용지|샘물|생수|마그네슘|종근당|박토킬|악취|발냄새|무좀|즙\b|캐리어|여행가방|기내용.*캐리어|하드.*캐리어|장우산|3단.*우산|자동.*우산|비닐우산|우산|우비|판초우의|레인코트|골프우산|제골기|슈트리|발볼확장|수선패드|뒤꿈치|옷걸이|버블건|신주머니|보조가방|짐색|머리핀|토슈즈|신발주머니|복주머니|용돈주머니|짜파게티|너구리|소스|육수|콜라|사이다|펩시|아몬드.*음료|아몬드브리즈|니트릴장갑|위생장갑/i;

const FASHION_WHITELIST_TEST = /티셔츠|셔츠|블라우스|니트(?!릴)|스웨터|가디건|맨투맨|후드(?!.*우산)|후디|폴로|나시|민소매|반팔|긴팔|t-shirt|tee\b|바지(?!걸이)|팬츠|청바지|데님|슬랙스|조거|레깅스|반바지|숏팬츠|숏츠|치마|스커트|원피스|드레스(?!하우스|싱)|자켓|재킷|블레이저|코트(?!\.|로|니스)|패딩|점퍼|야상|무스탕|바람막이|집업|아노락|플리스(?!.*그릇|.*용기)|운동화|스니커즈|로퍼|구두|부츠|샌들|슬리퍼|아쿠아슈즈|크록스|컨버스|어그|첼시|sneaker|loafer|sandal|boots|shoes|나이키|아디다스|뉴발란스|푸마|반스|아식스|호카|살로몬|백팩|토트백|숄더백|크로스백|클러치|에코백|메신저백|힙색|장갑|글러브(?!.*야구|.*골프)|넥워머|바라클라바|귀마개|이어머프|방한.*마스크|버킷햇|볼캡|비니|페도라|모자(?!걸이)|두건|헤어밴드|선캡|벨트(?!.*수선|.*공구)|선글라스|스카프|머플러|목걸이|귀걸이|반지|팔찌|시계|주얼리|jacket|blazer|coat|hoodie|knit|sweater|jeans|denim|pants|shorts|skirt|dress|bag/i;

function isFashionProductTest(name: string): boolean {
  if (NON_FASHION_BLOCK_LIST_TEST.test(name)) return false;
  if (!FASHION_WHITELIST_TEST.test(name)) return false;
  return true;
}

function inferCategory(name: string): { category: string; subCategory: string } | null {
  if (!isFashionProductTest(name)) return null;
  
  if (/자켓|재킷|블레이저|코트(?!\.|로|니스)|패딩|점퍼|야상|무스탕|바람막이|집업/.test(name)) {
    if (/패딩|다운/.test(name)) return { category: "아우터", subCategory: "패딩" };
    if (/코트(?!\.|로|니스)/.test(name)) return { category: "아우터", subCategory: "코트" };
    return { category: "아우터", subCategory: "자켓" };
  }
  if (/티셔츠|^티 |맨투맨|후드(?!.*우산)|스웨트|니트(?!릴)|가디건|셔츠|블라우스|폴로|나시|민소매/.test(name)) {
    if (/맨투맨|스웨트/.test(name)) return { category: "상의", subCategory: "맨투맨" };
    if (/후드/.test(name)) return { category: "상의", subCategory: "후드" };
    if (/니트|스웨터/.test(name)) return { category: "상의", subCategory: "니트" };
    if (/가디건/.test(name)) return { category: "아우터", subCategory: "가디건" };
    if (/셔츠|블라우스/.test(name)) return { category: "상의", subCategory: "셔츠" };
    return { category: "상의", subCategory: "티셔츠" };
  }
  if (/팬츠|바지(?!걸이)|진|청바지|데님|슬랙스|조거|트레이닝|레깅스|반바지|숏/.test(name)) {
    if (/청바지|데님|진/.test(name)) return { category: "하의", subCategory: "데님" };
    if (/슬랙스/.test(name)) return { category: "하의", subCategory: "슬랙스" };
    return { category: "하의", subCategory: "팬츠" };
  }
  if (/원피스|드레스(?!하우스|싱)/.test(name)) {
    return { category: "원피스", subCategory: "원피스" };
  }
  if (/스커트|치마/.test(name)) {
    return { category: "하의", subCategory: "스커트" };
  }
  if (/장갑|글러브(?!.*야구)/.test(name)) return { category: "액세서리", subCategory: "장갑" };
  if (/바라클라바|넥워머|넥게이터|목토시/.test(name)) return { category: "액세서리", subCategory: "넥워머" };
  if (/귀마개|귀달이|이어밴드|이어머프/.test(name)) return { category: "액세서리", subCategory: "귀마개" };
  if (/방한.*마스크/.test(name)) return { category: "액세서리", subCategory: "방한마스크" };
  if (/스니커즈|운동화|구두|로퍼|부츠|샌들|슬리퍼|아쿠아슈즈/.test(name)) {
    return { category: "신발", subCategory: "신발" };
  }
  if (/가방|백|토트|숄더|크로스|클러치|백팩/.test(name)) {
    return { category: "가방", subCategory: "가방" };
  }
  if (/모자|캡|벨트(?!.*수선)|선글라스|스카프|머플러|목걸이|귀걸이|반지|팔찌|시계/.test(name)) {
    return { category: "액세서리", subCategory: "액세서리" };
  }
  
  return null;
}

function generateDNA(product: {
  name: string;
  price: number;
  brand?: string;
  category?: string;
}): { dna_meta: DNAMeta; dna_text: string } {
  const { category, subCategory } = inferCategory(product.name);
  
  // 기본 DNA 생성
  const dna_meta: DNAMeta = {
    target: "adult_unisex",
    item_slot: category === "아우터" ? "outer" :
               category === "상의" ? "top" :
               category === "하의" ? "bottom" :
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
  } else if (product.price < 50000) {
    dna_meta.formality = 3;
    dna_meta.concepts = ["casual", "basic"];
  }
  
  // DNA 텍스트 생성
  const dna_text = `${product.brand || "브랜드"} ${subCategory}. ` +
    `${dna_meta.concepts.join(", ")} 스타일. ` +
    `${dna_meta.season_fit.join("/")} 시즌 적합. ` +
    `포멀리티 ${dna_meta.formality}/10.`;
  
  return { dna_meta, dna_text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get("COUPANG_ACCESS_KEY");
    const secretKey = Deno.env.get("COUPANG_SECRET_KEY");
    
    if (!accessKey || !secretKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "쿠팡 API 키가 설정되지 않았습니다." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action = "search", keyword = "로켓패션", limit = 5, urls, products } = body;

    // 1. 상품 검색 테스트
    if (action === "search") {
      const apiPath = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
      const queryParams = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
      const fullPath = `${apiPath}?${queryParams}`;
      
      const authorization = await generateHmacSignature("GET", fullPath, accessKey, secretKey);
      
      console.log("Calling Coupang API:", fullPath);
      
      const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
        method: "GET",
        headers: {
          "Authorization": authorization,
          "Content-Type": "application/json",
        },
      });
      
      const responseText = await response.text();
      console.log("Coupang API Response Status:", response.status);
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `쿠팡 API 오류: ${response.status}`,
            details: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "JSON 파싱 실패",
            raw: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // 상품 데이터 추출 및 DNA 생성
      const searchProducts = data.data?.productData || [];
      const processedProducts = searchProducts.map((item: any) => {
        // 실제 상품 이미지 URL 추출 시도
        // ads-partners 이미지는 광고 배너이므로 실제 상품 이미지로 변환 시도
        let imageUrl = item.productImage || item.imageUrl || "";
        
        // 쿠팡 실제 상품 이미지 URL 패턴으로 변환 시도
        // productId를 사용해 실제 이미지 URL 생성
        const productId = item.productId;
        if (productId) {
          // 쿠팡 상품 이미지 URL 형식 시도
          imageUrl = `https://thumbnail7.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/product-main/${productId}.jpg`;
        }
        
        const product = {
          name: item.productName || item.itemName || "상품명 없음",
          price: item.productPrice || item.salePrice || 0,
          brand: item.brandName || "쿠팡",
          image_url: imageUrl,
          original_api_image: item.productImage, // 원본 API 이미지 (비교용)
          product_url: item.productUrl || item.landingUrl,
          product_id: productId,
          category: item.categoryName || "패션",
          isRocket: item.isRocket,
        };
        
        const { dna_meta, dna_text } = generateDNA(product);
        
        return {
          ...product,
          dna_meta,
          dna_text,
          source: "coupang",
        };
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "search",
          keyword,
          total: processedProducts.length,
          products: processedProducts,
          raw_response: data,
          note: "productImage from API is ads banner. Try goldbox action for better images."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 1.5 GoldBox API (베스트 상품 - 더 나은 이미지 제공)
    if (action === "goldbox") {
      const categoryId = body.categoryId || 115573; // 115573 = 패션의류
      const apiPath = "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox";
      const queryParams = `categoryId=${categoryId}&limit=${limit}`;
      const fullPath = `${apiPath}?${queryParams}`;
      
      const authorization = await generateHmacSignature("GET", fullPath, accessKey, secretKey);
      
      console.log("Calling Coupang GoldBox API:", fullPath);
      
      const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
        method: "GET",
        headers: {
          "Authorization": authorization,
          "Content-Type": "application/json",
        },
      });
      
      const responseText = await response.text();
      console.log("Coupang GoldBox Response Status:", response.status);
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `쿠팡 GoldBox API 오류: ${response.status}`,
            details: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "JSON 파싱 실패",
            raw: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "goldbox",
          categoryId,
          raw_response: data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 1.6 BestCategories API (카테고리별 베스트 - 실제 상품 이미지 제공)
    if (action === "best") {
      // 1001 = 여성패션, 1002 = 남성패션
      const categoryId = body.categoryId || 1002;
      const apiPath = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/bestcategories/${categoryId}`;
      const queryParams = `limit=${limit}`;
      const fullPath = `${apiPath}?${queryParams}`;
      
      const authorization = await generateHmacSignature("GET", fullPath, accessKey, secretKey);
      
      console.log("Calling Coupang BestCategories API:", fullPath);
      
      const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
        method: "GET",
        headers: {
          "Authorization": authorization,
          "Content-Type": "application/json",
        },
      });
      
      const responseText = await response.text();
      console.log("Coupang BestCategories Response Status:", response.status);
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `쿠팡 BestCategories API 오류: ${response.status}`,
            details: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "JSON 파싱 실패",
            raw: responseText
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // 상품 데이터 추출 및 DNA 생성
      const bestProducts = data.data || [];
      const processedProducts = bestProducts.map((item: any) => {
        const product = {
          name: item.productName || "상품명 없음",
          price: item.productPrice || item.salePrice || 0,
          brand: item.vendorName || "쿠팡",
          image_url: item.productImage, // coupangcdn.com 실제 이미지
          product_url: item.productUrl,
          product_id: item.productId,
          category: item.categoryName || "패션",
          isRocket: item.isRocket,
        };
        
        const { dna_meta, dna_text } = generateDNA(product);
        
        return {
          ...product,
          dna_meta,
          dna_text,
          source: "coupang",
        };
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "best",
          categoryId,
          categoryName: categoryId === 1001 ? "여성패션" : categoryId === 1002 ? "남성패션" : `카테고리 ${categoryId}`,
          total: processedProducts.length,
          products: processedProducts,
          raw_response: data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 2. 딥링크 생성 테스트
    if (action === "deeplink") {
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "urls 배열이 필요합니다." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      const apiPath = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
      const authorization = await generateHmacSignature("POST", apiPath, accessKey, secretKey);
      
      const response = await fetch(`https://api-gateway.coupang.com${apiPath}`, {
        method: "POST",
        headers: {
          "Authorization": authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coupangUrls: urls,
        }),
      });
      
      const data = await response.json();
      
      return new Response(
        JSON.stringify({ 
          success: response.ok, 
          action: "deeplink",
          data 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (action === "save") {
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "저장할 상품이 없습니다." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const results = [];
      for (const product of products) {
        const { error } = await supabase
          .from("products_cache")
          .upsert({
            name: product.name,
            price: product.price,
            brand: product.brand || "쿠팡",
            image_url: product.image_url,
            product_url: product.product_url,
            category: product.category || "패션",
            merchant_id: "coupang",
            external_id: `coupang_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            dna_meta: product.dna_meta,
            dna_text: product.dna_text,
            dna_generated_at: new Date().toISOString(),
            is_active: true,
          }, { onConflict: "product_url" });
        
        if (error) {
          results.push({ name: product.name, success: false, error: error.message });
        } else {
          results.push({ name: product.name, success: true });
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "save",
          results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "지원하지 않는 action입니다. (search, deeplink, save 중 선택)" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
