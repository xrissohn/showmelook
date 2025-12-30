import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserPreferences {
  gender?: 'male' | 'female' | 'unisex';
  style?: string[];
  budget?: { min?: number; max?: number };
  occasion?: string;
  categories?: string[];
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  merchant_id: string | null;
}

interface LookRecommendation {
  items: Product[];
  totalPrice: number;
  styleTags: string[];
  occasion: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const LINKPRICE_AFFILIATE_ID = Deno.env.get('LINKPRICE_AFFILIATE_ID');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { preferences }: { preferences: UserPreferences } = await req.json();
    console.log('[style-v1] Received preferences:', JSON.stringify(preferences));

    // Define look composition rules by occasion
    const lookRules: Record<string, string[]> = {
      '캐주얼': ['상의', '하의', '신발'],
      '비즈니스': ['상의', '하의', '아우터', '신발'],
      '데이트': ['상의', '하의', '신발', '악세서리'],
      '파티': ['원피스', '신발', '악세서리', '가방'],
      '운동': ['상의', '하의', '신발'],
      '기본': ['상의', '하의', '신발'],
    };

    const occasion = preferences.occasion || '기본';
    const requiredCategories = preferences.categories || lookRules[occasion] || lookRules['기본'];
    console.log(`[style-v1] Building look for occasion: ${occasion}, categories: ${requiredCategories.join(', ')}`);

    // Load merchants for affiliate link generation
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, deeplink_template')
      .eq('is_active', true);

    const merchantTemplates: Record<string, string> = {};
    if (merchants) {
      for (const m of merchants) {
        merchantTemplates[m.id] = m.deeplink_template;
      }
    }

    // Build the look: select one product per category
    const lookItems: Product[] = [];
    let totalPrice = 0;
    const allStyleTags: string[] = [];

    for (const category of requiredCategories) {
      let query = supabase
        .from('products_cache')
        .select('id, name, brand, price, image_url, product_url, category, style_tags, merchant_id')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .eq('category', category);

      // Apply budget filter if specified
      if (preferences.budget?.min) {
        query = query.gte('price', preferences.budget.min);
      }
      if (preferences.budget?.max) {
        query = query.lte('price', preferences.budget.max);
      }

      // Apply gender filter if specified
      if (preferences.gender && preferences.gender !== 'unisex') {
        query = query.or(`gender.eq.${preferences.gender},gender.is.null`);
      }

      // Get products in this category
      const { data: products, error } = await query.limit(20);

      if (error) {
        console.error(`[style-v1] Error fetching ${category}:`, error);
        continue;
      }

      if (!products || products.length === 0) {
        console.log(`[style-v1] No products found for category: ${category}`);
        continue;
      }

      // Score products by style match
      let scoredProducts = products.map((p) => {
        let score = 0;
        const productTags = p.style_tags || [];

        // Match user style preferences
        if (preferences.style) {
          for (const userStyle of preferences.style) {
            if (productTags.includes(userStyle)) {
              score += 10;
            }
          }
        }

        // Match existing look style tags for consistency
        for (const existingTag of allStyleTags) {
          if (productTags.includes(existingTag)) {
            score += 5;
          }
        }

        // Bonus for having image
        if (p.image_url) {
          score += 3;
        }

        // Slight randomization to avoid always picking the same items
        score += Math.random() * 2;

        return { ...p, score };
      });

      // Sort by score and pick the best one
      scoredProducts = scoredProducts.sort((a, b) => b.score - a.score);
      const selectedProduct = scoredProducts[0];

      // Generate affiliate link
      let affiliateUrl = selectedProduct.product_url;
      if (selectedProduct.merchant_id && merchantTemplates[selectedProduct.merchant_id] && LINKPRICE_AFFILIATE_ID) {
        const template = merchantTemplates[selectedProduct.merchant_id];
        affiliateUrl = template
          .replace('{affiliate_id}', LINKPRICE_AFFILIATE_ID)
          .replace('{encoded_url}', encodeURIComponent(selectedProduct.product_url));
      }

      const productWithAffiliate = {
        ...selectedProduct,
        product_url: affiliateUrl,
      };

      lookItems.push(productWithAffiliate);
      totalPrice += selectedProduct.price;
      
      // Collect style tags for consistency scoring
      if (selectedProduct.style_tags) {
        for (const tag of selectedProduct.style_tags) {
          if (!allStyleTags.includes(tag)) {
            allStyleTags.push(tag);
          }
        }
      }

      console.log(`[style-v1] Selected ${category}: ${selectedProduct.name} (₩${selectedProduct.price.toLocaleString()})`);
    }

    if (lookItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '추천할 상품이 없습니다. 상품 수집을 먼저 진행해주세요.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recommendation: LookRecommendation = {
      items: lookItems,
      totalPrice,
      styleTags: allStyleTags,
      occasion,
    };

    console.log(`[style-v1] Generated look with ${lookItems.length} items, total: ₩${totalPrice.toLocaleString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        look: recommendation,
        message: `${occasion} 스타일 룩을 추천합니다.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[style-v1] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
