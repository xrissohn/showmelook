import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      style,
      products,
      productDetails,
      productImageUrls,
      userProfile,
      useFaceComposite,
      userAvatarUrl,
      styleTrendId,
      productIds
    } = await req.json();

    console.log('[generate-style] Starting generation');
    console.log('[generate-style] Style:', style);
    console.log('[generate-style] Products:', products);
    console.log('[generate-style] Product images count:', productImageUrls?.length || 0);
    console.log('[generate-style] Face composite:', useFaceComposite);

    // Build the image generation prompt
    const gender = userProfile?.gender === 'female' ? '여성' : '남성';
    const height = userProfile?.height || 170;
    const bodyType = userProfile?.body_type || 'average';

    let prompt = `Fashion photography of a stylish ${gender === '여성' ? 'Korean woman' : 'Korean man'}, ${height}cm tall, ${bodyType} build.

Style concept: ${style}

Wearing these items:
${products}

Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;

    // Add face composite instruction if enabled
    if (useFaceComposite && userAvatarUrl) {
      prompt += `\n\nIMPORTANT: The model's face should look natural and match the Korean aesthetic. Professional fashion model pose.`;
    }

    console.log('[generate-style] Prompt length:', prompt.length);

    // Prepare messages for Nano Banana (Gemini image generation)
    const messages: any[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    // If face composite is enabled, include the avatar image
    if (useFaceComposite && userAvatarUrl) {
      messages[0] = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: userAvatarUrl
            }
          }
        ]
      };
    }

    // Call Lovable AI Gateway with Nano Banana model
    console.log('[generate-style] Calling Lovable AI Gateway...');
    const startTime = Date.now();

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: messages,
        modalities: ['image', 'text']
      }),
    });

    const elapsed = Date.now() - startTime;
    console.log(`[generate-style] AI response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-style] AI error:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('[generate-style] AI result received');

    // Extract image from response
    const generatedImage = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!generatedImage) {
      console.error('[generate-style] No image in response:', JSON.stringify(aiResult).slice(0, 500));
      throw new Error('No image generated from AI');
    }

    console.log('[generate-style] Image generated, length:', generatedImage.length);

    // Upload to Supabase Storage
    const imageData = generatedImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    
    const fileName = `generated-looks/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('generated-looks')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('[generate-style] Upload error:', uploadError);
      // Fall back to returning base64 image
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: generatedImage,
          style: style,
          productIds: productIds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generated-looks')
      .getPublicUrl(fileName);

    const finalImageUrl = urlData?.publicUrl || generatedImage;
    console.log('[generate-style] Final image URL:', finalImageUrl.slice(0, 100));

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: finalImageUrl,
        storagePath: fileName,
        style: style,
        productIds: productIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-style] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Generation failed',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
