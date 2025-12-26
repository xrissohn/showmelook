import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// INPUT VALIDATION & SANITIZATION FUNCTIONS
// ===========================================

// Allowed characters for text inputs (alphanumeric, Korean, common punctuation, spaces)
const ALLOWED_TEXT_CHARS = /^[\p{L}\p{N}\s\-_.,!?&'":;()\/]+$/u;

// Prompt injection patterns to detect and block
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)/i,
  /disregard\s+(previous|all|above)/i,
  /forget\s+(previous|all|above)/i,
  /system\s*prompt/i,
  /you\s+are\s+(now|a)/i,
  /pretend\s+to\s+be/i,
  /act\s+as\s+(if|a)/i,
  /new\s+instructions/i,
  /override\s+instructions/i,
  /<\/?[a-z]+>/i, // HTML-like tags
  /\[\/?(system|user|assistant)\]/i, // Chat role markers
  /```/g, // Code blocks
];

// Maximum lengths for different input types
const MAX_LENGTHS = {
  style: 100,
  products: 500,
  bodyType: 50,
  gender: 20,
  stylePreference: 50,
  stylePreferencesTotal: 200,
};

// Allowed body types (whitelist)
const ALLOWED_BODY_TYPES = ['slim', 'average', 'athletic', 'curvy', 'plus-size', 'default'];

// Allowed genders (whitelist)
const ALLOWED_GENDERS = ['male', 'female', 'unisex', 'prefer_not_to_say', null, undefined];

/**
 * Sanitizes text input by removing potentially harmful characters and patterns
 */
function sanitizeTextInput(input: string | null | undefined, maxLength: number): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Trim and limit length first
  let sanitized = input.trim().slice(0, maxLength);
  
  // Check for prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn('Prompt injection pattern detected and blocked:', pattern.toString());
      return ''; // Return empty string if injection detected
    }
  }
  
  // Remove any characters that don't match allowed pattern
  if (!ALLOWED_TEXT_CHARS.test(sanitized)) {
    // Filter out disallowed characters
    sanitized = sanitized.split('').filter(char => 
      ALLOWED_TEXT_CHARS.test(char)
    ).join('');
  }
  
  // Double-check: remove any remaining potentially dangerous sequences
  sanitized = sanitized
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return sanitized;
}

/**
 * Validates and sanitizes style input
 */
function sanitizeStyle(style: string | null | undefined): string {
  const sanitized = sanitizeTextInput(style, MAX_LENGTHS.style);
  return sanitized || 'casual'; // Default fallback
}

/**
 * Validates and sanitizes products description
 */
function sanitizeProducts(products: string | null | undefined): string {
  const sanitized = sanitizeTextInput(products, MAX_LENGTHS.products);
  return sanitized || 'modern casual wear'; // Default fallback
}

/**
 * Validates body type against whitelist
 */
function validateBodyType(bodyType: string | null | undefined): string {
  if (!bodyType || typeof bodyType !== 'string') {
    return 'average';
  }
  const normalized = bodyType.toLowerCase().trim();
  return ALLOWED_BODY_TYPES.includes(normalized) ? normalized : 'average';
}

/**
 * Validates gender against whitelist
 */
function validateGender(gender: string | null | undefined): string | null {
  if (!gender || typeof gender !== 'string') {
    return null;
  }
  const normalized = gender.toLowerCase().trim();
  if (ALLOWED_GENDERS.includes(normalized)) {
    return normalized === 'prefer_not_to_say' ? null : normalized;
  }
  return null;
}

/**
 * Validates and sanitizes style preferences array
 */
function sanitizeStylePreferences(preferences: any[] | null | undefined): string {
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return '';
  }
  
  // Sanitize each preference, filter out empty ones, limit total
  const sanitized = preferences
    .filter(p => typeof p === 'string')
    .map(p => sanitizeTextInput(p, MAX_LENGTHS.stylePreference))
    .filter(p => p.length > 0)
    .slice(0, 5); // Max 5 preferences
  
  const result = sanitized.join(', ');
  
  // Enforce total length limit
  return result.slice(0, MAX_LENGTHS.stylePreferencesTotal);
}

/**
 * Validates height is a reasonable number
 */
function validateHeight(height: any): number {
  if (typeof height !== 'number' || isNaN(height)) {
    return 170; // Default
  }
  // Reasonable human height range in cm
  return Math.min(Math.max(Math.round(height), 100), 250);
}

// Generate cache key from style + products + user profile combination
function generateCacheKey(
  styleTrendId: string | null, 
  productIds: string[],
  bodyType?: string,
  heightRange?: string,
  gender?: string
): string {
  const sortedProducts = [...productIds].sort();
  // Include body type, height range, and gender in cache key for better matching
  const bodyKey = bodyType || 'default';
  const heightKey = heightRange || 'default';
  const genderKey = gender || 'default';
  const key = `${styleTrendId || 'none'}_${sortedProducts.join('_')}_${bodyKey}_${heightKey}_${genderKey}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `style_${Math.abs(hash).toString(36)}`;
}

// Generate a simpler cache key for fallback matching (without user profile)
function generateSimpleCacheKey(styleTrendId: string | null, productIds: string[]): string {
  const sortedProducts = [...productIds].sort();
  const key = `${styleTrendId || 'none'}_${sortedProducts.join('_')}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `simple_${Math.abs(hash).toString(36)}`;
}

// Get height range for cache grouping (groups heights into 5cm ranges)
function getHeightRange(height: number): string {
  const rangeStart = Math.floor(height / 5) * 5;
  return `${rangeStart}-${rangeStart + 5}`;
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
async function generateImageWithVertexAI(
  accessToken: string,
  projectId: string,
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {

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

// Generate image using Lovable AI (fallback) - uses gemini-3-pro for better face compositing
async function generateImageWithLovableAI(
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  console.log('Calling Lovable AI (fallback) with gemini-3-pro-image-preview...');

  // Build message content
  let content: any;
  if (imageUrl) {
    content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];
    console.log('Including reference image for face composite');
  } else {
    content = prompt;
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
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

// Try to find cached image with multi-level cache strategy
async function findCachedImage(
  supabaseAdmin: any,
  styleTrendId: string | null,
  productIds: string[],
  bodyType?: string,
  height?: number,
  gender?: string
): Promise<{ imageUrl: string; cacheLevel: string } | null> {
  const heightRange = height ? getHeightRange(height) : undefined;
  
  // Level 1: Exact match with body type, height range, and gender
  const exactCacheKey = generateCacheKey(styleTrendId, productIds, bodyType, heightRange, gender);
  console.log(`Checking L1 cache (exact): ${exactCacheKey}`);
  
  const { data: exactMatch } = await supabaseAdmin
    .from('style_cache')
    .select('*')
    .eq('cache_key', exactCacheKey)
    .single();
  
  if (exactMatch) {
    console.log('L1 Cache HIT (exact match with profile)');
    return { imageUrl: exactMatch.image_url, cacheLevel: 'L1_EXACT' };
  }
  
  // Level 2: Match with body type and gender only (different height)
  const bodyTypeCacheKey = generateCacheKey(styleTrendId, productIds, bodyType, undefined, gender);
  console.log(`Checking L2 cache (body type): ${bodyTypeCacheKey}`);
  
  const { data: bodyTypeMatch } = await supabaseAdmin
    .from('style_cache')
    .select('*')
    .eq('cache_key', bodyTypeCacheKey)
    .single();
  
  if (bodyTypeMatch) {
    console.log('L2 Cache HIT (body type match)');
    return { imageUrl: bodyTypeMatch.image_url, cacheLevel: 'L2_BODY_TYPE' };
  }
  
  // Level 3: Simple match (style + products only, most popular)
  const simpleCacheKey = generateSimpleCacheKey(styleTrendId, productIds);
  console.log(`Checking L3 cache (simple): ${simpleCacheKey}`);
  
  const { data: simpleMatch } = await supabaseAdmin
    .from('style_cache')
    .select('*')
    .eq('cache_key', simpleCacheKey)
    .order('use_count', { ascending: false })
    .limit(1)
    .single();
  
  if (simpleMatch) {
    console.log('L3 Cache HIT (simple match, most popular)');
    return { imageUrl: simpleMatch.image_url, cacheLevel: 'L3_SIMPLE' };
  }
  
  // Level 4: Fuzzy match - same style trend with overlapping products
  if (styleTrendId && productIds.length > 0) {
    console.log('Checking L4 cache (fuzzy match)...');
    
    const { data: fuzzyMatches } = await supabaseAdmin
      .from('style_cache')
      .select('*')
      .eq('style_trend_id', styleTrendId)
      .order('use_count', { ascending: false })
      .limit(10);
    
    if (fuzzyMatches && fuzzyMatches.length > 0) {
      // Find cache with highest product overlap
      let bestMatch = null;
      let bestOverlap = 0;
      
      for (const cache of fuzzyMatches) {
        const cacheProducts = cache.product_ids || [];
        const overlap = productIds.filter(p => cacheProducts.includes(p)).length;
        const overlapRatio = overlap / Math.max(productIds.length, cacheProducts.length);
        
        // Require at least 50% overlap
        if (overlapRatio >= 0.5 && overlap > bestOverlap) {
          bestMatch = cache;
          bestOverlap = overlap;
        }
      }
      
      if (bestMatch) {
        console.log(`L4 Cache HIT (fuzzy match, ${bestOverlap} products overlap)`);
        return { imageUrl: bestMatch.image_url, cacheLevel: 'L4_FUZZY' };
      }
    }
  }
  
  console.log('All cache levels MISS');
  return null;
}

// Update cache usage statistics
async function updateCacheUsage(supabaseAdmin: any, imageUrl: string) {
  await supabaseAdmin
    .from('style_cache')
    .update({ 
      use_count: supabaseAdmin.raw('use_count + 1'),
      last_used_at: new Date().toISOString()
    })
    .eq('image_url', imageUrl);
}

// Save to cache with multiple keys for better hit rate
async function saveToCache(
  supabaseAdmin: any,
  styleTrendId: string | null,
  productIds: string[],
  imageUrl: string,
  bodyType?: string,
  height?: number,
  gender?: string
) {
  const heightRange = height ? getHeightRange(height) : undefined;
  
  // Save with exact key (includes body type, height, and gender)
  const exactCacheKey = generateCacheKey(styleTrendId, productIds, bodyType, heightRange, gender);
  
  // Save with body type and gender key
  const bodyTypeCacheKey = generateCacheKey(styleTrendId, productIds, bodyType, undefined, gender);
  
  // Save with simple key (style + products only)
  const simpleCacheKey = generateSimpleCacheKey(styleTrendId, productIds);
  
  // Insert all cache entries
  const cacheEntries = [
    { cache_key: exactCacheKey, style_trend_id: styleTrendId, product_ids: productIds, image_url: imageUrl, use_count: 1 },
    { cache_key: bodyTypeCacheKey, style_trend_id: styleTrendId, product_ids: productIds, image_url: imageUrl, use_count: 1 },
    { cache_key: simpleCacheKey, style_trend_id: styleTrendId, product_ids: productIds, image_url: imageUrl, use_count: 1 }
  ];
  
  for (const entry of cacheEntries) {
    const { error } = await supabaseAdmin
      .from('style_cache')
      .upsert(entry, { onConflict: 'cache_key' });
    
    if (error) {
      console.error(`Error saving cache entry ${entry.cache_key}:`, error.message);
    } else {
      console.log(`Cached with key: ${entry.cache_key}`);
    }
  }
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

    // Determine if we should use cache (not for face composite)
    const shouldUseCache = !useFaceComposite || !userAvatarUrl;
    const bodyType = userProfile?.body_type;
    const height = userProfile?.height;
    const gender = userProfile?.gender;

    // Check cache first (only if not using face composite) - using multi-level strategy
    if (shouldUseCache) {
      const cachedResult = await findCachedImage(
        supabaseAdmin,
        styleTrendId || null,
        productIds || [],
        bodyType,
        height,
        gender
      );

      if (cachedResult) {
        // Update cache usage (async, don't wait)
        updateCacheUsage(supabaseAdmin, cachedResult.imageUrl).catch(console.error);

        // CACHE HIT: Don't count against daily limit!
        console.log(`Cache HIT (${cachedResult.cacheLevel}) - NOT counting against daily limit`);

        // Generate signed URL for cached image (bucket is now private)
        let signedCacheUrl = cachedResult.imageUrl;
        if (!cachedResult.imageUrl.startsWith('http')) {
          const { data: signedData } = await supabaseAdmin.storage
            .from('generated-looks')
            .createSignedUrl(cachedResult.imageUrl, 86400);
          signedCacheUrl = signedData?.signedUrl || cachedResult.imageUrl;
        }

        return new Response(
          JSON.stringify({ 
            imageUrl: signedCacheUrl,
            imagePath: cachedResult.imageUrl,
            message: '캐시된 스타일을 불러왔습니다! (무료)',
            cached: true,
            cacheLevel: cachedResult.cacheLevel,
            remainingCount: isPremium ? -1 : (dailyLimit - currentCount),
            isPremium
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No cache hit - check if user has exceeded daily limit
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

    // ===========================================
    // SANITIZE ALL USER INPUTS BEFORE PROMPT CONSTRUCTION
    // ===========================================
    
    // Sanitize style and products from request body
    const sanitizedStyle = sanitizeStyle(style);
    const sanitizedProducts = sanitizeProducts(products);
    
    // Validate and sanitize user profile fields
    const heightVal = validateHeight(userProfile?.height);
    const bodyTypeVal = validateBodyType(userProfile?.body_type);
    const stylePreferences = sanitizeStylePreferences(userProfile?.style_preferences);
    const genderVal = validateGender(userProfile?.gender);

    console.log('Sanitized inputs:', {
      style: sanitizedStyle,
      products: sanitizedProducts.slice(0, 50) + (sanitizedProducts.length > 50 ? '...' : ''),
      height: heightVal,
      bodyType: bodyTypeVal,
      gender: genderVal || 'not specified',
      stylePreferences: stylePreferences.slice(0, 50) + (stylePreferences.length > 50 ? '...' : '')
    });

    // Map gender to descriptive terms for the prompt (using validated value)
    const getGenderDescription = (gender: string | null | undefined): string => {
      switch (gender) {
        case 'male':
          return 'male';
        case 'female':
          return 'female';
        case 'unisex':
          return 'androgynous/gender-neutral';
        default:
          return ''; // prefer_not_to_say or null - don't specify
      }
    };

    const genderDescription = getGenderDescription(genderVal);
    const personDescription = genderDescription 
      ? `a stylish ${genderDescription} Korean person`
      : 'a stylish Korean person';

    let prompt: string;
    let referenceImageUrl: string | undefined;

    // Build prompts using ONLY sanitized/validated values
    if (useFaceComposite && userAvatarUrl) {
      referenceImageUrl = userAvatarUrl;
      prompt = `Take this person's face and create a professional fashion lookbook photo of them wearing ${sanitizedStyle} style outfit.
The outfit includes: ${sanitizedProducts}.
${genderDescription ? `Fashion style suited for ${genderDescription} body and preferences.` : ''}
The person has ${bodyTypeVal} body type, approximately ${heightVal}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Create a full body shot with this exact person's face, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.
Keep the person's face exactly as shown in the reference photo while generating the fashionable outfit on their body.`;

      console.log('Generating face composite image');
    } else {
      prompt = `Create a professional fashion lookbook photo of ${personDescription} wearing ${sanitizedStyle} style outfit. 
The outfit includes: ${sanitizedProducts}.
${genderDescription ? `Choose clothing items and silhouettes that complement ${genderDescription} fashion.` : ''}
The person has ${bodyTypeVal} body type, approximately ${heightVal}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Full body shot, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.`;

      console.log('Generating standard image');
    }

    console.log('Gender:', genderVal || 'not specified');
    console.log('Prompt length:', prompt.length, 'chars');

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
    let filePath = '';
    let signedImageUrl = '';
    
    try {
      const imageBytes = base64ToUint8Array(imageBase64);
      filePath = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('generated-looks')
        .upload(filePath, imageBytes, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error('이미지 저장에 실패했습니다.');
      }
      
      // Generate signed URL (bucket is now private)
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from('generated-looks')
        .createSignedUrl(filePath, 86400); // 24 hours
      
      if (signedError) {
        console.error('Error creating signed URL:', signedError);
        throw new Error('이미지 URL 생성에 실패했습니다.');
      }
      
      signedImageUrl = signedData.signedUrl;
      console.log('Image uploaded to storage with signed URL');
    } catch (uploadErr) {
      console.error('Error processing image upload:', uploadErr);
      throw uploadErr;
    }

    // Save to cache with file path (only for non-face-composite)
    if (shouldUseCache && filePath) {
      await saveToCache(
        supabaseAdmin,
        styleTrendId || null,
        productIds || [],
        filePath,
        bodyType,
        height,
        gender
      );
    }

    // Increment usage count (only for new generations)
    await supabaseAdmin
      .from('daily_generation_usage')
      .update({ generation_count: currentCount + 1 })
      .eq('user_id', userId)
      .eq('usage_date', today);

    console.log(`Usage updated for user ${userId}: ${currentCount + 1}`);

    return new Response(
      JSON.stringify({ 
        imageUrl: signedImageUrl,
        imagePath: filePath,
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
