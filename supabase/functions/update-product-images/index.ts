import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageMapping {
  productId: string;
  imageUrl: string;
}

interface UpdateRequest {
  mappings: ImageMapping[];
}

interface ProcessResult {
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

    const { mappings }: UpdateRequest = await req.json();

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'mappings array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-product-images] Processing ${mappings.length} image mappings`);

    const results: ProcessResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const mapping of mappings) {
      const { productId, imageUrl } = mapping;

      if (!productId || !imageUrl) {
        results.push({
          productId: productId || 'unknown',
          productName: 'unknown',
          originalUrl: imageUrl || '',
          success: false,
          error: 'productId and imageUrl are required'
        });
        failedCount++;
        continue;
      }

      try {
        // 1. Get product info
        const { data: product, error: productError } = await supabase
          .from('products_cache')
          .select('id, merchant_id, name')
          .eq('id', productId)
          .single();

        if (productError || !product) {
          results.push({
            productId,
            productName: 'unknown',
            originalUrl: imageUrl,
            success: false,
            error: 'Product not found'
          });
          failedCount++;
          continue;
        }

        const merchantId = product.merchant_id || 'unknown';
        console.log(`[update-product-images] Processing: ${product.name} (${merchantId})`);

        // 2. Download image from external URL
        let imageResponse: Response;
        try {
          imageResponse = await fetch(imageUrl, {
            headers: {
              'Accept': 'image/*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': imageUrl.split('/').slice(0, 3).join('/'),
            },
          });
        } catch (fetchError: unknown) {
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
          results.push({
            productId,
            productName: product.name,
            originalUrl: imageUrl,
            success: false,
            error: `Fetch failed: ${errorMessage}`
          });
          failedCount++;
          continue;
        }

        if (!imageResponse.ok) {
          results.push({
            productId,
            productName: product.name,
            originalUrl: imageUrl,
            success: false,
            error: `HTTP ${imageResponse.status}`
          });
          failedCount++;
          continue;
        }

        // 3. Get content type and determine extension
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        let extension = 'jpg';
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('avif')) extension = 'avif';
        else if (contentType.includes('gif')) extension = 'gif';

        // 4. Get image as ArrayBuffer
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageUint8 = new Uint8Array(imageBuffer);

        // Check file size (max 5MB)
        if (imageUint8.length > 5 * 1024 * 1024) {
          results.push({
            productId,
            productName: product.name,
            originalUrl: imageUrl,
            success: false,
            error: 'Image exceeds 5MB limit'
          });
          failedCount++;
          continue;
        }

        // 5. Generate file path and upload
        const fileName = `${merchantId}/${productId}.${extension}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageUint8, {
            contentType: contentType,
            upsert: true,
          });

        if (uploadError) {
          results.push({
            productId,
            productName: product.name,
            originalUrl: imageUrl,
            success: false,
            error: `Upload failed: ${uploadError.message}`
          });
          failedCount++;
          continue;
        }

        // 6. Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        const storageUrl = publicUrlData.publicUrl;

        // 7. Update product with new image URL
        const { error: updateError } = await supabase
          .from('products_cache')
          .update({ 
            image_url: storageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId);

        if (updateError) {
          results.push({
            productId,
            productName: product.name,
            originalUrl: imageUrl,
            storageUrl,
            success: false,
            error: `DB update failed: ${updateError.message}`
          });
          failedCount++;
          continue;
        }

        results.push({
          productId,
          productName: product.name,
          originalUrl: imageUrl,
          storageUrl,
          success: true
        });
        successCount++;

        console.log(`[update-product-images] ✓ Saved: ${product.name}`);

        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          productId,
          productName: 'unknown',
          originalUrl: imageUrl,
          success: false,
          error: errorMessage
        });
        failedCount++;
      }
    }

    console.log(`[update-product-images] Complete: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: mappings.length,
        updated: successCount,
        failed: failedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[update-product-images] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
