// process-generation-queue - Phase 4: Token Bucket Rate Limiter + Priority Aging + 연쇄 호출
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== Token Bucket Configuration =====
const TOKEN_BUCKET = {
  maxTokens: 45,           // 버킷 최대 용량 (버스트 허용량) - 증가
  refillRate: 15,          // 초당 토큰 리필 수 (= 900 RPM 목표) - 50% 증가
  tokensPerRequest: 1,     // 요청당 소비 토큰
  minTokensToProcess: 1,   // 최소 처리 가능 토큰 수
};

// ===== Adaptive Backoff Configuration =====
const BACKOFF_CONFIG = {
  initialBackoffMs: 3000,  // 첫 429 시 백오프 3초 - 단축
  maxBackoffMs: 45000,     // 최대 백오프 45초 - 단축
  backoffMultiplier: 1.5,  // 백오프 증가 배수 - 완화
  recoveryThreshold: 3,    // 연속 성공 N회 후 백오프 감소 - 빠른 회복
};

// ===== Queue Processing Configuration =====
const QUEUE_CONFIG = {
  batchSize: 15,           // 배치당 최대 작업 수 (5워커 x 3작업) - 증가
  chainDelayMs: 1500,      // 연쇄 호출 간 딜레이 (1.5초) - 단축
  maxChainDepth: 50,       // 최대 연쇄 호출 횟수 - 증가
  parallelWorkers: 5,      // 동시 처리 워커 수 - 67% 증가
  staggerDelayMs: 1500,    // 워커 간 시차 시작 (1.5초) - 단축
};

// Priority Aging 설정
const AGING_INTERVALS = {
  5: 10 * 60 * 1000, // Free(5): 10분 후 → 4
  4: 8 * 60 * 1000,  // Free aged(4): 8분 후 → 3
  3: 5 * 60 * 1000,  // Pro(3): 5분 후 → 2
  2: 5 * 60 * 1000,  // Pro aged(2): 5분 후 → 1
};

// ===== Token Bucket Functions =====

interface TokenBucketState {
  tokens: number;
  max_tokens: number;
  refill_rate: number;
  last_refill_at: string;
  backoff_until: string | null;
  consecutive_failures: number;
  consecutive_successes: number;
  total_requests_today: number;
  total_rate_limits_today: number;
  last_reset_date: string;
}

async function getTokenBucketState(supabase: any): Promise<TokenBucketState | null> {
  const { data, error } = await supabase
    .from('rate_limit_state')
    .select('*')
    .eq('id', 'global')
    .single();
  
  if (error) {
    console.error('[TokenBucket] Failed to get state:', error);
    return null;
  }
  return data;
}

async function refillAndConsumeTokens(
  supabase: any, 
  requestedTokens: number
): Promise<{ 
  granted: boolean; 
  tokensAvailable: number; 
  waitMs: number;
  isInBackoff: boolean;
  state: TokenBucketState | null;
}> {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  const state = await getTokenBucketState(supabase);
  
  if (!state) {
    // 상태가 없으면 기본값으로 진행
    return { granted: true, tokensAvailable: TOKEN_BUCKET.maxTokens, waitMs: 0, isInBackoff: false, state: null };
  }
  
  // 날짜가 바뀌면 일일 카운터 리셋
  if (state.last_reset_date !== today) {
    await supabase
      .from('rate_limit_state')
      .update({
        total_requests_today: 0,
        total_rate_limits_today: 0,
        last_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');
    state.total_requests_today = 0;
    state.total_rate_limits_today = 0;
  }
  
  // 백오프 확인
  if (state.backoff_until) {
    const backoffUntilMs = new Date(state.backoff_until).getTime();
    if (backoffUntilMs > now) {
      const waitMs = backoffUntilMs - now;
      console.log(`[TokenBucket] In backoff until ${state.backoff_until}, wait ${waitMs}ms`);
      return { granted: false, tokensAvailable: state.tokens, waitMs, isInBackoff: true, state };
    }
  }
  
  // 시간 경과에 따른 토큰 리필
  const lastRefillMs = new Date(state.last_refill_at).getTime();
  const elapsedMs = now - lastRefillMs;
  const tokensToAdd = (elapsedMs / 1000) * state.refill_rate;
  const newTokens = Math.min(state.tokens + tokensToAdd, state.max_tokens);
  
  // 토큰 소비 가능 여부 확인
  if (newTokens >= requestedTokens) {
    // 토큰 소비 및 상태 업데이트
    await supabase
      .from('rate_limit_state')
      .update({
        tokens: newTokens - requestedTokens,
        last_refill_at: new Date(now).toISOString(),
        total_requests_today: state.total_requests_today + 1,
        updated_at: new Date(now).toISOString(),
      })
      .eq('id', 'global');
    
    console.log(`[TokenBucket] Consumed ${requestedTokens} token(s), ${(newTokens - requestedTokens).toFixed(2)} remaining`);
    return { 
      granted: true, 
      tokensAvailable: newTokens - requestedTokens, 
      waitMs: 0, 
      isInBackoff: false,
      state: { ...state, tokens: newTokens - requestedTokens }
    };
  }
  
  // 토큰 부족 시 대기 시간 계산
  const tokensNeeded = requestedTokens - newTokens;
  const waitMs = (tokensNeeded / state.refill_rate) * 1000;
  
  console.log(`[TokenBucket] Need ${tokensNeeded.toFixed(2)} more tokens, wait ${waitMs.toFixed(0)}ms`);
  return { granted: false, tokensAvailable: newTokens, waitMs, isInBackoff: false, state };
}

async function handleRateLimitError(supabase: any): Promise<number> {
  const state = await getTokenBucketState(supabase);
  
  if (!state) {
    return BACKOFF_CONFIG.initialBackoffMs;
  }
  
  const failures = state.consecutive_failures + 1;
  const backoffMs = Math.min(
    BACKOFF_CONFIG.initialBackoffMs * Math.pow(BACKOFF_CONFIG.backoffMultiplier, failures - 1),
    BACKOFF_CONFIG.maxBackoffMs
  );
  
  const backoffUntil = new Date(Date.now() + backoffMs);
  
  await supabase
    .from('rate_limit_state')
    .update({
      tokens: 0,  // 버킷 비우기
      consecutive_failures: failures,
      consecutive_successes: 0,
      backoff_until: backoffUntil.toISOString(),
      total_rate_limits_today: state.total_rate_limits_today + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'global');
  
  console.log(`[TokenBucket] Rate limited! Backoff for ${backoffMs}ms (failure #${failures})`);
  return backoffMs;
}

async function handleSuccess(supabase: any): Promise<void> {
  const state = await getTokenBucketState(supabase);
  
  if (!state) return;
  
  const newSuccesses = state.consecutive_successes + 1;
  
  const updateData: Record<string, any> = {
    consecutive_successes: newSuccesses,
    updated_at: new Date().toISOString(),
  };
  
  // 연속 성공 시 백오프 상태 해제 및 실패 카운터 감소
  if (newSuccesses >= BACKOFF_CONFIG.recoveryThreshold) {
    updateData.consecutive_failures = Math.max(0, state.consecutive_failures - 1);
    updateData.backoff_until = null;
    console.log(`[TokenBucket] Recovery! Failures reduced to ${updateData.consecutive_failures}`);
  }
  
  await supabase
    .from('rate_limit_state')
    .update(updateData)
    .eq('id', 'global');
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

    // Capture generation-time tag positions for accurate product tag overlays
    const tagPositions = Array.isArray(genData.tagPositions) ? genData.tagPositions : null;
    if (tagPositions) {
      console.log(`[process-queue] Job ${job.id}: captured ${tagPositions.length} tag positions`);
    }

    // Step 3: Save to generated_looks (including tag_positions for gallery rendering)
    const { data: insertedLook, error: insertError } = await supabase
      .from('generated_looks')
      .insert({
        user_id: job.user_id,
        image_url: genData.imageUrl,
        prompt_used: recData.look.styleConcept || styleDesc,
        product_ids: productsWithDetails.map((p: any) => p.id),
        style_reasoning: recData.look.styleReasoning || null,
        tag_positions: tagPositions,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[process-queue] Failed to save look:', insertError);
    }

    // Complete! Include tagPositions so the frontend can render tags immediately on the first screen
    await updateJobStatus(supabase, job.id, 'completed', 100, {
      result_url: genData.imageUrl,
      result_payload: {
        lookId: insertedLook?.id,
        look: recData.look,
        imageUrl: genData.imageUrl,
        tagPositions,
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

// Token Bucket aware parallel worker processing
async function processJobsWithTokenBucket(
  supabase: any,
  jobs: any[],
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string
): Promise<{ 
  results: any[]; 
  rateLimitHit: boolean; 
  successCount: number; 
  failCount: number; 
  tokensRemaining: number;
}> {
  const results: any[] = [];
  let rateLimitHit = false;
  let successCount = 0;
  let failCount = 0;
  let tokensRemaining = TOKEN_BUCKET.maxTokens;
  
  for (const job of jobs) {
    // Token Bucket에서 토큰 요청
    const { granted, tokensAvailable, waitMs, isInBackoff, state } = 
      await refillAndConsumeTokens(supabase, TOKEN_BUCKET.tokensPerRequest);
    
    tokensRemaining = tokensAvailable;
    
    if (!granted) {
      if (isInBackoff) {
        console.log(`[TokenBucket] In backoff, stopping processing`);
        rateLimitHit = true;
        break;
      }
      
      // 토큰 리필 대기
      if (waitMs > 0 && waitMs < 10000) { // 10초 이하만 대기
        console.log(`[TokenBucket] Waiting ${waitMs}ms for token refill`);
        await new Promise(r => setTimeout(r, waitMs));
        
        // 다시 토큰 요청
        const retry = await refillAndConsumeTokens(supabase, TOKEN_BUCKET.tokensPerRequest);
        if (!retry.granted) {
          console.log(`[TokenBucket] Still no tokens after wait, stopping`);
          break;
        }
        tokensRemaining = retry.tokensAvailable;
      } else {
        console.log(`[TokenBucket] Wait time too long (${waitMs}ms), stopping`);
        break;
      }
    }
    
    // Job 처리
    const result = await processJob(supabase, job, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    results.push(result);
    
    if (result.rateLimited) {
      await handleRateLimitError(supabase);
      rateLimitHit = true;
      break;
    } else if (result.success) {
      await handleSuccess(supabase);
      successCount++;
    } else {
      failCount++;
    }
  }
  
  return { results, rateLimitHit, successCount, failCount, tokensRemaining };
}

// Parallel Worker Processing with Token Bucket
async function processJobsInParallel(
  supabase: any,
  jobs: any[],
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string,
  numWorkers: number
): Promise<{ 
  results: any[]; 
  rateLimitHit: boolean; 
  successCount: number; 
  failCount: number; 
  tokensRemaining: number;
}> {
  // 단일 워커 모드일 때는 Token Bucket 순차 처리
  if (numWorkers <= 1) {
    return processJobsWithTokenBucket(supabase, jobs, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  
  // 병렬 모드: Jobs를 워커 수만큼 그룹으로 분배
  const workerGroups: any[][] = Array.from({ length: numWorkers }, () => []);
  jobs.forEach((job, idx) => {
    workerGroups[idx % numWorkers].push(job);
  });
  
  console.log(`[process-queue] Parallel: ${numWorkers} workers, jobs: ${workerGroups.map(g => g.length).join(',')}`);
  
  let globalRateLimitHit = false;
  let globalSuccessCount = 0;
  let globalFailCount = 0;
  let globalTokensRemaining = TOKEN_BUCKET.maxTokens;
  
  // 시차를 두고 워커 시작 (Staggered Start)
  const workerPromises = workerGroups.map(async (group, workerIdx) => {
    if (group.length === 0) return [];
    
    // 워커 간 시차 시작
    if (workerIdx > 0) {
      await new Promise(resolve => setTimeout(resolve, workerIdx * QUEUE_CONFIG.staggerDelayMs));
    }
    
    // Rate limit 발생 시 다른 워커 중지
    if (globalRateLimitHit) {
      console.log(`[Worker ${workerIdx + 1}] Skipping due to rate limit`);
      return [];
    }
    
    console.log(`[Worker ${workerIdx + 1}] Started with ${group.length} jobs`);
    
    const workerResults: any[] = [];
    for (const job of group) {
      if (globalRateLimitHit) break;
      
      // Token 요청
      const { granted, tokensAvailable, waitMs, isInBackoff } = 
        await refillAndConsumeTokens(supabase, TOKEN_BUCKET.tokensPerRequest);
      
      globalTokensRemaining = tokensAvailable;
      
      if (!granted) {
        if (isInBackoff || waitMs > 5000) {
          globalRateLimitHit = true;
          break;
        }
        await new Promise(r => setTimeout(r, waitMs));
      }
      
      const result = await processJob(supabase, job, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      workerResults.push(result);
      
      if (result.rateLimited) {
        await handleRateLimitError(supabase);
        globalRateLimitHit = true;
      } else if (result.success) {
        await handleSuccess(supabase);
        globalSuccessCount++;
      } else {
        globalFailCount++;
      }
    }
    
    console.log(`[Worker ${workerIdx + 1}] Finished: ${workerResults.filter(r => r.success).length} success`);
    return workerResults;
  });
  
  const allResults = await Promise.all(workerPromises);
  
  return { 
    results: allResults.flat(), 
    rateLimitHit: globalRateLimitHit, 
    successCount: globalSuccessCount, 
    failCount: globalFailCount,
    tokensRemaining: globalTokensRemaining,
  };
}

async function requireAdminOrService(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token === serviceKey) return { ok: true };
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  let userId: string | null = claimsData?.claims?.sub ?? null;
  if (claimsError || !userId) {
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: role } = await adminClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!role) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdminOrService(req);
  if (!auth.ok) return auth.response;

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

    // Parse request body for chain depth
    let chainDepth = 0;
    
    try {
      const body = await req.json();
      chainDepth = body.chainDepth || 0;
    } catch {
      // No body or invalid JSON, start fresh
    }

    // Step 0: Check Token Bucket state
    const bucketState = await getTokenBucketState(supabase);
    
    if (bucketState?.backoff_until) {
      const backoffUntilMs = new Date(bucketState.backoff_until).getTime();
      if (backoffUntilMs > Date.now()) {
        const waitMs = backoffUntilMs - Date.now();
        console.log(`[process-queue] In backoff, returning early. Wait ${waitMs}ms`);
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'In backoff period',
            backoffUntil: bucketState.backoff_until,
            waitMs,
            chainDepth,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[process-queue] Chain: ${chainDepth}/${QUEUE_CONFIG.maxChainDepth}, Tokens: ${bucketState?.tokens?.toFixed(2) || 'N/A'}`);

    // Step 1: Apply Priority Aging
    const agedCount = await applyPriorityAging(supabase);
    if (agedCount > 0) {
      console.log(`[process-queue] Priority Aging applied to ${agedCount} jobs`);
    }

    // Step 2: Determine effective workers based on token availability
    const availableTokens = bucketState?.tokens || TOKEN_BUCKET.maxTokens;
    const isLowTokens = availableTokens < 10;
    const hasRecentFailures = (bucketState?.consecutive_failures || 0) > 0;
    
    const effectiveWorkers = (isLowTokens || hasRecentFailures) ? 1 : QUEUE_CONFIG.parallelWorkers;
    const effectiveBatchSize = effectiveWorkers * 3;

    console.log(`[process-queue] Tokens: ${availableTokens.toFixed(2)}, Workers: ${effectiveWorkers}, Batch: ${effectiveBatchSize}`);

    // Step 3: Get jobs
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
          tokensAvailable: availableTokens,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-queue] Processing ${jobs.length} jobs with ${effectiveWorkers} worker(s)`);

    // Step 4: Process jobs with Token Bucket
    const { results, rateLimitHit, successCount, failCount, tokensRemaining } = 
      await processJobsInParallel(
        supabase,
        jobs,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        effectiveWorkers
      );

    const elapsed = Date.now() - startTime;
    const throughputPerMin = successCount > 0 ? Math.round((successCount / elapsed) * 60000) : 0;
    console.log(`[process-queue] Batch: ${successCount} OK, ${failCount} fail, ${rateLimitHit ? 'RATE LIMITED' : 'OK'} in ${elapsed}ms (~${throughputPerMin}/min)`);

    // Step 5: Check for remaining jobs and chain
    const { count: remainingCount } = await supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    let chainTriggered = false;
    
    // 백오프 상태 다시 확인
    const updatedState = await getTokenBucketState(supabase);
    const nextBackoffUntil = updatedState?.backoff_until;
    const chainDelayMs = rateLimitHit 
      ? (nextBackoffUntil ? new Date(nextBackoffUntil).getTime() - Date.now() : 5000)
      : QUEUE_CONFIG.chainDelayMs;

    if (remainingCount && remainingCount > 0 && chainDepth < QUEUE_CONFIG.maxChainDepth) {
      const safeChainDelay = Math.min(Math.max(chainDelayMs, QUEUE_CONFIG.chainDelayMs), 60000);
      
      console.log(`[process-queue] ${remainingCount} jobs remaining, chain in ${safeChainDelay}ms (depth ${chainDepth + 1})`);
      
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
            }),
          });
        } catch (err) {
          console.error('[process-queue] Chain call failed:', err);
        }
      }, safeChainDelay);
      
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
        tokensRemaining: tokensRemaining.toFixed(2),
        priorityAgingApplied: agedCount,
        tokenBucket: {
          tokens: updatedState?.tokens,
          consecutiveFailures: updatedState?.consecutive_failures,
          consecutiveSuccesses: updatedState?.consecutive_successes,
          backoffUntil: updatedState?.backoff_until,
          totalRequestsToday: updatedState?.total_requests_today,
          totalRateLimitsToday: updatedState?.total_rate_limits_today,
        },
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
