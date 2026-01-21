import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface BonusCredits {
  total: number;
  details: Array<{
    id: string;
    remaining: number;
    expires_at: string | null;
  }>;
}

interface GenerationLimit {
  isPremium: boolean;
  dailyLimit: number;
  currentCount: number;
  remainingCount: number;
  bonusCredits: number;
  totalRemaining: number;
  isLoading: boolean;
  canGenerate: boolean;
}

export const useGenerationLimit = (userId: string | undefined) => {
  const [limit, setLimit] = useState<GenerationLimit>({
    isPremium: false,
    dailyLimit: 5,
    currentCount: 0,
    remainingCount: 5,
    bonusCredits: 0,
    totalRemaining: 5,
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
      const baseRemaining = isPremium ? -1 : Math.max(0, dailyLimit - currentCount);

      // Fetch bonus credits (non-premium only)
      let bonusCredits = 0;
      if (!isPremium) {
        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/get-bonus-credits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const result = await response.json();
          if (result.success) {
            bonusCredits = result.total || 0;
          }
        } catch (e) {
          console.error('Failed to fetch bonus credits:', e);
        }
      }

      const totalRemaining = isPremium ? -1 : baseRemaining + bonusCredits;

      setLimit({
        isPremium,
        dailyLimit: isPremium ? -1 : dailyLimit,
        currentCount,
        remainingCount: baseRemaining,
        bonusCredits,
        totalRemaining,
        isLoading: false,
        canGenerate: isPremium || totalRemaining > 0,
      });
    } catch (error) {
      console.error('Error fetching generation limit:', error);
      // Default to allowing generation if there's an error
      setLimit({
        isPremium: false,
        dailyLimit: 5,
        currentCount: 0,
        remainingCount: 5,
        bonusCredits: 0,
        totalRemaining: 5,
        isLoading: false,
        canGenerate: true,
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchLimit();
  }, [fetchLimit]);

  // 보너스 크레딧 소비 함수
  const consumeBonusCredit = useCallback(async (): Promise<{ success: boolean; remaining: number }> => {
    if (!userId) return { success: false, remaining: 0 };

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/consume-bonus-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = await response.json();
      
      if (result.success) {
        setLimit(prev => ({
          ...prev,
          bonusCredits: result.remaining_total,
          totalRemaining: prev.remainingCount + result.remaining_total,
          canGenerate: prev.isPremium || (prev.remainingCount + result.remaining_total) > 0,
        }));
        return { success: true, remaining: result.remaining_total };
      }
      return { success: false, remaining: limit.bonusCredits };
    } catch (error) {
      console.error('Error consuming bonus credit:', error);
      return { success: false, remaining: limit.bonusCredits };
    }
  }, [userId, limit.bonusCredits]);

  const updateAfterGeneration = useCallback((isPremium: boolean, remaining: number, usedBonus: boolean = false) => {
    setLimit(prev => {
      const newBonusCredits = usedBonus ? Math.max(0, prev.bonusCredits - 1) : prev.bonusCredits;
      const newCurrentCount = usedBonus ? prev.currentCount : prev.currentCount + 1;
      const newRemainingCount = usedBonus ? prev.remainingCount : Math.max(0, prev.remainingCount - 1);
      const newTotalRemaining = isPremium ? -1 : newRemainingCount + newBonusCredits;
      
      return {
        ...prev,
        currentCount: newCurrentCount,
        remainingCount: newRemainingCount,
        bonusCredits: newBonusCredits,
        totalRemaining: newTotalRemaining,
        canGenerate: isPremium || newTotalRemaining > 0,
      };
    });
  }, []);

  return { 
    ...limit, 
    refetch: fetchLimit, 
    updateAfterGeneration,
    consumeBonusCredit,
  };
};
