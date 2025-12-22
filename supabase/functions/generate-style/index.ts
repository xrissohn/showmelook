import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { style, products, userProfile, useFaceComposite, userAvatarUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt based on user profile and selected items
    const height = userProfile?.height || 170;
    const bodyType = userProfile?.body_type || 'average';
    const stylePreferences = userProfile?.style_preferences?.join(', ') || '';

    let prompt: string;
    let messages: any[];

    if (useFaceComposite && userAvatarUrl) {
      // Generate with face composite - use image editing
      prompt = `Take this person's face and create a professional fashion lookbook photo of them wearing ${style} style outfit.
The outfit includes: ${products || 'modern casual wear'}.
The person has ${bodyType} body type, approximately ${height}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Create a full body shot with this exact person's face, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.
Keep the person's face exactly as shown in the reference photo while generating the fashionable outfit on their body.`;

      console.log('Generating face composite image with prompt:', prompt);

      messages = [
        {
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
        }
      ];
    } else {
      // Generate without face composite - standard generation
      prompt = `Create a professional fashion lookbook photo of a stylish Korean person wearing ${style} style outfit. 
The outfit includes: ${products || 'modern casual wear'}.
The person has ${bodyType} body type, approximately ${height}cm tall.
Style preferences: ${stylePreferences || 'modern and trendy'}.
Full body shot, clean white studio background, professional fashion photography lighting.
High fashion editorial style, ultra high resolution, 4K quality.`;

      console.log('Generating standard image with prompt:', prompt);

      messages = [
        {
          role: 'user',
          content: prompt
        }
      ];
    }

    // Call Lovable AI Gateway for image generation
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: '크레딧이 부족합니다. 크레딧을 충전해주세요.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data));
      throw new Error('이미지 생성에 실패했습니다.');
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        message: data.choices?.[0]?.message?.content || '스타일이 생성되었습니다!',
        faceComposite: useFaceComposite && userAvatarUrl ? true : false
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
