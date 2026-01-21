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
    console.log('[generate-style] Avatar URL:', userAvatarUrl ? userAvatarUrl.substring(0, 80) + '...' : 'none');

    // Build the image generation prompt
    // Handle both Korean and English gender values
    const genderValue = userProfile?.gender?.toLowerCase() || '';
    const isFemale = genderValue === 'female' || genderValue === '여성' || genderValue === '여';
    const gender = isFemale ? '여성' : '남성';
    const height = userProfile?.height || 170;
    const bodyType = userProfile?.body_type || 'average';
    const fullName = userProfile?.full_name || '';
    const ageGroup = userProfile?.age_group || '';
    
    console.log('[generate-style] Profile gender:', userProfile?.gender, '-> Resolved:', gender);
    console.log('[generate-style] Profile name:', fullName);
    console.log('[generate-style] Age group:', ageGroup);

    // 연령대에 따른 모델 타입 결정
    const getModelDescription = (ageGroup: string, gender: string): string => {
      const ageGroupLower = ageGroup.toLowerCase();
      if (ageGroupLower.includes('infant') || ageGroupLower.includes('영아') || ageGroupLower.includes('baby')) {
        return gender === '여성' ? 'adorable Korean baby girl' : 'adorable Korean baby boy';
      }
      if (ageGroupLower.includes('toddler') || ageGroupLower.includes('유아')) {
        return gender === '여성' ? 'cute Korean toddler girl (2-4 years old)' : 'cute Korean toddler boy (2-4 years old)';
      }
      if (ageGroupLower.includes('child') || ageGroupLower.includes('아동') || ageGroupLower.includes('kids')) {
        return gender === '여성' ? 'stylish Korean girl (5-12 years old)' : 'stylish Korean boy (5-12 years old)';
      }
      if (ageGroupLower.includes('teen') || ageGroupLower.includes('청소년')) {
        return gender === '여성' ? 'trendy Korean teenage girl' : 'trendy Korean teenage boy';
      }
      // 성인 기본값
      return gender === '여성' ? 'stylish Korean woman' : 'stylish Korean man';
    };

    const modelDescription = getModelDescription(ageGroup, gender);
    const isChildProfile = ageGroup.toLowerCase().includes('infant') || 
                          ageGroup.toLowerCase().includes('영아') ||
                          ageGroup.toLowerCase().includes('toddler') ||
                          ageGroup.toLowerCase().includes('유아') ||
                          ageGroup.toLowerCase().includes('child') ||
                          ageGroup.toLowerCase().includes('아동');

    let prompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;

    // 얼굴 합성 프롬프트 추가 (아기/어린이 프로필용 특별 처리)
    if (useFaceComposite && userAvatarUrl) {
      if (isChildProfile) {
        // 아기/어린이 프로필: 참조 이미지의 느낌만 반영
        prompt = `Fashion photography of a ${modelDescription} with a similar look and feel to the reference photo provided.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: The child model should have a similar cute and adorable appearance inspired by the reference photo. Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Professional studio lighting, clean white background, high fashion editorial style for kids, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      } else {
        // 성인 프로필: 얼굴 합성
        prompt = `CRITICAL INSTRUCTION: You MUST use the face from the reference photo I'm providing. Create a fashion image where the model has EXACTLY the same face as the person in the reference photo.

Fashion photography of a ${modelDescription}${fullName ? ` (${fullName})` : ''}${height ? `, ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: The model's face MUST match the reference photo exactly - same facial features, expression style, and appearance. Blend the face naturally with the outfit while maintaining the person's identity from the reference photo.

CRITICAL: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      }
    }

    console.log('[generate-style] Prompt length:', prompt.length);
    console.log('[generate-style] Is child profile:', isChildProfile);

    // Prepare messages for Nano Banana (Gemini image generation)
    const messages: any[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    // If face composite is enabled, include the avatar image
    if (useFaceComposite && userAvatarUrl) {
      let avatarDataUrl = userAvatarUrl;
      
      // If it's a Supabase storage URL, fetch and convert to base64
      // (avatars bucket is private, so Gemini can't access it directly)
      if (userAvatarUrl.includes('supabase.co/storage')) {
        try {
          console.log('[generate-style] Fetching avatar from storage...');
          const avatarResponse = await fetch(userAvatarUrl);
          if (avatarResponse.ok) {
            const avatarBuffer = await avatarResponse.arrayBuffer();
            const base64Avatar = btoa(
              new Uint8Array(avatarBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            const contentType = avatarResponse.headers.get('content-type') || 'image/png';
            avatarDataUrl = `data:${contentType};base64,${base64Avatar}`;
            console.log('[generate-style] Avatar converted to base64, length:', avatarDataUrl.length);
          } else {
            console.error('[generate-style] Failed to fetch avatar:', avatarResponse.status);
          }
        } catch (fetchError) {
          console.error('[generate-style] Error fetching avatar:', fetchError);
        }
      }
      
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
              url: avatarDataUrl
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
    let generatedImage = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // 이미지 생성 실패 시 얼굴 합성 없이 재시도
    if (!generatedImage && useFaceComposite && userAvatarUrl) {
      console.log('[generate-style] No image with face composite, retrying without...');
      
      // 기본 프롬프트로 재시도
      const fallbackPrompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      
      const fallbackResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [{ role: 'user', content: fallbackPrompt }],
          modalities: ['image', 'text']
        }),
      });
      
      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        generatedImage = fallbackResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        console.log('[generate-style] Fallback result:', generatedImage ? 'success' : 'failed');
      }
    }
    
    if (!generatedImage) {
      console.error('[generate-style] No image in response:', JSON.stringify(aiResult).slice(0, 500));
      throw new Error('No image generated from AI');
    }

    console.log('[generate-style] Image generated, length:', generatedImage.length);

    // Upload to Supabase Storage
    const imageData = generatedImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    
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
