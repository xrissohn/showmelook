import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeResult {
  id: string;
  product_url: string;
  image_url: string | null;
  success: boolean;
  error?: string;
}

// Extract image from StockX product page
async function scrapeStockXImage(url: string): Promise<string | null> {
  try {
    // Method 1: Use Firecrawl if available
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (firecrawlApiKey) {
      console.log(`[Firecrawl] Scraping: ${url}`);
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['html'],
          onlyMainContent: false,
          waitFor: 3000,
          timeout: 30000,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          const html = data.data.html;
          
          // Extract og:image
          const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
          if (ogImageMatch?.[1]) {
            console.log(`[Firecrawl] Found og:image: ${ogImageMatch[1]}`);
            return ogImageMatch[1];
          }
          
          // Try JSON-LD
          const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
          if (jsonLdMatch) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              if (jsonLd['@type'] === 'Product' && jsonLd.image) {
                const imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
                console.log(`[Firecrawl] Found JSON-LD image: ${imageUrl}`);
                return imageUrl;
              }
            } catch (e) {
              console.log('[Firecrawl] JSON-LD parsing failed');
            }
          }
        }
      }
    }
    
    // Method 2: Use BrightData if available
    const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
    if (apiKey) {
      console.log(`[BrightData] Scraping: ${url}`);
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          zone: 'linkprice_web_unlocker',
          url: url,
          format: 'raw',
          country: 'us', // US IP for StockX
        }),
      });
      
      if (response.ok) {
        const html = await response.text();
        if (html && html.length > 1000) {
          // Extract og:image
          const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
          if (ogImageMatch?.[1]) {
            console.log(`[BrightData] Found og:image: ${ogImageMatch[1]}`);
            return ogImageMatch[1];
          }
        }
      }
    }
    
    // Method 3: Direct fetch (may not work due to bot protection)
    console.log(`[Direct] Scraping: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImageMatch?.[1]) {
        console.log(`[Direct] Found og:image: ${ogImageMatch[1]}`);
        return ogImageMatch[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { limit = 10, productIds } = await req.json().catch(() => ({}));

    // Get StockX products without images
    let query = supabase
      .from('products_cache')
      .select('id, product_url, name')
      .eq('merchant_id', 'stockx')
      .is('image_url', null);
    
    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds);
    }
    
    const { data: products, error: fetchError } = await query.limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No products without images found',
          results: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[StockX] Processing ${products.length} products`);

    const results: ScrapeResult[] = [];
    let successCount = 0;

    for (const product of products) {
      console.log(`[StockX] Scraping: ${product.name}`);
      
      const imageUrl = await scrapeStockXImage(product.product_url);
      
      if (imageUrl) {
        // Update the product with the image URL
        const { error: updateError } = await supabase
          .from('products_cache')
          .update({ image_url: imageUrl })
          .eq('id', product.id);

        if (updateError) {
          results.push({
            id: product.id,
            product_url: product.product_url,
            image_url: null,
            success: false,
            error: `Update failed: ${updateError.message}`,
          });
        } else {
          successCount++;
          results.push({
            id: product.id,
            product_url: product.product_url,
            image_url: imageUrl,
            success: true,
          });
        }
      } else {
        results.push({
          id: product.id,
          product_url: product.product_url,
          image_url: null,
          success: false,
          error: 'Failed to extract image',
        });
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[StockX] Complete: ${successCount}/${products.length} images updated`);

    return new Response(
      JSON.stringify({
        success: true,
        total: products.length,
        updated: successCount,
        failed: products.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[StockX] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
