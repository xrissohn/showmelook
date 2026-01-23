// process-generation-queue - 비동기 생성 작업 처리
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  } catch (logErr) {
    console.error('[process-queue] Failed to log error:', logErr);
  }
}

// Update job status with Realtime broadcast
async function updateJobStatus(
  supabase: any,
  jobId: string,
  status: string,
  progress: number,
  extraFields: Record<string, any> = {}
) {
  const updateData: Record<string, any> = {
    status,
    progress,
    ...extraFields,
  };
  
  if (status === 'processing' && !extraFields.started_at) {
    updateData.started_at = new Date().toISOString();
  }
  
  if (['completed', 'failed'].includes(status)) {
    updateData.completed_at = new Date().toISOString();
  }
  
  await supabase
    .from('generation_jobs')
    .update(updateData)
    .eq('id', jobId);
  
  console.log(`[process-queue] Job ${jobId}: ${status} (${progress}%)`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the next pending job (priority order)
    const { data: jobs, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const job = jobs[0];
    const payload = job.request_payload as {
      userRequest?: string;
      gender?: string;
      budget?: number;
      style?: string;
      products?: string;
      userProfile?: any;
      useFaceComposite?: boolean;
      userAvatarUrl?: string;
    };

    console.log(`[process-queue] Processing job ${job.id} for user ${job.user_id}`);

    // Mark as processing
    await updateJobStatus(supabase, job.id, 'processing', 10);

    try {
      // Step 1: Style Recommendation (30%)
      await updateJobStatus(supabase, job.id, 'generating_style', 20);
      
      const recResponse = await fetch(`${SUPABASE_URL}/functions/v1/style-recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userRequest: payload.userRequest || payload.style || '캐주얼 스타일',
          gender: payload.gender || '여성',
          budget: payload.budget || 200000,
          forceRefresh: false,
        }),
      });

      if (!recResponse.ok) {
        const errorText = await recResponse.text();
        throw new Error(`Style recommend failed: ${recResponse.status} - ${errorText}`);
      }

      const recData = await recResponse.json();
      
      if (!recData.success || !recData.look?.items?.length) {
        throw new Error('No style recommendations returned');
      }

      await updateJobStatus(supabase, job.id, 'generating_style', 40);

      // Prepare data for image generation
      const items = recData.look.items.filter((i: any) => i.product);
      const styleDesc = recData.look.styleConcept || recData.look.name || '스타일';
      const productsDesc = items.map((i: any) => {
        const p = i.product;
        return p.brand ? `${p.brand} ${p.name}` : p.name;
      }).join(', ');

      const productsWithDetails = items.map((i: any) => ({
        id: i.product.id,
        name: i.product.name,
        brand: i.product.brand,
        category: i.category,
        image_url: i.product.image_url,
      }));

      // Step 2: Image Generation (80%)
      await updateJobStatus(supabase, job.id, 'generating_image', 50);

      const genResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-style`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          style: styleDesc,
          products: productsDesc,
          productDetails: productsWithDetails,
          productImageUrls: productsWithDetails.filter((p: any) => p.image_url).map((p: any) => p.image_url),
          userProfile: payload.userProfile || {},
          useFaceComposite: payload.useFaceComposite || false,
          userAvatarUrl: payload.userAvatarUrl || null,
          productIds: productsWithDetails.map((p: any) => p.id),
        }),
      });

      await updateJobStatus(supabase, job.id, 'generating_image', 70);

      if (!genResponse.ok) {
        const errorText = await genResponse.text();
        throw new Error(`Image generation failed: ${genResponse.status} - ${errorText}`);
      }

      const genData = await genResponse.json();

      if (!genData.success || !genData.imageUrl) {
        throw new Error('No image generated');
      }

      await updateJobStatus(supabase, job.id, 'generating_image', 90);

      // Step 3: Save to generated_looks
      const { data: insertedLook, error: insertError } = await supabase
        .from('generated_looks')
        .insert({
          user_id: job.user_id,
          image_url: genData.imageUrl,
          prompt_used: recData.look.styleConcept || styleDesc,
          product_ids: productsWithDetails.map((p: any) => p.id),
          style_reasoning: recData.look.styleReasoning || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[process-queue] Failed to save look:', insertError);
      }

      // Complete!
      await updateJobStatus(supabase, job.id, 'completed', 100, {
        result_url: genData.imageUrl,
        result_payload: {
          lookId: insertedLook?.id,
          look: recData.look,
          imageUrl: genData.imageUrl,
        },
      });

      const elapsed = Date.now() - startTime;
      console.log(`[process-queue] Job ${job.id} completed in ${elapsed}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          lookId: insertedLook?.id,
          imageUrl: genData.imageUrl,
          elapsed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (jobError) {
      console.error(`[process-queue] Job ${job.id} failed:`, jobError);
      
      const errorMessage = jobError instanceof Error ? jobError.message : String(jobError);
      const shouldRetry = job.retry_count < job.max_retries;
      
      if (shouldRetry) {
        // Retry later
        await updateJobStatus(supabase, job.id, 'queued', 0, {
          retry_count: job.retry_count + 1,
          error_message: `Retry ${job.retry_count + 1}: ${errorMessage}`,
          started_at: null,
        });
        
        console.log(`[process-queue] Job ${job.id} queued for retry (${job.retry_count + 1}/${job.max_retries})`);
      } else {
        // Max retries reached
        await updateJobStatus(supabase, job.id, 'failed', 0, {
          error_message: errorMessage,
        });
        
        // Log the error
        await logError(
          supabase,
          'process-generation-queue',
          'JOB_FAILED',
          errorMessage,
          job.user_id,
          { jobId: job.id },
          Date.now() - startTime
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          jobId: job.id,
          error: errorMessage,
          willRetry: shouldRetry,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[process-queue] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
