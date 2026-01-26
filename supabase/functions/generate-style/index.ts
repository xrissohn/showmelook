// generate-style v2.1 - with error logging and retry logic
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exponential backoff retry helper
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Rate limit (429) - wait and retry
      if (response.status === 429 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[generate-style] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[generate-style] Network error, waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  
  throw lastError || new Error('All retries failed');
}

// Error logging helper
async function logError(
  supabase: any,
  functionName: string,
  errorCode: string,
  errorMessage: string,
  userId: string | null,
  requestPayload: any,
  executionTimeMs: number
) {
  try {
    await supabase.from('error_logs').insert({
      function_name: functionName,
      error_code: errorCode,
      error_message: errorMessage,
      user_id: userId,
      request_payload: requestPayload,
      execution_time_ms: executionTimeMs,
    });
    console.log(`[generate-style] Error logged: ${errorCode} - ${errorMessage.slice(0, 100)}`);
  } catch (logError) {
    console.error('[generate-style] Failed to log error:', logError);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let userId: string | null = null;
  let requestPayload: any = null;

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

    // Extract user ID from token
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    } catch (e) {
      console.log('[generate-style] Could not extract user from token');
    }

    requestPayload = await req.json();
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
    } = requestPayload;

    console.log('[generate-style] Starting generation');
    console.log('[generate-style] Style:', style);
    console.log('[generate-style] Products:', products);
    console.log('[generate-style] Product details count:', productDetails?.length || 0);
    console.log('[generate-style] Product images count:', productImageUrls?.length || 0);
    console.log('[generate-style] Face composite:', useFaceComposite);
    console.log('[generate-style] Avatar URL:', userAvatarUrl ? userAvatarUrl.substring(0, 80) + '...' : 'none');

    // Build products description with color constraints from productDetails
    const buildProductsWithColors = (productDetails: any[], fallbackProducts: string): string => {
      if (!productDetails || productDetails.length === 0) {
        return fallbackProducts;
      }
      
      return productDetails.map((p: any) => {
        const brandPart = p.brand ? `${p.brand} ` : '';
        const name = p.name || 'Item';
        
        // Extract color_family from dna_meta or direct color field
        let colors: string[] = [];
        if (p.dna_meta?.color_family) {
          colors = Array.isArray(p.dna_meta.color_family) 
            ? p.dna_meta.color_family 
            : [p.dna_meta.color_family];
        } else if (p.color_family) {
          colors = Array.isArray(p.color_family) ? p.color_family : [p.color_family];
        } else if (p.color) {
          // Parse color string if available
          const colorStr = String(p.color).toLowerCase();
          if (colorStr.includes('white')) colors.push('white');
          if (colorStr.includes('black')) colors.push('black');
          if (colorStr.includes('navy')) colors.push('navy');
          if (colorStr.includes('blue')) colors.push('blue');
          if (colorStr.includes('gray') || colorStr.includes('grey')) colors.push('gray');
          if (colorStr.includes('beige')) colors.push('beige');
          if (colorStr.includes('brown')) colors.push('brown');
          if (colorStr.includes('cream')) colors.push('cream');
          if (colorStr.includes('red')) colors.push('red');
          if (colorStr.includes('pink')) colors.push('pink');
          if (colorStr.includes('green')) colors.push('green');
          if (colorStr.includes('yellow')) colors.push('yellow');
          if (colorStr.includes('orange')) colors.push('orange');
          if (colorStr.includes('purple')) colors.push('purple');
        }
        
        // Remove 'unknown' from colors
        colors = colors.filter(c => c && c !== 'unknown');
        
        if (colors.length > 0) {
          const colorList = colors.join(' or ');
          return `${brandPart}${name} (MUST be ${colorList} color ONLY)`;
        }
        
        return `${brandPart}${name}`;
      }).join(', ');
    };

    const productsWithColors = buildProductsWithColors(productDetails, products);
    console.log('[generate-style] Products with colors:', productsWithColors);

    // Build the image generation prompt
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

    // age_group을 분석하여 나이 범위 결정
    const parseAgeGroup = (ageGroup: string): { minAge: number; maxAge: number; category: string } => {
      if (!ageGroup) return { minAge: 20, maxAge: 40, category: 'adult' };
      
      const ag = ageGroup.toLowerCase();
      
      if (ag.includes('infant') || ag.includes('영아') || ag.includes('baby') || ag.includes('0-12') || ag.includes('개월')) {
        return { minAge: 0, maxAge: 1, category: 'infant' };
      }
      if (ag.includes('toddler') || ag.includes('유아') || ag.includes('1-3') || ag.includes('2세') || ag.includes('3세')) {
        return { minAge: 1, maxAge: 3, category: 'toddler' };
      }
      if (ag.includes('preschool') || ag.includes('4-6') || ag.includes('4세') || ag.includes('5세') || ag.includes('6세')) {
        return { minAge: 4, maxAge: 6, category: 'preschool' };
      }
      if (ag.includes('child') || ag.includes('아동') || ag.includes('kids') || ag.includes('초등') || ag.includes('7-12') || ag.match(/[789]세|10세|11세|12세/)) {
        return { minAge: 7, maxAge: 12, category: 'child' };
      }
      if (ag.includes('teen') || ag.includes('청소년') || ag.includes('13-18') || ag.match(/1[345678]세/)) {
        return { minAge: 13, maxAge: 18, category: 'teen' };
      }
      return { minAge: 20, maxAge: 40, category: 'adult' };
    };

    const ageInfo = parseAgeGroup(ageGroup);
    console.log('[generate-style] Parsed age info:', ageInfo);

    const getModelDescription = (ageInfo: { minAge: number; maxAge: number; category: string }, gender: string): string => {
      const genderKo = gender === '여성' ? '여자' : '남자';
      
      switch (ageInfo.category) {
        case 'infant':
          return `adorable Korean baby ${gender === '여성' ? 'girl' : 'boy'} (under 1 year old, ${ageInfo.minAge}-${ageInfo.maxAge} months old baby). The baby should have chubby cheeks, round face, and look like an actual infant`;
        case 'toddler':
          return `cute Korean toddler ${gender === '여성' ? 'girl' : 'boy'} (${ageInfo.minAge}-${ageInfo.maxAge} years old). The child should be very small, have round baby face, short limbs, and look like an actual toddler`;
        case 'preschool':
          return `adorable Korean ${gender === '여성' ? 'girl' : 'boy'} child (${ageInfo.minAge}-${ageInfo.maxAge} years old, preschool age). The child should have childish proportions, small body, and innocent look`;
        case 'child':
          return `stylish Korean ${gender === '여성' ? 'girl' : 'boy'} child (${ageInfo.minAge}-${ageInfo.maxAge} years old, elementary school age). The child should look like an actual ${ageInfo.minAge}-${ageInfo.maxAge} year old kid`;
        case 'teen':
          return `trendy Korean teenage ${gender === '여성' ? 'girl' : 'boy'} (${ageInfo.minAge}-${ageInfo.maxAge} years old). The teenager should have youthful appearance appropriate for their age`;
        default:
          return gender === '여성' ? 'stylish Korean woman in her 20s-30s' : 'stylish Korean man in his 20s-30s';
      }
    };

    const modelDescription = getModelDescription(ageInfo, gender);
    const isChildProfile = ageInfo.category === 'infant' || 
                          ageInfo.category === 'toddler' ||
                          ageInfo.category === 'preschool' ||
                          ageInfo.category === 'child';

    const getBodyProportionHint = (category: string): string => {
      switch (category) {
        case 'infant':
          return 'CRITICAL: The baby must have infant body proportions - very short limbs, large head relative to body, no neck visible, chubby baby legs and arms.';
        case 'toddler':
          return 'CRITICAL: The toddler must have toddler body proportions - short legs, round tummy, large head, small hands, typical of a 2-3 year old child.';
        case 'preschool':
          return 'CRITICAL: The child must have young child body proportions - shorter legs relative to adults, rounder face, smaller hands, typical of a 4-6 year old.';
        case 'child':
          return 'CRITICAL: The child must look like an elementary school student with appropriate body proportions for their age.';
        case 'teen':
          return 'The teenager should have youthful proportions appropriate for adolescence.';
        default:
          return '';
      }
    };

    const bodyProportionHint = getBodyProportionHint(ageInfo.category);
    
    let prompt = `${ageInfo.category !== 'adult' ? `CRITICAL AGE REQUIREMENT: Generate a ${ageInfo.minAge}-${ageInfo.maxAge} year old ${gender === '여성' ? 'girl' : 'boy'}. DO NOT generate an adult or teenager if the age is under 13.\n\n` : ''}Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST be rendered in ONLY the specified colors. Do NOT change or substitute any colors. If an item says "(MUST be white or black color ONLY)", you MUST use white or black, not red, yellow, or any other color.

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;

    // 얼굴 합성 프롬프트 추가
    if (useFaceComposite && userAvatarUrl) {
      if (isChildProfile) {
        prompt = `CRITICAL AGE REQUIREMENT: Generate a ${ageInfo.minAge}-${ageInfo.maxAge} year old ${gender === '여성' ? 'girl' : 'boy'}. The model MUST look like a ${ageInfo.category === 'infant' ? 'baby under 1 year old' : ageInfo.category === 'toddler' ? 'toddler aged 2-3 years' : ageInfo.category === 'preschool' ? 'young child aged 4-6 years' : 'child aged 7-12 years'}.

Fashion photography of a ${modelDescription} with a similar look and feel to the reference photo provided.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST be rendered in ONLY the specified colors. Do NOT change or substitute any colors.

IMPORTANT: The child model should have a similar cute and adorable appearance inspired by the reference photo, but MUST maintain the correct age appearance (${ageInfo.minAge}-${ageInfo.maxAge} years old). Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Professional studio lighting, clean white background, high fashion editorial style for kids, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      } else {
        prompt = `CRITICAL INSTRUCTION: You MUST use the face from the reference photo I'm providing. Create a fashion image where the model has EXACTLY the same face as the person in the reference photo.

Fashion photography of a ${modelDescription}${fullName ? ` (${fullName})` : ''}${height ? `, ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST be rendered in ONLY the specified colors. Do NOT change or substitute any colors.

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
    let avatarFetchSuccess = false;
    if (useFaceComposite && userAvatarUrl) {
      let avatarDataUrl = userAvatarUrl;
      
      if (userAvatarUrl.includes('supabase.co/storage')) {
        try {
          console.log('[generate-style] Fetching avatar from storage...');
          
          // If it's a signed URL that might have expired, try to get a fresh signed URL
          // Extract the path from the URL
          const urlMatch = userAvatarUrl.match(/\/avatars\/([^?]+)/);
          if (urlMatch) {
            const avatarPath = urlMatch[1];
            console.log('[generate-style] Avatar path:', avatarPath);
            
            // Get a fresh signed URL using service role
            const { data: signedData, error: signedError } = await supabase
              .storage
              .from('avatars')
              .createSignedUrl(avatarPath, 300); // 5 minute validity
            
            if (signedData?.signedUrl) {
              console.log('[generate-style] Got fresh signed URL');
              const avatarResponse = await fetch(signedData.signedUrl);
              if (avatarResponse.ok) {
                const avatarBuffer = await avatarResponse.arrayBuffer();
                const base64Avatar = btoa(
                  new Uint8Array(avatarBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                const contentType = avatarResponse.headers.get('content-type') || 'image/png';
                avatarDataUrl = `data:${contentType};base64,${base64Avatar}`;
                console.log('[generate-style] Avatar converted to base64, length:', avatarDataUrl.length);
                avatarFetchSuccess = true;
              } else {
                console.error('[generate-style] Failed to fetch avatar with fresh URL:', avatarResponse.status);
              }
            } else {
              console.error('[generate-style] Failed to create signed URL:', signedError);
            }
          }
          
          // Fallback: try the original URL if fresh signed URL failed
          if (!avatarFetchSuccess) {
            console.log('[generate-style] Trying original avatar URL...');
            const avatarResponse = await fetch(userAvatarUrl);
            if (avatarResponse.ok) {
              const avatarBuffer = await avatarResponse.arrayBuffer();
              const base64Avatar = btoa(
                new Uint8Array(avatarBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              const contentType = avatarResponse.headers.get('content-type') || 'image/png';
              avatarDataUrl = `data:${contentType};base64,${base64Avatar}`;
              console.log('[generate-style] Avatar converted to base64 from original URL, length:', avatarDataUrl.length);
              avatarFetchSuccess = true;
            } else {
              console.error('[generate-style] Failed to fetch avatar with original URL:', avatarResponse.status);
            }
          }
        } catch (fetchError) {
          console.error('[generate-style] Error fetching avatar:', fetchError);
        }
      } else if (userAvatarUrl.startsWith('data:')) {
        // Already a data URL
        avatarDataUrl = userAvatarUrl;
        avatarFetchSuccess = true;
      }
      
      // Only include avatar in messages if we successfully fetched it
      if (avatarFetchSuccess) {
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
        console.log('[generate-style] Avatar included in request');
      } else {
        // If avatar fetch failed, proceed without face composite
        console.log('[generate-style] Avatar fetch failed, proceeding without face composite');
        // Revert to non-face-composite prompt
        prompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

${bodyProportionHint}

Style concept: ${style}

Wearing these items with EXACT colors specified:
${productsWithColors}

COLOR CRITICAL: Each item MUST be rendered in ONLY the specified colors. Do NOT change or substitute any colors.

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
        
        messages[0] = {
          role: 'user',
          content: prompt
        };
      }
    }

    // Call Lovable AI Gateway with retry logic
    console.log('[generate-style] Calling Lovable AI Gateway with retry...');
    const aiStartTime = Date.now();

    const response = await fetchWithRetry(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
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
      },
      3 // Max retries
    );

    const elapsed = Date.now() - aiStartTime;
    console.log(`[generate-style] AI response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-style] AI error:', errorText);
      
      // Log the error
      await logError(
        supabase,
        'generate-style',
        String(response.status),
        errorText.slice(0, 1000),
        userId,
        { style, useFaceComposite, hasAvatar: !!userAvatarUrl },
        Date.now() - startTime
      );
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again later.',
            errorCode: '429',
            retryAfter: 30
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required. Please add credits to your workspace.',
            errorCode: '402'
          }),
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
      
      const fallbackPrompt = `Fashion photography of a ${modelDescription}${!isChildProfile && height ? `, approximately ${height}cm tall` : ''}.

Style concept: ${style}

Wearing these items:
${products}

IMPORTANT: Generate a VERTICAL/PORTRAIT orientation image (taller than wide, aspect ratio 3:4 or 2:3). Full body fashion photoshoot, professional studio lighting, clean white background, high fashion editorial style, sharp focus, 8k quality, showcasing the complete outfit from head to toe.`;
      
      const fallbackResponse = await fetchWithRetry(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
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
        },
        2 // Fewer retries for fallback
      );
      
      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        generatedImage = fallbackResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        console.log('[generate-style] Fallback result:', generatedImage ? 'success' : 'failed');
      }
    }
    
    if (!generatedImage) {
      console.error('[generate-style] No image in response:', JSON.stringify(aiResult).slice(0, 500));
      
      // Log the error
      await logError(
        supabase,
        'generate-style',
        'NO_IMAGE',
        'AI returned no image data',
        userId,
        { style, useFaceComposite, aiResponseSnippet: JSON.stringify(aiResult).slice(0, 500) },
        Date.now() - startTime
      );
      
      throw new Error('No image generated from AI');
    }

    console.log('[generate-style] Image generated, length:', generatedImage.length);

    // Upload to Supabase Storage
    const imageData = generatedImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    
    // Use user folder structure for proper RLS enforcement
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('generated-looks')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('[generate-style] Upload error:', uploadError);
      
      // Log but don't fail - return base64 instead
      await logError(
        supabase,
        'generate-style',
        'UPLOAD_ERROR',
        uploadError.message,
        userId,
        { fileName },
        Date.now() - startTime
      );
      
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
      .getPublicUrl(fileName); // fileName now includes userId folder prefix

    const finalImageUrl = urlData?.publicUrl || generatedImage;
    const totalTime = Date.now() - startTime;
    console.log(`[generate-style] Final image URL: ${finalImageUrl.slice(0, 100)}`);
    console.log(`[generate-style] Total execution time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: finalImageUrl,
        storagePath: fileName,
        style: style,
        productIds: productIds,
        executionTime: totalTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-style] Error:', error);
    
    // Log the error
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      await logError(
        supabase,
        'generate-style',
        'EXCEPTION',
        error instanceof Error ? error.message : String(error),
        userId,
        requestPayload ? { style: requestPayload.style } : null,
        Date.now() - startTime
      );
    } catch (logErr) {
      console.error('[generate-style] Failed to log error:', logErr);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Generation failed',
        errorCode: 'EXCEPTION',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
