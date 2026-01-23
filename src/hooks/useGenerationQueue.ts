import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GenerationJob {
  id: string;
  user_id: string;
  status: 'queued' | 'processing' | 'generating_style' | 'generating_image' | 'completed' | 'failed';
  progress: number;
  result_url: string | null;
  result_payload: any;
  error_message: string | null;
  created_at: string;
}

interface UseGenerationQueueResult {
  currentJob: GenerationJob | null;
  isQueued: boolean;
  isProcessing: boolean;
  progress: number;
  submitJob: (payload: any) => Promise<string | null>;
  cancelJob: (jobId: string) => Promise<void>;
}

export const useGenerationQueue = (userId: string | undefined): UseGenerationQueueResult => {
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const { toast } = useToast();

  // Subscribe to realtime updates for user's jobs
  useEffect(() => {
    if (!userId) return;

    // Fetch current active job
    const fetchActiveJob = async () => {
      const { data } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['queued', 'processing', 'generating_style', 'generating_image'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setCurrentJob(data as GenerationJob);
      }
    };

    fetchActiveJob();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`generation-jobs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const job = payload.new as GenerationJob;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setCurrentJob(job);
            
            // Show toast on completion
            if (job.status === 'completed') {
              toast({
                title: '✨ 스타일 생성 완료!',
                description: '새로운 룩이 준비되었습니다.',
              });
              
              // Clear after showing
              setTimeout(() => setCurrentJob(null), 3000);
            } else if (job.status === 'failed') {
              toast({
                title: '생성 실패',
                description: job.error_message || '다시 시도해주세요.',
                variant: 'destructive',
              });
              
              setTimeout(() => setCurrentJob(null), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  const submitJob = useCallback(async (payload: any): Promise<string | null> => {
    if (!userId) return null;

    try {
      // Check if user already has an active job
      const { data: existingJob } = await supabase
        .from('generation_jobs')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['queued', 'processing', 'generating_style', 'generating_image'])
        .single();

      if (existingJob) {
        toast({
          title: '이미 처리 중인 작업이 있습니다',
          description: '현재 작업이 완료된 후 다시 시도해주세요.',
          variant: 'destructive',
        });
        return null;
      }

      // Create new job
      const { data: job, error } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: userId,
          status: 'queued',
          progress: 0,
          priority: 5, // TODO: Premium users get lower (higher priority) number
          request_payload: payload,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: '🎨 스타일 생성 시작',
        description: '잠시만 기다려주세요...',
      });

      return job?.id || null;
    } catch (error) {
      console.error('Failed to submit job:', error);
      toast({
        title: '작업 등록 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
      return null;
    }
  }, [userId, toast]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await supabase
        .from('generation_jobs')
        .update({ 
          status: 'failed', 
          error_message: 'Cancelled by user',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      setCurrentJob(null);
      
      toast({
        title: '작업 취소됨',
        description: '스타일 생성이 취소되었습니다.',
      });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  }, [toast]);

  return {
    currentJob,
    isQueued: currentJob?.status === 'queued',
    isProcessing: ['processing', 'generating_style', 'generating_image'].includes(currentJob?.status || ''),
    progress: currentJob?.progress || 0,
    submitJob,
    cancelJob,
  };
};
