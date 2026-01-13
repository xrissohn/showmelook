import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DNAMeta {
  target?: string;
  formality?: number;
  item_slot?: string;
  concepts?: string[];
  occasions?: string[];
  color_family?: string;
  season_fit?: string[];
  pair_slots?: string[];
}

interface UserPreferences {
  gender?: 'male' | 'female' | 'unisex';
  style?: string[];
  budget?: { min?: number; max?: number };
  occasion?: string;
  categories?: string[];
  formality?: number; // 0-10, 0=casual, 10=formal
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
  dna_meta: DNAMeta | null;
}

interface LookRecommendation {
  items: Product[];
  totalPrice: number;
  styleTags: string[];
  occasion: string;
  formalityScore: number;
}

// Map occasion to formality level
const occasionFormality: Record<string, number> = {
  '캐주얼': 2,
  '데일리': 3,
  '데이트': 5,
  '출근': 6,
  '비즈니스': 7,
  '미팅': 8,
  '파티': 6,
  '운동': 1,
  '기본': 4,
};

// Map occasion to required item slots
const occasionSlots: Record<string, string[]> = {
  '캐주얼': ['top', 'bottom', 'shoes'],
  '비즈니스': ['top', 'bottom', 'outer', 'shoes'],
  '데이트': ['top', 'bottom', 'shoes', 'acc'],
  '파티': ['dress', 'shoes', 'acc', 'bag'],
  '운동': ['top', 'bottom', 'shoes'],
  '기본': ['top', 'bottom', 'shoes'],
};

serve(async (req) => {
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

    const occasion = preferences.occasion || '기본';
    const targetFormality = preferences.formality ?? occasionFormality[occasion] ?? 4;
    const requiredSlots = occasionSlots[occasion] || occasionSlots['기본'];
    
    console.log(`[style-v1] Occasion: ${occasion}, Formality: ${targetFormality}, Slots: ${requiredSlots.join(', ')}`);

    // Load merchants for affiliate links
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

    // Build the look: one product per slot
    const lookItems: Product[] = [];
    let totalPrice = 0;
    const allConcepts: string[] = [];
    let selectedColorFamily: string | null = null;

    for (const slot of requiredSlots) {
      // Query products with DNA meta for this slot
      let query = supabase
        .from('products_cache')
        .select('id, name, brand, price, image_url, product_url, category, style_tags, merchant_id, dna_meta')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .not('dna_meta', 'is', null);

      // Filter by item_slot using JSONB
      query = query.eq('dna_meta->>item_slot', slot);

      // Filter by target (adult only for now)
      query = query.or('dna_meta->>target.eq.adult,dna_meta->>target.is.null');

      // Apply budget filter
      if (preferences.budget?.min) {
        query = query.gte('price', preferences.budget.min);
      }
      if (preferences.budget?.max) {
        query = query.lte('price', preferences.budget.max);
      }

      // Apply gender filter
      if (preferences.gender && preferences.gender !== 'unisex') {
        query = query.or(`gender.eq.${preferences.gender},gender.is.null`);
      }

      const { data: products, error } = await query.limit(30);

      if (error) {
        console.error(`[style-v1] Error fetching ${slot}:`, error);
        continue;
      }

      if (!products || products.length === 0) {
        console.log(`[style-v1] No products found for slot: ${slot}`);
        continue;
      }

      // Score products using DNA meta
      const scoredProducts = products.map((p) => {
        let score = 0;
        const dna = p.dna_meta as DNAMeta | null;

        if (!dna) return { ...p, score: 0 };

        // 1. Formality match (max 30 points)
        if (dna.formality !== undefined) {
          const formalityDiff = Math.abs(dna.formality - targetFormality);
          score += Math.max(0, 30 - formalityDiff * 5);
        }

        // 2. Color consistency (max 20 points)
        if (selectedColorFamily && dna.color_family) {
          if (dna.color_family === selectedColorFamily) {
            score += 20; // Same color family
          } else if (dna.color_family === 'neutral' || selectedColorFamily === 'neutral') {
            score += 15; // Neutral pairs well with anything
          } else if (
            (dna.color_family === 'warm' && selectedColorFamily === 'warm') ||
            (dna.color_family === 'cool' && selectedColorFamily === 'cool')
          ) {
            score += 10; // Same tone
          }
        } else {
          score += 10; // First item, neutral bonus
        }

        // 3. Concept match with user styles (max 20 points)
        if (preferences.style && dna.concepts) {
          for (const userStyle of preferences.style) {
            if (dna.concepts.includes(userStyle)) {
              score += 5;
            }
          }
        }

        // 4. Concept consistency with existing look (max 15 points)
        if (dna.concepts && allConcepts.length > 0) {
          for (const concept of dna.concepts) {
            if (allConcepts.includes(concept)) {
              score += 3;
            }
          }
        }

        // 5. Occasion match (max 10 points)
        if (dna.occasions) {
          const occasionKeywords = [occasion, ...getOccasionKeywords(occasion)];
          for (const occ of dna.occasions) {
            if (occasionKeywords.includes(occ)) {
              score += 5;
            }
          }
        }

        // 6. Image bonus
        if (p.image_url) {
          score += 3;
        }

        // 7. Slight randomization
        score += Math.random() * 2;

        return { ...p, score };
      });

      // Sort and pick best
      scoredProducts.sort((a, b) => b.score - a.score);
      const selected = scoredProducts[0];

      // Generate affiliate link
      let affiliateUrl = selected.product_url;
      if (selected.merchant_id && merchantTemplates[selected.merchant_id] && LINKPRICE_AFFILIATE_ID) {
        const template = merchantTemplates[selected.merchant_id];
        affiliateUrl = template
          .replace('{affiliate_id}', LINKPRICE_AFFILIATE_ID)
          .replace('{encoded_url}', encodeURIComponent(selected.product_url));
      }

      const productWithAffiliate = { ...selected, product_url: affiliateUrl };
      lookItems.push(productWithAffiliate);
      totalPrice += selected.price;

      // Update tracking for consistency
      const dna = selected.dna_meta as DNAMeta | null;
      if (dna) {
        if (dna.color_family && !selectedColorFamily) {
          selectedColorFamily = dna.color_family;
        }
        if (dna.concepts) {
          for (const c of dna.concepts) {
            if (!allConcepts.includes(c)) allConcepts.push(c);
          }
        }
      }

      console.log(`[style-v1] Selected ${slot}: ${selected.name} (₩${selected.price.toLocaleString()}, score: ${selected.score.toFixed(1)})`);
    }

    if (lookItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '추천할 상품이 없습니다. DNA가 생성된 상품이 필요합니다.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recommendation: LookRecommendation = {
      items: lookItems,
      totalPrice,
      styleTags: allConcepts.slice(0, 5),
      occasion,
      formalityScore: targetFormality,
    };

    console.log(`[style-v1] Generated look: ${lookItems.length} items, ₩${totalPrice.toLocaleString()}, concepts: ${allConcepts.join(', ')}`);

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

function getOccasionKeywords(occasion: string): string[] {
  const keywords: Record<string, string[]> = {
    '캐주얼': ['일상', '편안함', '데일리'],
    '비즈니스': ['출근', '미팅', '정장'],
    '데이트': ['로맨틱', '특별한날'],
    '파티': ['모임', '축하', '이벤트'],
    '운동': ['스포츠', '활동적'],
  };
  return keywords[occasion] || [];
}
