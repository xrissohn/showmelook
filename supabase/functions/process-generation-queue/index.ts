// process-generation-queue - Phase 3: Smart Rate Limiter + Priority Aging + 연쇄 호출
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== Phase 3 Configuration =====
const BATCH_SIZE = 5; // 동시 처리할 최대 작업 수
const CHAIN_DELAY_MS = 2000; // 연쇄 호출 간 딜레이 (2초)
const MAX_CHAIN_DEPTH = 30; // 최대 연쇄 호출 횟수

// Rate Limiter (Token Bucket) 설정
const TARGET_RPM = 10; // Gemini API 목표 분당 요청 수
const MIN_INTERVAL_MS = (60 * 1000) / TARGET_RPM; // 6초 간격
const BACKOFF_MULTIPLIER = 2; // 429 에러 시 백오프 배수
const MAX_BACKOFF_MS = 30000; // 최대 백오프 30초
const RECOVERY_THRESHOLD = 3; // 연속 성공 N회 후 백오프 감소

// Priority Aging 설정
const AGING_INTERVALS = {
  5: 10 * 60 * 1000, // Free(5): 10분 후 → 4
  4: 8 * 60 * 1000,  // Free aged(4): 8분 후 → 3
  3: 5 * 60 * 1000,  // Pro(3): 5분 후 → 2
  2: 5 * 60 * 1000,  // Pro aged(2): 5분 후 → 1
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

// Update job status
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

// Priority Aging: 대기 시간이 긴 Job의 우선순위 상승
async function applyPriorityAging(supabase: any): Promise<number> {
  const now = Date.now();
  let upgradedCount = 0;

  for (const [priorityStr, ageThresholdMs] of Object.entries(AGING_INTERVALS)) {
    const priority = parseInt(priorityStr);
    const newPriority = Math.max(1, priority - 1);
    
    if (priority <= 1) continue; // 이미 최고 우선순위
    
    const cutoffTime = new Date(now - ageThresholdMs).toISOString();
    
    const { data: agedJobs, error } = await supabase
      .from('generation_jobs')
      .update({ priority: newPriority })
      .eq('status', 'queued')
      .eq('priority', priority)
      .lt('created_at', cutoffTime)
      .select('id');
    
    if (!error && agedJobs?.length > 0) {
      upgradedCount += agedJobs.length;
      console.log(`[process-queue] Priority Aging: ${agedJobs.length} jobs upgraded from ${priority} to ${newPriority}`);
    }
  }
  
  return upgradedCount;
}

// Process a single job with rate limit awareness
async function processJob(
  supabase: any,
  job: any,
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string
): Promise<{ success: boolean; jobId: string; lookId?: string; imageUrl?: string; error?: string; rateLimited?: boolean }> {
  const startTime = Date.now();
  
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

  try {
    // Mark as processing
    await updateJobStatus(supabase, job.id, 'processing', 10);

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

    // Check for rate limit
    if (recResponse.status === 429) {
      console.warn(`[process-queue] Job ${job.id}: Rate limited at style-recommend`);
      // Re-queue for retry
      await updateJobStatus(supabase, job.id, 'queued', 0, {
        started_at: null,
        error_message: 'Rate limited, will retry',
      });
      return { success: false, jobId: job.id, error: 'Rate limited', rateLimited: true };
    }

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

    // Check for rate limit
    if (genResponse.status === 429) {
      console.warn(`[process-queue] Job ${job.id}: Rate limited at generate-style`);
      await updateJobStatus(supabase, job.id, 'queued', 0, {
        started_at: null,
        error_message: 'Rate limited at image generation, will retry',
      });
      return { success: false, jobId: job.id, error: 'Rate limited', rateLimited: true };
    }

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

    return {
      success: true,
      jobId: job.id,
      lookId: insertedLook?.id,
      imageUrl: genData.imageUrl,
    };

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

    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body for chain depth and backoff state
    let chainDepth = 0;
    let currentBackoffMs = MIN_INTERVAL_MS;
    let consecutiveSuccesses = 0;
    
    try {
      const body = await req.json();
      chainDepth = body.chainDepth || 0;
      currentBackoffMs = body.currentBackoffMs || MIN_INTERVAL_MS;
      consecutiveSuccesses = body.consecutiveSuccesses || 0;
    } catch {
      // No body or invalid JSON, start fresh
    }

    console.log(`[process-queue] Chain: ${chainDepth}/${MAX_CHAIN_DEPTH}, Backoff: ${currentBackoffMs}ms, Consecutive OK: ${consecutiveSuccesses}`);

    // Step 1: Apply Priority Aging
    const agedCount = await applyPriorityAging(supabase);
    if (agedCount > 0) {
      console.log(`[process-queue] Priority Aging applied to ${agedCount} jobs`);
    }

    // Step 2: Get jobs (priority order, respecting rate limit via batch size adjustment)
    // Adaptive batch size based on backoff state
    const effectiveBatchSize = currentBackoffMs > MIN_INTERVAL_MS 
      ? Math.max(1, Math.floor(BATCH_SIZE / 2)) // 백오프 중이면 배치 크기 축소
      : BATCH_SIZE;

    const { data: jobs, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(effectiveBatchSize);

    if (fetchError) throw fetchError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No pending jobs', 
          chainDepth,
          priorityAgingApplied: agedCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-queue] Processing ${jobs.length} jobs (effective batch: ${effectiveBatchSize})`);

    // Step 3: Process jobs with rate limiting awareness
    // 순차 처리로 변경하여 rate limit 제어 (병렬은 429 폭주 위험)
    const results: any[] = [];
    let rateLimitHit = false;
    let successCount = 0;
    let failCount = 0;

    for (const job of jobs) {
      if (rateLimitHit) {
        // Rate limit 발생 시 나머지 job은 스킵 (큐에 남김)
        console.log(`[process-queue] Skipping job ${job.id} due to rate limit`);
        break;
      }

      const result = await processJob(supabase, job, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      results.push(result);

      if (result.rateLimited) {
        rateLimitHit = true;
        consecutiveSuccesses = 0;
      } else if (result.success) {
        successCount++;
        consecutiveSuccesses++;
      } else {
        failCount++;
        consecutiveSuccesses = 0;
      }

      // Rate limit prevention: 작업 간 간격
      if (jobs.indexOf(job) < jobs.length - 1 && !rateLimitHit) {
        await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS));
      }
    }

    // Step 4: Adjust backoff based on results
    let nextBackoffMs = currentBackoffMs;
    
    if (rateLimitHit) {
      // 429 발생: 백오프 증가
      nextBackoffMs = Math.min(currentBackoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      console.log(`[process-queue] Rate limited! Increasing backoff to ${nextBackoffMs}ms`);
    } else if (consecutiveSuccesses >= RECOVERY_THRESHOLD && currentBackoffMs > MIN_INTERVAL_MS) {
      // 연속 성공: 백오프 감소
      nextBackoffMs = Math.max(currentBackoffMs / BACKOFF_MULTIPLIER, MIN_INTERVAL_MS);
      console.log(`[process-queue] Recovering! Decreasing backoff to ${nextBackoffMs}ms`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[process-queue] Batch: ${successCount} succeeded, ${failCount} failed, ${rateLimitHit ? 'RATE LIMITED' : 'OK'} in ${elapsed}ms`);

    // Step 5: Check for remaining jobs and chain
    const { count: remainingCount } = await supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    let chainTriggered = false;
    const chainDelayMs = rateLimitHit ? nextBackoffMs : CHAIN_DELAY_MS;

    if (remainingCount && remainingCount > 0 && chainDepth < MAX_CHAIN_DEPTH) {
      console.log(`[process-queue] ${remainingCount} jobs remaining, chain in ${chainDelayMs}ms (depth ${chainDepth + 1})`);
      
      setTimeout(async () => {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/process-generation-queue`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              chainDepth: chainDepth + 1,
              currentBackoffMs: nextBackoffMs,
              consecutiveSuccesses: rateLimitHit ? 0 : consecutiveSuccesses,
            }),
          });
        } catch (err) {
          console.error('[process-queue] Chain call failed:', err);
        }
      }, chainDelayMs);
      
      chainTriggered = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        rateLimited: rateLimitHit,
        elapsed,
        chainDepth,
        remainingJobs: remainingCount || 0,
        chainTriggered,
        nextBackoffMs,
        priorityAgingApplied: agedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

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
