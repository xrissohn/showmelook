import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

// Base64url encode for JWT (supports UTF-8)
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return base64Encode(bytes.buffer as ArrayBuffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT for Google OAuth
async function createJWT(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signInput}.${encodedSignature}`;
}

// Get Google Access Token from Service Account
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  const jwt = await createJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to get access token:', error);
    throw new Error('Google 인증에 실패했습니다.');
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch image and convert to base64
async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return { data: base64, mimeType: contentType };
}

// Generate image using Vertex AI
async function generateImageWithVertexAI(
  accessToken: string,
  projectId: string,
  region: string,
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {
  const endpoint = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/gemini-2.0-flash-exp:generateContent`;

  const parts: any[] = [{ text: prompt }];

  // If image URL is provided, fetch and include it
  if (imageUrl) {
    try {
      const { data, mimeType } = await imageUrlToBase64(imageUrl);
      parts.push({
        inlineData: {
          mimeType,
          data
        }
      });
    } catch (err) {
      console.error('Error fetching reference image:', err);
    }
  }

  const requestBody = {
    contents: [{
      role: 'user',
      parts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    }
  };

  console.log('Calling Vertex AI endpoint:', endpoint);
  console.log('Request body:', JSON.stringify({ ...requestBody, contents: [{ ...requestBody.contents[0], parts: parts.map(p => p.text ? { text: p.text.substring(0, 100) + '...' } : { inlineData: 'image' }) }] }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vertex AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 403) {
      throw new Error('Vertex AI 접근 권한이 없습니다. Service Account 권한을 확인해주세요.');
    }
    
    throw new Error(`Vertex AI 오류: ${response.status}`);
  }

  const data = await response.json();
  console.log('Vertex AI response received');

  // Extract image and text from response
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    console.error('No candidates in response:', JSON.stringify(data));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  const parts_response = candidates[0]?.content?.parts || [];
  let imageBase64 = '';
  let text = '';

  for (const part of parts_response) {
    if (part.inlineData) {
      imageBase64 = part.inlineData.data;
    }
    if (part.text) {
      text = part.text;
    }
  }

  if (!imageBase64) {
    console.error('No image in response parts:', JSON.stringify(parts_response));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  return { imageBase64, text };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, products, userProfile, useFaceComposite, userAvatarUrl, styleTrendId, productIds } = await req.json();
    
    // Get Google Cloud credentials
    const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const GOOGLE_CLOUD_PROJECT_ID = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
    const GOOGLE_CLOUD_REGION = Deno.env.get('GOOGLE_CLOUD_REGION') || 'asia-northeast3';
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
    }

    if (!GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
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

    // Create user client to get user info
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '');
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: '사용자 인증에 실패했습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('User authenticated:', userId);

    // Check daily generation limit
    const today = new Date().toISOString().split('T')[0];
    
    // Get user subscription (or create default free subscription)
    let { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!subscription) {
      const { data: newSub, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({ user_id: userId, plan: 'free', daily_limit: 5 })
        .select()
        .single();
      
      if (subError) {
        console.error('Error creating subscription:', subError);
      }
      subscription = newSub || { plan: 'free', daily_limit: 5 };
    }

    const isPremium = subscription?.plan === 'premium';
    const dailyLimit = isPremium ? Infinity : (subscription?.daily_limit || 5);

    // Get or create today's usage
    let { data: usage } = await supabaseAdmin
      .from('daily_generation_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (!usage) {
      const { data: newUsage, error: usageError } = await supabaseAdmin
        .from('daily_generation_usage')
        .insert({ user_id: userId, usage_date: today, generation_count: 0 })
        .select()
        .single();
      
      if (usageError) {
        console.error('Error creating usage record:', usageError);
      }
      usage = newUsage || { generation_count: 0 };
    }

    const currentCount = usage?.generation_count || 0;

    // Check if limit exceeded (only for non-premium)
    if (!isPremium && currentCount >= dailyLimit) {
      console.log(`Daily limit exceeded for user ${userId}: ${currentCount}/${dailyLimit}`);
      return new Response(
        JSON.stringify({ 
          error: '일일 생성 횟수를 초과했습니다.',
          limitExceeded: true,
          currentCount,
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
    console.log('Getting Google Access Token...');
    const accessToken = await getGoogleAccessToken(GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log('Access token obtained');

    // Call Vertex AI for image generation
    let result;
    try {
      result = await generateImageWithVertexAI(
        accessToken,
        GOOGLE_CLOUD_PROJECT_ID,
        GOOGLE_CLOUD_REGION,
        prompt,
        referenceImageUrl
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMIT') {
        return new Response(
          JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
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
