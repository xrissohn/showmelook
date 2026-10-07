/**
 * 구매 등급에서 계산하는 실제 혜택. 요금제는 구독이 아니라 누적 구매 금액 기준 등급제다.
 * 수치는 supabase/functions/_shared/serviceFacts.ts(TIER_FACTS)에서 온다.
 */
import { TIER_CONFIG, type TierType } from './tierConfig';

export interface TierBenefits {
  tier: TierType;
  isAdmin: boolean;
  dailyLimit: number; // -1 = 무제한
  hasWatermark: boolean;
  canUseRecommendFirst: boolean; // 상품 추천만 먼저보기
  canUseFamilyProfiles: boolean; // 모델 프로필 추가
  maxProfiles: number; // 본인 포함
  priorityQueue: boolean;
}

/** 관리자는 플래티넘 이상으로 본다. 모델 프로필은 본인 + 100만원당 1명(슬롯). */
export function getTierBenefits(tier: TierType, opts: { isAdmin?: boolean; modelProfileSlots?: number } = {}): TierBenefits {
  const isAdmin = !!opts.isAdmin;
  const cfg = TIER_CONFIG[isAdmin ? 'platinum' : tier];
  const slots = Math.max(0, opts.modelProfileSlots ?? 0);
  return {
    tier,
    isAdmin,
    dailyLimit: cfg.dailyLimit,
    hasWatermark: cfg.hasWatermark,
    canUseRecommendFirst: cfg.canPreviewRecommendations,
    canUseFamilyProfiles: cfg.modelProfiles === -1,
    maxProfiles: cfg.modelProfiles === -1 ? 1 + slots : 1,
    priorityQueue: tier === 'platinum' || isAdmin,
  };
}
