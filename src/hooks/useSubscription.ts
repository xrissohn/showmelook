/**
 * useSubscription - 구독 상태 관리 훅
 * 플랜별 기능 제한 및 관리자 권한 처리
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PLAN_CONFIG, PlanType } from '@/lib/planConfig';

export interface SubscriptionState {
  plan: PlanType;
  isAdmin: boolean;
  isLoading: boolean;
  dailyLimit: number;
  galleryLimit: number;
  maxProfiles: number;
  canUseRecommendFirst: boolean;
  hasWatermark: boolean;
  hdDownload: boolean;
  historyDays: number;
  priorityQueue: boolean;
  canUseFamilyProfiles: boolean;
  billingCycle: 'monthly' | 'yearly' | null;
  currentPeriodEnd: Date | null;
}

export const useSubscription = (userId: string | undefined) => {
  const [state, setState] = useState<SubscriptionState>({
    plan: 'free',
    isAdmin: false,
    isLoading: true,
    dailyLimit: PLAN_CONFIG.free.dailyLimit,
    galleryLimit: PLAN_CONFIG.free.galleryLimit,
    maxProfiles: PLAN_CONFIG.free.maxProfiles,
    canUseRecommendFirst: PLAN_CONFIG.free.canUseRecommendFirst,
    hasWatermark: PLAN_CONFIG.free.hasWatermark,
    hdDownload: PLAN_CONFIG.free.hdDownload,
    historyDays: PLAN_CONFIG.free.historyDays,
    priorityQueue: PLAN_CONFIG.free.priorityQueue,
    canUseFamilyProfiles: PLAN_CONFIG.free.canUseFamilyProfiles,
    billingCycle: null,
    currentPeriodEnd: null,
  });

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // 1. 관리자 체크 (has_role RPC 함수 사용)
      let isAdmin = false;
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        
        isAdmin = !!roleData;
      } catch {
        // 역할 체크 실패 시 무시
      }

      // 2. 구독 정보 조회
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // 관리자는 Premium 권한
      const plan: PlanType = isAdmin ? 'premium' : ((subscription?.plan as PlanType) || 'free');
      const planConfig = PLAN_CONFIG[plan];

      // 관리자는 모든 제한 해제
      const effectiveConfig = isAdmin ? {
        dailyLimit: -1,
        galleryLimit: -1,
        maxProfiles: 100,
        canUseRecommendFirst: true,
        hasWatermark: false,
        hdDownload: true,
        historyDays: -1,
        priorityQueue: true,
        canUseFamilyProfiles: true,
      } : {
        dailyLimit: planConfig.dailyLimit,
        galleryLimit: planConfig.galleryLimit,
        maxProfiles: planConfig.maxProfiles,
        canUseRecommendFirst: planConfig.canUseRecommendFirst,
        hasWatermark: planConfig.hasWatermark,
        hdDownload: planConfig.hdDownload,
        historyDays: planConfig.historyDays,
        priorityQueue: planConfig.priorityQueue,
        canUseFamilyProfiles: planConfig.canUseFamilyProfiles,
      };

      setState({
        plan,
        isAdmin,
        isLoading: false,
        ...effectiveConfig,
        billingCycle: subscription?.billing_cycle as 'monthly' | 'yearly' | null,
        currentPeriodEnd: subscription?.current_period_end ? new Date(subscription.current_period_end) : null,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // 갤러리 저장 개수 체크
  const checkGalleryLimit = useCallback(async (): Promise<{ canSave: boolean; current: number; limit: number }> => {
    if (!userId) return { canSave: false, current: 0, limit: state.galleryLimit };
    
    if (state.galleryLimit === -1) {
      return { canSave: true, current: 0, limit: -1 };
    }

    const { count } = await supabase
      .from('generated_looks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const current = count || 0;
    return {
      canSave: current < state.galleryLimit,
      current,
      limit: state.galleryLimit,
    };
  }, [userId, state.galleryLimit]);

  // 가족 프로필 개수 체크
  const checkFamilyProfileLimit = useCallback(async (): Promise<{ canAdd: boolean; current: number; limit: number }> => {
    if (!userId) return { canAdd: false, current: 0, limit: state.maxProfiles - 1 };
    
    if (!state.canUseFamilyProfiles) {
      return { canAdd: false, current: 0, limit: 0 };
    }

    const { count } = await supabase
      .from('family_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', userId);

    const current = count || 0;
    const maxFamily = state.maxProfiles - 1; // 본인 제외
    return {
      canAdd: current < maxFamily,
      current,
      limit: maxFamily,
    };
  }, [userId, state.maxProfiles, state.canUseFamilyProfiles]);

  return {
    ...state,
    refetch: fetchSubscription,
    checkGalleryLimit,
    checkFamilyProfileLimit,
  };
};
