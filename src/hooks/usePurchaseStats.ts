/**
 * usePurchaseStats - 구매 통계 및 등급 정보 조회 훅
 * user_purchase_stats, tier_change_history 데이터를 가져옴
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TierType, TIER_CONFIG, calculateTierFromAmount, getAmountToNextTier, formatAmountKo, calculateModelProfileSlots } from '@/lib/tierConfig';

export interface TierChangeRecord {
  id: string;
  previousTier: TierType;
  newTier: TierType;
  changeReason: 'purchase' | 'refund' | 'admin';
  amountChange: number;
  relatedOrderId: string | null;
  createdAt: Date;
}

export interface PurchaseStats {
  totalPurchasedAmount: number;
  totalPurchases: number;
  currentTier: TierType;
  modelProfileSlots: number;
  pendingAmount: number;
  firstPurchaseAt: Date | null;
  lastTierChangeAt: Date | null;
  tierUpdatedAt: Date | null;
}

export interface UsePurchaseStatsResult {
  stats: PurchaseStats | null;
  tierHistory: TierChangeRecord[];
  isLoading: boolean;
  error: string | null;
  nextTierInfo: { nextTier: TierType | null; amountNeeded: number };
  progressToNextTier: number; // 0-100
  tierConfig: typeof TIER_CONFIG[TierType];
  refetch: () => Promise<void>;
  // 최근 등급 변동 감지용
  recentTierChange: TierChangeRecord | null;
  clearRecentTierChange: () => void;
}

export const usePurchaseStats = (userId: string | undefined): UsePurchaseStatsResult => {
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [tierHistory, setTierHistory] = useState<TierChangeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTierChange, setRecentTierChange] = useState<TierChangeRecord | null>(null);
  
  // 이전 등급 추적 (변동 감지용)
  const previousTierRef = useRef<TierType | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 병렬로 데이터 조회
      const [statsResult, historyResult] = await Promise.all([
        supabase
          .from('user_purchase_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('tier_change_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (statsResult.error && statsResult.error.code !== 'PGRST116') {
        throw statsResult.error;
      }

      // 통계 데이터 처리
      const statsData = statsResult.data;
      if (statsData) {
        const newStats: PurchaseStats = {
          totalPurchasedAmount: statsData.total_purchased_amount || 0,
          totalPurchases: statsData.total_purchases || 0,
          currentTier: (statsData.current_tier as TierType) || 'free',
          modelProfileSlots: statsData.model_profile_slots || 0,
          pendingAmount: statsData.pending_amount || 0,
          firstPurchaseAt: statsData.first_purchase_at ? new Date(statsData.first_purchase_at) : null,
          lastTierChangeAt: statsData.last_tier_change_at ? new Date(statsData.last_tier_change_at) : null,
          tierUpdatedAt: statsData.tier_updated_at ? new Date(statsData.tier_updated_at) : null,
        };

        // 등급 변동 감지
        if (previousTierRef.current !== null && previousTierRef.current !== newStats.currentTier) {
          // 등급이 변경됨 - 가장 최근 이력에서 가져오기
          const latestChange = historyResult.data?.[0];
          if (latestChange) {
            setRecentTierChange({
              id: latestChange.id,
              previousTier: latestChange.previous_tier as TierType,
              newTier: latestChange.new_tier as TierType,
              changeReason: latestChange.change_reason as 'purchase' | 'refund' | 'admin',
              amountChange: latestChange.amount_change,
              relatedOrderId: latestChange.related_order_id,
              createdAt: new Date(latestChange.created_at),
            });
          }
        }
        previousTierRef.current = newStats.currentTier;

        setStats(newStats);
      } else {
        // 구매 기록이 없는 경우 기본값
        setStats({
          totalPurchasedAmount: 0,
          totalPurchases: 0,
          currentTier: 'free',
          modelProfileSlots: 0,
          pendingAmount: 0,
          firstPurchaseAt: null,
          lastTierChangeAt: null,
          tierUpdatedAt: null,
        });
        previousTierRef.current = 'free';
      }

      // 등급 변동 이력 처리
      if (historyResult.data) {
        setTierHistory(
          historyResult.data.map((record) => ({
            id: record.id,
            previousTier: record.previous_tier as TierType,
            newTier: record.new_tier as TierType,
            changeReason: record.change_reason as 'purchase' | 'refund' | 'admin',
            amountChange: record.amount_change,
            relatedOrderId: record.related_order_id,
            createdAt: new Date(record.created_at),
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching purchase stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch purchase stats');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 다음 등급까지 정보 계산
  const totalAmount = stats?.totalPurchasedAmount || 0;
  const nextTierInfo = getAmountToNextTier(totalAmount);
  const currentTier = stats?.currentTier || 'free';
  const tierConfig = TIER_CONFIG[currentTier];

  // 진행률 계산 (0-100)
  let progressToNextTier = 0;
  if (nextTierInfo.nextTier) {
    const nextTierConfig = TIER_CONFIG[nextTierInfo.nextTier];
    const currentTierMin = tierConfig.minAmount;
    const nextTierMin = nextTierConfig.minAmount;
    const range = nextTierMin - currentTierMin;
    if (range > 0) {
      progressToNextTier = Math.min(100, Math.round(((totalAmount - currentTierMin) / range) * 100));
    }
  } else {
    // 이미 플래티넘인 경우 - 다음 슬롯까지의 진행률
    const currentSlots = calculateModelProfileSlots(totalAmount);
    const nextSlotAmount = (currentSlots + 1) * 1000000;
    const prevSlotAmount = currentSlots * 1000000;
    progressToNextTier = Math.round(((totalAmount - prevSlotAmount) / (nextSlotAmount - prevSlotAmount)) * 100);
  }

  const clearRecentTierChange = useCallback(() => {
    setRecentTierChange(null);
  }, []);

  return {
    stats,
    tierHistory,
    isLoading,
    error,
    nextTierInfo,
    progressToNextTier,
    tierConfig,
    refetch: fetchStats,
    recentTierChange,
    clearRecentTierChange,
  };
};
