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

function inferCategory(name: string): { category: string; subCategory: string } {
  const lowerName = name.toLowerCase();
  
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
  if (/목걸이|귀걸이|반지|팔찌|시계|주얼리|액세서리|넥워머|머플러|스카프|모자|장갑/.test(name)) {
    return { category: "액세서리", subCategory: "액세서리" };
  }
  
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
}): { dna_meta: DNAMeta; dna_text: string } {
  const { category, subCategory } = inferCategory(product.name);
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
  
  return { dna_meta, dna_text };
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
    
    const results: { categoryId: number; categoryName: string; collected: number; saved: number; errors: number }[] = [];
    
    for (const catId of categoryIds) {
      const categoryInfo = FASHION_CATEGORIES.find(c => c.id === catId);
      const categoryName = categoryInfo?.name || `카테고리 ${catId}`;
      
      console.log(`Fetching category ${catId} (${categoryName})...`);
      
      // API 호출 간 딜레이 (rate limit 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const products = await fetchBestProducts(catId, limitPerCategory, accessKey, secretKey);
      
      let saved = 0;
      let errors = 0;
      
      for (const item of products) {
        try {
          const product = {
            name: item.productName || "상품명 없음",
            price: item.productPrice || 0,
            brand: item.vendorName || "쿠팡",
            categoryId: catId,
          };
          
          const { dna_meta, dna_text } = generateDNA(product);
          const gender = inferGender(catId, product.name);
          
          const { error } = await supabase
            .from("products_cache")
            .upsert({
              name: product.name,
              price: product.price,
              brand: product.brand,
              image_url: item.productImage,
              product_url: item.productUrl,
              category: item.categoryName || categoryName,
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
        errors,
      });
      
      console.log(`Category ${categoryName}: collected=${products.length}, saved=${saved}, errors=${errors}`);
    }
    
    const totalCollected = results.reduce((sum, r) => sum + r.collected, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    
    console.log(`Batch complete: total collected=${totalCollected}, saved=${totalSaved}, errors=${totalErrors}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalCollected,
          totalSaved,
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
