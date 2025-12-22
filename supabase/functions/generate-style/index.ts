import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate cache key from style + products combination
function generateCacheKey(styleTrendId: string | null, productIds: string[]): string {
  const sortedProducts = [...productIds].sort();
  const key = `${styleTrendId || 'none'}_${sortedProducts.join('_')}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `style_${Math.abs(hash).toString(36)}`;
}

// Convert base64 to Uint8Array for storage upload
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Base64URL encode for JWT
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// UTF-8 string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Generate JWT for Google Service Account
async function generateJWT(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  };
  
  const headerB64 = base64UrlEncode(stringToUint8Array(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(stringToUint8Array(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Parse PEM private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const dataToSign = new Uint8Array(stringToUint8Array(unsignedToken));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    dataToSign.buffer as ArrayBuffer
  );
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  
  return `${unsignedToken}.${signatureB64}`;
}

// Get Google Access Token using JWT
async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await generateJWT(serviceAccount);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', response.status, errorText);
    throw new Error(`토큰 교환 실패: ${response.status}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// Download image and convert to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`이미지 다운로드 실패: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Generate image using Vertex AI (gemini-2.5-flash-image in us-west1)
// TODO: Remove TEST_FALLBACK after testing
const TEST_FALLBACK = true; // Set to true to force Lovable AI fallback for testing

async function generateImageWithVertexAI(
  accessToken: string,
  projectId: string,
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {
  // Force fallback for testing
  if (TEST_FALLBACK) {
    console.log('TEST MODE: Forcing Vertex AI failure to test fallback');
    throw new Error('TEST_FORCED_FAILURE');
  }

  const region = 'us-west1';
  const modelId = 'gemini-2.5-flash-image';
  const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:generateContent`;

  // Build content parts
  const parts: any[] = [{ text: prompt }];
  
  if (imageUrl) {
    console.log('Downloading reference image for face composite...');
    const imageBase64 = await imageUrlToBase64(imageUrl);
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }

  const requestBody = {
    contents: [{
      role: 'user',
      parts
    }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT']
    }
  };

  console.log('Calling Vertex AI:', endpoint);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vertex AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 404) {
      throw new Error(`Vertex AI 모델을 찾을 수 없습니다: ${modelId} in ${region}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Vertex AI 인증 실패');
    }
    
    throw new Error(`Vertex AI 오류: ${response.status}`);
  }

  const data = await response.json();
  console.log('Vertex AI response received');

  // Parse Vertex AI response
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    console.error('No candidates in response:', JSON.stringify(data));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  const content = candidates[0].content;
  if (!content || !content.parts) {
    console.error('No content parts in response:', JSON.stringify(candidates[0]));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  let imageBase64Result: string | null = null;
  let textResult: string | undefined;

  for (const part of content.parts) {
    if (part.inlineData && part.inlineData.data) {
      imageBase64Result = part.inlineData.data;
    }
    if (part.text) {
      textResult = part.text;
    }
  }

  if (!imageBase64Result) {
    console.error('No image data in response parts:', JSON.stringify(content.parts));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  return { imageBase64: imageBase64Result, text: textResult };
}

// Generate image using Lovable AI (fallback)
async function generateImageWithLovableAI(
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  console.log('Calling Lovable AI (fallback)...');

  // Modify prompt for better face compositing with Lovable AI
  let modifiedPrompt = prompt;
  if (prompt.includes("Take this person's face") && imageUrl) {
    // Use a more compatible prompt for Lovable AI face compositing
    const styleMatch = prompt.match(/wearing (.+?) style outfit/);
    const outfitMatch = prompt.match(/The outfit includes: (.+?)\./);
    const bodyMatch = prompt.match(/has (.+?) body type/);
    const heightMatch = prompt.match(/approximately (\d+)cm/);
    
    const style = styleMatch?.[1] || 'modern';
    const outfit = outfitMatch?.[1] || 'modern casual wear';
    const bodyType = bodyMatch?.[1] || 'average';
    const height = heightMatch?.[1] || '170';
    
    modifiedPrompt = `Based on this reference photo of a person, create a professional fashion lookbook image.
Generate the SAME PERSON from the reference photo wearing a ${style} style outfit.
Outfit details: ${outfit}.
Body type: ${bodyType}, height: approximately ${height}cm.
IMPORTANT: The generated image MUST feature the exact same person from the reference photo.
Style: Full body shot, clean white studio background, professional fashion photography, high fashion editorial, 4K quality.
Keep the person's facial features, skin tone, and overall appearance identical to the reference.`;
    
    console.log('Modified prompt for Lovable AI face composite');
  }

  // Build message content with image if available
  let content: any;
  if (imageUrl) {
    content = [
      { type: 'text', text: modifiedPrompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];
    console.log('Including reference image for face composite');
  } else {
    content = modifiedPrompt;
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text']
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('LOVABLE_RATE_LIMIT');
    }
    if (response.status === 402) {
      throw new Error('LOVABLE_PAYMENT_REQUIRED');
    }
    
    throw new Error(`Lovable AI 오류: ${response.status}`);
  }

  const data = await response.json();
  console.log('Lovable AI response received');

  // Extract image from response
  const images = data.choices?.[0]?.message?.images;
  if (!images || images.length === 0) {
    console.error('No images in Lovable AI response:', JSON.stringify(data));
    throw new Error('Lovable AI 이미지 생성 실패');
  }

  const imageDataUrl = images[0]?.image_url?.url;
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
    console.error('Invalid image data URL:', imageDataUrl?.substring(0, 100));
    throw new Error('Lovable AI 이미지 형식 오류');
  }

  // Extract base64 from data URL (format: data:image/png;base64,...)
  const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Lovable AI base64 추출 실패');
  }

  const textContent = data.choices?.[0]?.message?.content;
  
  return { imageBase64: base64Match[1], text: textContent };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, products, userProfile, useFaceComposite, userAvatarUrl, styleTrendId, productIds } = await req.json();
    
    const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const GOOGLE_CLOUD_PROJECT_ID = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('Google Cloud configuration is missing');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    // Parse service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('Failed to parse service account JSON:', e);
      throw new Error('서비스 계정 JSON 파싱 실패');
    }

    // Create Supabase client with service role for cache management
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to verify authentication
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '인증이 유효하지 않습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('User authenticated:', userId);

    // Check daily generation limit
    const today = new Date().toISOString().split('T')[0];
    
    // Get user subscription
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    const dailyLimit = subscription?.daily_limit || 3;
    const isPremium = subscription?.plan === 'premium';

    // Get or create today's usage record
    let { data: usageRecord } = await supabaseAdmin
      .from('daily_generation_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (!usageRecord) {
      // Create new usage record for today
      const { data: newRecord, error: insertError } = await supabaseAdmin
        .from('daily_generation_usage')
        .insert({ user_id: userId, usage_date: today, generation_count: 0 })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating usage record:', insertError);
      }
      usageRecord = newRecord;
    }

    const currentCount = usageRecord?.generation_count || 0;

    // Check if user has exceeded daily limit (skip for premium users)
    if (!isPremium && currentCount >= dailyLimit) {
      return new Response(
        JSON.stringify({ 
          error: `일일 생성 한도(${dailyLimit}회)에 도달했습니다. 내일 다시 시도해주세요.`,
          remainingCount: 0,
          dailyLimit,
          isPremium: false
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate cache key (only for non-face-composite requests)
    const shouldUseCache = !useFaceComposite || !userAvatarUrl;
    const cacheKey = shouldUseCache ? generateCacheKey(styleTrendId || null, productIds || []) : null;

    // Check cache first (only if not using face composite)
    if (cacheKey) {
      const { data: cachedImage } = await supabaseAdmin
        .from('style_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (cachedImage) {
        console.log(`Cache hit for key: ${cacheKey}`);
        
        // Update cache usage
        await supabaseAdmin
          .from('style_cache')
          .update({ 
            use_count: (cachedImage.use_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', cachedImage.id);

        // Increment usage count
        await supabaseAdmin
          .from('daily_generation_usage')
          .update({ generation_count: currentCount + 1 })
          .eq('user_id', userId)
          .eq('usage_date', today);

        return new Response(
          JSON.stringify({ 
            imageUrl: cachedImage.image_url,
            message: '캐시된 스타일을 불러왔습니다!',
            cached: true,
            remainingCount: isPremium ? -1 : (dailyLimit - currentCount - 1),
            isPremium
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Cache miss for key: ${cacheKey}`);
    }

    // Build the prompt based on user profile and selected items
    const height = userProfile?.height || 170;
    const bodyType = userProfile?.body_type || 'average';
    const stylePreferences = userProfile?.style_preferences?.join(', ') || '';

    let prompt: string;
    let referenceImageUrl: string | undefined;

    if (useFaceComposite && userAvatarUrl) {
      referenceImageUrl = userAvatarUrl;
      prompt = `Take this person's face and create a professional fashion lookbook photo of them wearing ${style} style outfit.
The outfit includes: ${products || 'modern casual wear'}.
The person has ${bodyType} body type, approximately ${height}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Create a full body shot with this exact person's face, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.
Keep the person's face exactly as shown in the reference photo while generating the fashionable outfit on their body.`;

      console.log('Generating face composite image');
    } else {
      prompt = `Create a professional fashion lookbook photo of a stylish Korean person wearing ${style} style outfit. 
The outfit includes: ${products || 'modern casual wear'}.
The person has ${bodyType} body type, approximately ${height}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Full body shot, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.`;

      console.log('Generating standard image');
    }

    console.log('Prompt:', prompt.substring(0, 200) + '...');

    // Get Google Access Token
    console.log('Getting Google access token...');
    const accessToken = await getGoogleAccessToken(serviceAccount);
    console.log('Access token obtained');

    // Call Vertex AI for image generation with Lovable AI fallback
    let result;
    let usedFallback = false;
    
    try {
      result = await generateImageWithVertexAI(
        accessToken,
        GOOGLE_CLOUD_PROJECT_ID,
        prompt,
        referenceImageUrl
      );
      console.log('Image generated with Vertex AI');
    } catch (vertexError) {
      // RATE_LIMIT은 폴백하지 않고 그대로 반환
      if (vertexError instanceof Error && vertexError.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Vertex AI 실패 시 Lovable AI로 폴백
      console.warn('Vertex AI failed, falling back to Lovable AI:', vertexError instanceof Error ? vertexError.message : vertexError);
      
      try {
        result = await generateImageWithLovableAI(prompt, referenceImageUrl);
        usedFallback = true;
        console.log('Image generated with Lovable AI (fallback)');
      } catch (lovableError) {
        console.error('Lovable AI fallback also failed:', lovableError);
        
        // Lovable AI 특수 에러 처리
        if (lovableError instanceof Error) {
          if (lovableError.message === 'LOVABLE_RATE_LIMIT') {
            return new Response(
              JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (lovableError.message === 'LOVABLE_PAYMENT_REQUIRED') {
            return new Response(
              JSON.stringify({ error: '서비스 이용이 일시 중단되었습니다. 관리자에게 문의해주세요.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        throw new Error('이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }

    const { imageBase64, text } = result;

    // Upload image to Supabase Storage
    let finalImageUrl = '';
    
    try {
      const imageBytes = base64ToUint8Array(imageBase64);
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('generated-looks')
        .upload(fileName, imageBytes, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error('이미지 저장에 실패했습니다.');
      }
      
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('generated-looks')
        .getPublicUrl(fileName);
      finalImageUrl = publicUrl;
      console.log('Image uploaded to storage:', finalImageUrl);
    } catch (uploadErr) {
      console.error('Error processing image upload:', uploadErr);
      throw uploadErr;
    }

    // Save to cache (only for non-face-composite)
    if (cacheKey && finalImageUrl) {
      const { error: cacheError } = await supabaseAdmin
        .from('style_cache')
        .insert({
          cache_key: cacheKey,
          style_trend_id: styleTrendId || null,
          product_ids: productIds || [],
          image_url: finalImageUrl,
          use_count: 1
        });

      if (cacheError) {
        console.error('Error saving to cache:', cacheError);
      } else {
        console.log('Image cached with key:', cacheKey);
      }
    }

    // Increment usage count
    await supabaseAdmin
      .from('daily_generation_usage')
      .update({ generation_count: currentCount + 1 })
      .eq('user_id', userId)
      .eq('usage_date', today);

    console.log(`Usage updated for user ${userId}: ${currentCount + 1}`);

    return new Response(
      JSON.stringify({ 
        imageUrl: finalImageUrl,
        message: text || '스타일이 생성되었습니다!',
        faceComposite: useFaceComposite && userAvatarUrl ? true : false,
        cached: false,
        remainingCount: isPremium ? -1 : (dailyLimit - currentCount - 1),
        isPremium
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-style function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '스타일 생성 중 오류가 발생했습니다.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
