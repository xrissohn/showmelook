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
        maxProfiles: 6, // 본인 + 5명 (관리자도 동일)
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

  // 다운그레이드 시 초과 프로필에 대한 유예 기간 생성
  const createGracePeriodForExcessProfiles = useCallback(async (newMaxProfiles: number): Promise<{ success: boolean; excessCount: number }> => {
    if (!userId) return { success: false, excessCount: 0 };

    try {
      // 현재 가족 프로필 조회
      const { data: familyProfiles } = await supabase
        .from('family_profiles')
        .select('id, full_name, created_at')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true });

      if (!familyProfiles || familyProfiles.length === 0) {
        return { success: true, excessCount: 0 };
      }

      const maxFamily = newMaxProfiles - 1; // 본인 제외
      const excessCount = familyProfiles.length - maxFamily;

      if (excessCount <= 0) {
        return { success: true, excessCount: 0 };
      }

      // 초과된 프로필 ID들 (가장 오래된 것부터)
      const excessProfileIds = familyProfiles.slice(maxFamily).map(p => p.id);

      // 3일 유예 기간 생성
      const gracePeriodEndsAt = new Date();
      gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 3);

      // 기존 유예 기간이 있는지 확인
      const { data: existingGrace } = await supabase
        .from('profile_deletion_grace')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingGrace) {
        // 기존 유예 기간 업데이트
        await supabase
          .from('profile_deletion_grace')
          .update({
            profile_ids: excessProfileIds,
            grace_period_ends_at: gracePeriodEndsAt.toISOString(),
          })
          .eq('id', existingGrace.id);
      } else {
        // 새 유예 기간 생성
        await supabase
          .from('profile_deletion_grace')
          .insert({
            user_id: userId,
            profile_ids: excessProfileIds,
            grace_period_ends_at: gracePeriodEndsAt.toISOString(),
          });
      }

      console.log(`Grace period created for ${excessCount} excess profiles, ends at ${gracePeriodEndsAt.toISOString()}`);
      return { success: true, excessCount };
    } catch (error) {
      console.error('Failed to create grace period:', error);
      return { success: false, excessCount: 0 };
    }
  }, [userId]);

  return {
    ...state,
    refetch: fetchSubscription,
    checkGalleryLimit,
    checkFamilyProfileLimit,
    createGracePeriodForExcessProfiles,
  };
};
