// record-feedback - 상품 피드백 기록 API
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
    const { 
      productId, 
      actionType,  // 'like' | 'dislike' | 'cart' | 'purchase' | 'click' | 'view'
      recommendationId,
      styleConcept,  // 현재 스타일 컨텍스트 (예: '캐주얼', '미니멀')
      occasion,
      additionalContext
    } = await req.json();

    if (!productId || !actionType) {
      return new Response(JSON.stringify({ error: 'productId and actionType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 유효한 action_type 체크
    const validTypes = ['like', 'dislike', 'click', 'cart', 'purchase', 'view', 'remove', 'payment_notify_request', 'style_like', 'style_dislike'];
    if (!validTypes.includes(actionType)) {
      return new Response(JSON.stringify({ error: `Invalid actionType. Must be one of: ${validTypes.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // JWT에서 user_id 추출
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 피드백 컨텍스트 구성
    const context: Record<string, any> = {};
    if (styleConcept) context.style_concept = styleConcept;
    if (occasion) context.occasion = occasion;
    if (additionalContext) Object.assign(context, additionalContext);
    context.timestamp = new Date().toISOString();

    // 피드백 삽입
    const { error: insertError } = await supabase
      .from('product_feedback')
      .insert({
        user_id: userId,
        product_id: productId,
        action_type: actionType,
        recommendation_id: recommendationId || null,
        context: Object.keys(context).length > 0 ? context : null,
      });

    if (insertError) {
      console.error('[record-feedback] Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[record-feedback] Recorded: ${actionType} for product ${productId} by user ${userId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Feedback '${actionType}' recorded successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[record-feedback] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
