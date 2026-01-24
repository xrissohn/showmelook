import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FeedbackItem {
  productId: string;
  actionType: 'view' | 'click' | 'like' | 'cart' | 'purchase';
  recommendationId?: string;
  context?: {
    gender?: string;
    occasion?: string;
    concepts?: string[];
    budget?: number;
    position?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract user ID from auth token if present
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch (e) {
        console.log('[feedback-collect] Could not extract user from token');
      }
    }

    // 비로그인 사용자는 피드백 저장 없이 성공 반환 (앱 중단 방지)
    if (!userId) {
      console.log('[feedback-collect] Anonymous user, skipping feedback save');
      return new Response(
        JSON.stringify({ success: true, count: 0, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // Handle both single feedback and batch feedbacks
    const feedbacks: FeedbackItem[] = body.feedbacks 
      ? body.feedbacks 
      : [body];

    if (feedbacks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert feedbacks into product_feedback table
    const insertData = feedbacks.map(fb => ({
      user_id: userId,
      product_id: fb.productId,
      action_type: fb.actionType,
      recommendation_id: fb.recommendationId || null,
      context: fb.context || null,
    }));

    const { error } = await supabase
      .from('product_feedback')
      .insert(insertData);

    if (error) {
      console.error('[feedback-collect] Insert error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[feedback-collect] Recorded ${feedbacks.length} feedback(s) for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, count: feedbacks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[feedback-collect] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
