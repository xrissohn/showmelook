/**
 * useTierBenefits - 구매 등급(누적 구매 금액) 기준 혜택 훅
 * 요금제는 구독이 아니라 구매 등급제다. 불러오는 동안은 무료 등급 혜택으로 본다.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { getTierBenefits, type TierBenefits } from '@/lib/tierBenefits';
import type { TierType } from '@/lib/tierConfig';

export const useTierBenefits = (userId: string | undefined): TierBenefits & { isLoading: boolean } => {
  const { isAdmin, isLoading: adminLoading } = useAdminRole(userId);
  const [stats, setStats] = useState<{ tier: TierType; slots: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      setStatsLoading(false);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('user_purchase_stats')
          .select('current_tier, model_profile_slots')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled) {
          setStats(data ? { tier: (data.current_tier as TierType) || 'free', slots: data.model_profile_slots || 0 } : null);
        }
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const benefits = getTierBenefits(stats?.tier ?? 'free', { isAdmin, modelProfileSlots: stats?.slots });
  return { ...benefits, isLoading: adminLoading || statsLoading };
};
