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

// Generate image using Lovable AI Gateway
async function generateImageWithLovableAI(
  apiKey: string,
  prompt: string,
  imageUrl?: string
): Promise<{ imageBase64: string; text?: string }> {
  const messages: any[] = [];
  
  if (imageUrl) {
    // Include reference image for face composite
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: prompt
    });
  }

  console.log('Calling Lovable AI Gateway for image generation');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages,
      modalities: ['image', 'text']
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    
    throw new Error(`이미지 생성 오류: ${response.status}`);
  }

  const data = await response.json();
  console.log('Lovable AI response received');

  // Extract image and text from response
  const choice = data.choices?.[0];
  if (!choice) {
    console.error('No choices in response:', JSON.stringify(data));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  const message = choice.message;
  const text = message?.content || '';
  const images = message?.images || [];

  if (images.length === 0) {
    console.error('No images in response:', JSON.stringify(message));
    throw new Error('이미지 생성에 실패했습니다.');
  }

  // Extract base64 from data URL
  const imageDataUrl = images[0]?.image_url?.url || '';
  const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  
  if (!base64Match) {
    console.error('Invalid image data URL format');
    throw new Error('이미지 형식이 올바르지 않습니다.');
  }

  return { imageBase64: base64Match[1], text };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, products, userProfile, useFaceComposite, userAvatarUrl, styleTrendId, productIds } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    // Call Lovable AI for image generation
    let result;
    try {
      result = await generateImageWithLovableAI(
        LOVABLE_API_KEY,
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
