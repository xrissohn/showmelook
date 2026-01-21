/**
 * useReferral - 친구 추천 코드 관리 훅
 * 추천 코드 조회, 적용, 보너스 크레딧 관리
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ReferralCode {
  code: string;
  used_count: number;
  max_uses: number;
  is_active: boolean;
}

interface BonusCredit {
  id: string;
  remaining: number;
  expires_at: string | null;
  is_permanent: boolean;
  referral_code: string;
}

interface ReferralState {
  referralCode: ReferralCode | null;
  bonusCredits: {
    total: number;
    details: BonusCredit[];
  };
  referralCount: number;
  isLoading: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const useReferral = (userId: string | undefined) => {
  const [state, setState] = useState<ReferralState>({
    referralCode: null,
    bonusCredits: { total: 0, details: [] },
    referralCount: 0,
    isLoading: true,
  });

  const fetchReferralData = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // 1. 내 추천 코드 조회 또는 생성 (Edge Function 호출)
      let codeData = null;
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-referral-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        const result = await response.json();
        if (result.success) {
          codeData = {
            code: result.code,
            used_count: result.used_count,
            max_uses: result.max_uses,
            is_active: result.is_active,
          };
        }
      } catch (e) {
        console.error('Failed to fetch/generate referral code:', e);
      }

      // 2. 보너스 크레딧 조회 (Edge Function 호출)
      let bonusData = { total: 0, details: [] };
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-bonus-credits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        const result = await response.json();
        if (result.success) {
          bonusData = { total: result.total, details: result.details };
        }
      } catch (e) {
        console.error('Failed to fetch bonus credits:', e);
      }

      // 3. 추천 횟수 조회 (내가 추천한 사람 수)
      const { count: referralCount } = await supabase
        .from('referral_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('referral_code', codeData?.code || '');

      setState({
        referralCode: codeData,
        bonusCredits: bonusData,
        referralCount: referralCount || 0,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  // 보너스 크레딧 소비
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
        setState(prev => ({
          ...prev,
          bonusCredits: {
            ...prev.bonusCredits,
            total: result.remaining_total,
          },
        }));
        return { success: true, remaining: result.remaining_total };
      }
      return { success: false, remaining: state.bonusCredits.total };
    } catch (error) {
      console.error('Error consuming bonus credit:', error);
      return { success: false, remaining: state.bonusCredits.total };
    }
  }, [userId, state.bonusCredits.total]);

  // 추천 코드 적용 (가입 시 호출)
  const applyReferralCode = useCallback(async (
    code: string,
    newUserId: string,
    newUserEmail: string,
    newUserName: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/apply-referral-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: code,
          new_user_id: newUserId,
          new_user_email: newUserEmail,
          new_user_name: newUserName,
        }),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error applying referral code:', error);
      return { success: false, error: '추천 코드 적용 중 오류가 발생했습니다.' };
    }
  }, []);

  // 코드 복사
  const copyReferralCode = useCallback(async (): Promise<boolean> => {
    if (!state.referralCode?.code) return false;
    
    try {
      await navigator.clipboard.writeText(state.referralCode.code);
      return true;
    } catch {
      return false;
    }
  }, [state.referralCode?.code]);

  return {
    ...state,
    refetch: fetchReferralData,
    consumeBonusCredit,
    applyReferralCode,
    copyReferralCode,
  };
};
