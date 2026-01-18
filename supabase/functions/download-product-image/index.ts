import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadRequest {
  productId: string;
  imageUrl: string;
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

    const { productId, imageUrl }: DownloadRequest = await req.json();

    if (!productId || !imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'productId and imageUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[download-product-image] Starting download for product ${productId}`);
    console.log(`[download-product-image] Image URL: ${imageUrl}`);

    // 1. Get product info to determine merchant
    const { data: product, error: productError } = await supabase
      .from('products_cache')
      .select('id, merchant_id, name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('[download-product-image] Product not found:', productError);
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const merchantId = product.merchant_id || 'unknown';
    console.log(`[download-product-image] Merchant: ${merchantId}`);

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
      console.error('[download-product-image] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch image: ${errorMessage}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageResponse.ok) {
      console.error(`[download-product-image] Image fetch failed: ${imageResponse.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Image fetch failed with status ${imageResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get content type and determine extension
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    console.log(`[download-product-image] Content-Type: ${contentType}`);

    let extension = 'jpg';
    if (contentType.includes('png')) {
      extension = 'png';
    } else if (contentType.includes('webp')) {
      extension = 'webp';
    } else if (contentType.includes('avif')) {
      extension = 'avif';
    } else if (contentType.includes('gif')) {
      extension = 'gif';
    }

    // 4. Get image as ArrayBuffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageUint8 = new Uint8Array(imageBuffer);

    console.log(`[download-product-image] Image size: ${imageUint8.length} bytes`);

    // Check file size (max 5MB)
    if (imageUint8.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image exceeds 5MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Generate file path
    const fileName = `${merchantId}/${productId}.${extension}`;
    console.log(`[download-product-image] Uploading to: ${fileName}`);

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageUint8, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[download-product-image] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const storageUrl = publicUrlData.publicUrl;
    console.log(`[download-product-image] Storage URL: ${storageUrl}`);

    // 8. Update product with new image URL
    const { error: updateError } = await supabase
      .from('products_cache')
      .update({ 
        image_url: storageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);

    if (updateError) {
      console.error('[download-product-image] DB update error:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `DB update failed: ${updateError.message}`,
          storageUrl // Return storage URL even if DB update fails
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[download-product-image] Successfully saved image for product ${productId}`);

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        merchantId,
        storageUrl,
        originalUrl: imageUrl,
        fileSize: imageUint8.length,
        contentType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[download-product-image] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
