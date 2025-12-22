import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenerationLimit {
  isPremium: boolean;
  dailyLimit: number;
  currentCount: number;
  remainingCount: number;
  isLoading: boolean;
  canGenerate: boolean;
}

export const useGenerationLimit = (userId: string | undefined) => {
  const [limit, setLimit] = useState<GenerationLimit>({
    isPremium: false,
    dailyLimit: 5,
    currentCount: 0,
    remainingCount: 5,
    isLoading: true,
    canGenerate: true,
  });

  const fetchLimit = useCallback(async () => {
    if (!userId) {
      setLimit(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      const isPremium = subscription?.plan === 'premium';
      const dailyLimit = isPremium ? Infinity : (subscription?.daily_limit || 5);

      // Fetch today's usage
      const { data: usage } = await supabase
        .from('daily_generation_usage')
        .select('*')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .single();

      const currentCount = usage?.generation_count || 0;
      const remainingCount = isPremium ? -1 : Math.max(0, dailyLimit - currentCount);

      setLimit({
        isPremium,
        dailyLimit: isPremium ? -1 : dailyLimit,
        currentCount,
        remainingCount,
        isLoading: false,
        canGenerate: isPremium || currentCount < dailyLimit,
      });
    } catch (error) {
      console.error('Error fetching generation limit:', error);
      // Default to allowing generation if there's an error
      setLimit({
        isPremium: false,
        dailyLimit: 5,
        currentCount: 0,
        remainingCount: 5,
        isLoading: false,
        canGenerate: true,
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchLimit();
  }, [fetchLimit]);

  const updateAfterGeneration = useCallback((isPremium: boolean, remaining: number) => {
    setLimit(prev => ({
      ...prev,
      currentCount: prev.currentCount + 1,
      remainingCount: isPremium ? -1 : remaining,
      canGenerate: isPremium || remaining > 0,
    }));
  }, []);

  return { ...limit, refetch: fetchLimit, updateAfterGeneration };
};
