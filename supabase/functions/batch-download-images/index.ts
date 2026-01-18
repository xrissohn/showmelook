import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchDownloadRequest {
  merchantId: string;
  limit?: number;
}

interface DownloadResult {
  productId: string;
  productName: string;
  originalUrl: string;
  storageUrl?: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { merchantId, limit = 10 }: BatchDownloadRequest = await req.json();

    if (!merchantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-download-images] Starting batch download for merchant: ${merchantId}, limit: ${limit}`);

    // Get storage base URL for comparison
    const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/product-images`;

    // 1. Get products with external image URLs (not already in storage)
    const { data: products, error: fetchError } = await supabase
      .from('products_cache')
      .select('id, name, image_url, merchant_id')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .not('image_url', 'like', `${storageBaseUrl}%`)
      .limit(limit);

    if (fetchError) {
      console.error('[batch-download-images] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch products: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      console.log('[batch-download-images] No products with external images found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No products with external images found',
          total: 0,
          updated: 0,
          failed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-download-images] Found ${products.length} products to process`);

    const results: DownloadResult[] = [];
    let updated = 0;
    let failed = 0;

    // 2. Process each product
    for (const product of products) {
      const imageUrl = product.image_url!;
      console.log(`[batch-download-images] Processing: ${product.name} (${product.id})`);

      try {
        // Download image
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'Accept': 'image/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': imageUrl.split('/').slice(0, 3).join('/'),
          },
        });

        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }

        // Determine extension from content type
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        let extension = 'jpg';
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('avif')) extension = 'avif';
        else if (contentType.includes('gif')) extension = 'gif';

        // Get image data
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageUint8 = new Uint8Array(imageBuffer);

        // Check file size (max 5MB)
        if (imageUint8.length > 5 * 1024 * 1024) {
          throw new Error('Image exceeds 5MB limit');
        }

        // Upload to storage
        const fileName = `${merchantId}/${product.id}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageUint8, {
            contentType: contentType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        const storageUrl = publicUrlData.publicUrl;

        // Update product
        const { error: updateError } = await supabase
          .from('products_cache')
          .update({ 
            image_url: storageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }

        results.push({
          productId: product.id,
          productName: product.name,
          originalUrl: imageUrl,
          storageUrl,
          success: true,
        });
        updated++;
        console.log(`[batch-download-images] ✅ Success: ${product.name}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[batch-download-images] ❌ Failed: ${product.name} - ${errorMessage}`);
        results.push({
          productId: product.id,
          productName: product.name,
          originalUrl: imageUrl,
          success: false,
          error: errorMessage,
        });
        failed++;
      }

      // Rate limiting: 1 second delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Get remaining count
    const { count: remainingCount } = await supabase
      .from('products_cache')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .not('image_url', 'like', `${storageBaseUrl}%`);

    console.log(`[batch-download-images] Completed. Updated: ${updated}, Failed: ${failed}, Remaining: ${remainingCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        merchantId,
        total: products.length,
        updated,
        failed,
        remaining: remainingCount || 0,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[batch-download-images] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
