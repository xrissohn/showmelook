// queue-status - 큐 상태 모니터링 API (Phase 3)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 예상 처리 시간 계산용 상수
const AVG_PROCESSING_TIME_MS = 45000; // 작업당 평균 45초
const JOBS_PER_MINUTE = 10; // Rate limit 기반 분당 처리량

interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  queueByPriority: Record<number, number>;
  userPosition: number | null;
  estimatedWaitMinutes: number | null;
  recentThroughput: number; // 최근 10분간 분당 처리량
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request for user-specific info
    let userId: string | null = null;
    let jobId: string | null = null;
    
    try {
      // Check Authorization header for user token
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
      
      // Check query params or body for specific job
      const url = new URL(req.url);
      jobId = url.searchParams.get('jobId');
      
      if (!jobId && req.method === 'POST') {
        const body = await req.json();
        jobId = body.jobId || null;
        userId = body.userId || userId;
      }
    } catch {
      // Parsing error, continue without user context
    }

    // 1. 전체 큐 통계
    const { count: totalQueued } = await supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    const { count: totalProcessing } = await supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['processing', 'generating_style', 'generating_image']);

    // 2. 우선순위별 대기 수
    const { data: priorityData } = await supabase
      .from('generation_jobs')
      .select('priority')
      .eq('status', 'queued');

    const queueByPriority: Record<number, number> = {};
    if (priorityData) {
      for (const job of priorityData) {
        const p = job.priority || 5;
        queueByPriority[p] = (queueByPriority[p] || 0) + 1;
      }
    }

    // 3. 최근 10분간 처리량 (throughput)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCompleted } = await supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', tenMinutesAgo);

    const recentThroughput = recentCompleted ? recentCompleted / 10 : JOBS_PER_MINUTE; // 분당

    // 4. 사용자별 대기 순서 계산
    let userPosition: number | null = null;
    let userJobPriority: number | null = null;
    let userJobCreatedAt: string | null = null;

    if (jobId) {
      // 특정 Job의 위치 찾기
      const { data: userJob } = await supabase
        .from('generation_jobs')
        .select('id, priority, created_at, status')
        .eq('id', jobId)
        .single();

      if (userJob && userJob.status === 'queued') {
        userJobPriority = userJob.priority;
        userJobCreatedAt = userJob.created_at;

        // 이 Job 앞에 있는 Job 수 계산
        // (더 높은 우선순위) OR (같은 우선순위 + 더 일찍 생성)
        const { count: aheadCount } = await supabase
          .from('generation_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')
          .or(`priority.lt.${userJobPriority},and(priority.eq.${userJobPriority},created_at.lt.${userJobCreatedAt})`);

        userPosition = (aheadCount || 0) + 1; // 1-indexed
      } else if (userJob && ['processing', 'generating_style', 'generating_image'].includes(userJob.status)) {
        userPosition = 0; // 현재 처리 중
      }
    } else if (userId) {
      // 사용자의 가장 최근 활성 Job 찾기
      const { data: userJobs } = await supabase
        .from('generation_jobs')
        .select('id, priority, created_at, status')
        .eq('user_id', userId)
        .in('status', ['queued', 'processing', 'generating_style', 'generating_image'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (userJobs && userJobs.length > 0) {
        const userJob = userJobs[0];
        
        if (userJob.status === 'queued') {
          userJobPriority = userJob.priority;
          userJobCreatedAt = userJob.created_at;

          const { count: aheadCount } = await supabase
            .from('generation_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'queued')
            .or(`priority.lt.${userJobPriority},and(priority.eq.${userJobPriority},created_at.lt.${userJobCreatedAt})`);

          userPosition = (aheadCount || 0) + 1;
        } else {
          userPosition = 0; // 현재 처리 중
        }
      }
    }

    // 5. 예상 대기 시간 계산
    let estimatedWaitMinutes: number | null = null;
    
    if (userPosition !== null && userPosition > 0) {
      // 앞에 있는 Job 수 / 분당 처리량
      const effectiveThroughput = Math.max(recentThroughput, 1); // 최소 1/분
      estimatedWaitMinutes = Math.ceil(userPosition / effectiveThroughput);
    } else if (userPosition === 0) {
      estimatedWaitMinutes = 1; // 처리 중이면 1분 이내
    }

    // 6. 티어별 예상 대기 시간 (신규 사용자용)
    const estimatedWaitByTier: Record<string, number> = {
      premium: Math.ceil((queueByPriority[1] || 0) / Math.max(recentThroughput, 1)),
      pro: Math.ceil(((queueByPriority[1] || 0) + (queueByPriority[2] || 0) + (queueByPriority[3] || 0)) / Math.max(recentThroughput, 1)),
      free: Math.ceil((totalQueued || 0) / Math.max(recentThroughput, 1)),
    };

    const stats: QueueStats = {
      totalQueued: totalQueued || 0,
      totalProcessing: totalProcessing || 0,
      queueByPriority,
      userPosition,
      estimatedWaitMinutes,
      recentThroughput: Math.round(recentThroughput * 10) / 10,
    };

    return new Response(
      JSON.stringify({
        success: true,
        ...stats,
        estimatedWaitByTier,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[queue-status] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
