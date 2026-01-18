import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchDownloadAllRequest {
  batchSize?: number;
}

interface ProcessResult {
  productId: string;
  productName: string;
  merchantId: string;
  originalUrl: string;
  storageUrl?: string;
  success: boolean;
  error?: string;
}

// High-resolution image URL transformer
function getHighResImageUrl(imageUrl: string, merchantId: string): string {
  if (!imageUrl) return imageUrl;
  
  // Paul Smith: upgrade from w_614 to w_1200
  if (merchantId === 'paulsmith' && imageUrl.includes('w_614')) {
    return imageUrl.replace('w_614', 'w_1200');
  }
  
  // WConcept: upgrade width parameters
  if (merchantId === 'wconcept' && imageUrl.includes('w=')) {
    return imageUrl.replace(/w=\d+/, 'w=1200');
  }
  
  // Posty: upgrade image size
  if (merchantId === 'posty' && imageUrl.includes('/resize/')) {
    return imageUrl.replace(/\/resize\/\d+/, '/resize/1200');
  }
  
  // StockX: remove resize parameters for original quality
  if (merchantId === 'stockx' && imageUrl.includes('?w=')) {
    return imageUrl.split('?')[0];
  }
  
  return imageUrl;
}

// Background download task
async function processAllImages(
  supabase: any,
  storageBaseUrl: string
): Promise<{ updated: number; failed: number; errors: string[] }> {
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  
  // Get all products with external image URLs
  const { data: products, error: fetchError } = await supabase
    .from('products_cache')
    .select('id, name, image_url, merchant_id')
    .eq('is_active', true)
    .not('image_url', 'is', null)
    .not('image_url', 'like', `${storageBaseUrl}%`)
    .order('merchant_id');

  if (fetchError) {
    console.error('[batch-download-all] Fetch error:', fetchError);
    throw new Error(`Failed to fetch products: ${fetchError.message}`);
  }

  if (!products || products.length === 0) {
    console.log('[batch-download-all] No products with external images found');
    return { updated: 0, failed: 0, errors: [] };
  }

  console.log(`[batch-download-all] Starting background processing of ${products.length} products`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const originalUrl = product.image_url;
    
    try {
      // Get high-res version of the URL
      const highResUrl = getHighResImageUrl(originalUrl, product.merchant_id);
      
      console.log(`[batch-download-all] [${i + 1}/${products.length}] Processing: ${product.name} (${product.merchant_id})`);
      
      // Download image
      const imageResponse = await fetch(highResUrl, {
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': highResUrl.split('/').slice(0, 3).join('/'),
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
      const fileName = `${product.merchant_id}/${product.id}.${extension}`;
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

      updated++;
      console.log(`[batch-download-all] ✅ [${i + 1}/${products.length}] Success: ${product.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[batch-download-all] ❌ [${i + 1}/${products.length}] Failed: ${product.name} - ${errorMessage}`);
      errors.push(`${product.merchant_id}/${product.name}: ${errorMessage}`);
      failed++;
    }

    // Rate limiting: 500ms delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[batch-download-all] Background processing completed. Updated: ${updated}, Failed: ${failed}`);
  return { updated, failed, errors };
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

    // Get storage base URL for comparison
    const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/product-images`;

    // Count products to process
    const { count: totalToProcess } = await supabase
      .from('products_cache')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .not('image_url', 'like', `${storageBaseUrl}%`);

    if (totalToProcess === 0 || totalToProcess === null) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No products with external images found',
          totalProducts: 0,
          estimatedTimeMinutes: 0,
          status: 'completed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Estimated time: 0.5s per image + processing
    const estimatedTimeMinutes = Math.ceil((totalToProcess * 0.8) / 60);

    console.log(`[batch-download-all] Starting batch download. Total: ${totalToProcess}, Estimated: ${estimatedTimeMinutes} min`);

    // Start background processing
    EdgeRuntime.waitUntil(
      processAllImages(supabase, storageBaseUrl)
        .then(result => {
          console.log(`[batch-download-all] Final result: ${result.updated} updated, ${result.failed} failed`);
        })
        .catch(error => {
          console.error(`[batch-download-all] Background task error:`, error);
        })
    );

    // Return immediate response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Batch download started in background',
        totalProducts: totalToProcess,
        estimatedTimeMinutes,
        status: 'processing',
        note: '백그라운드에서 처리 중입니다. 완료까지 약 ' + estimatedTimeMinutes + '분 소요 예상',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[batch-download-all] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
