import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  id: string;
  name: string;
  image_url: string;
  status: number;
  valid: boolean;
}

async function checkImageUrl(url: string): Promise<{ status: number; valid: boolean }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return {
      status: response.status,
      valid: response.ok
    };
  } catch (error) {
    console.error(`Error checking URL ${url}:`, error);
    return { status: 0, valid: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId = 'stockx', limit = 100, dryRun = false } = await req.json().catch(() => ({}));

    // 1. 활성화된 상품 중 이미지 URL이 있는 상품들 조회
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, image_url')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No products to validate",
          checked: 0,
          invalid: 0,
          deactivated: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Validating ${products.length} products from ${merchantId}...`);

    const results: ValidationResult[] = [];
    const invalidProducts: string[] = [];

    // 2. 각 상품의 이미지 URL 검증 (순차적으로 rate limiting 방지)
    for (const product of products) {
      const { status, valid } = await checkImageUrl(product.image_url);
      
      results.push({
        id: product.id,
        name: product.name,
        image_url: product.image_url,
        status,
        valid
      });

      if (!valid) {
        invalidProducts.push(product.id);
        console.log(`Invalid image: ${product.name} (status: ${status})`);
      }

      // Rate limiting - 100ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let deactivatedCount = 0;

    // 3. 유효하지 않은 이미지의 상품들 비활성화
    if (!dryRun && invalidProducts.length > 0) {
      const { error: updateError, count } = await supabase
        .from('products_cache')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', invalidProducts);

      if (updateError) {
        console.error('Failed to deactivate products:', updateError);
      } else {
        deactivatedCount = invalidProducts.length;
        console.log(`Deactivated ${deactivatedCount} products with invalid images`);
      }
    }

    const invalidResults = results.filter(r => !r.valid);

    return new Response(
      JSON.stringify({
        success: true,
        checked: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: invalidResults.length,
        deactivated: deactivatedCount,
        dryRun,
        invalidProducts: invalidResults.map(r => ({
          id: r.id,
          name: r.name,
          status: r.status
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in validate-images:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
