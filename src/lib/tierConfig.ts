/**
 * 쇼미룩 구매 기반 5단계 등급 설정
 * Free → Bronze → Silver → Gold → Platinum
 */

import { TIER_FACTS, tierFeaturesKo, type TierId } from '../../supabase/functions/_shared/serviceFacts';

// 수치는 supabase/functions/_shared/serviceFacts.ts 한 곳에서 관리한다(쇼미 챗과 공유).
export type TierType = TierId;

export interface TierConfig {
  name: string;
  nameKo: string;
  minAmount: number; // 최소 누적 구매 금액
  dailyLimit: number; // -1 = 무제한
  monthlyLimit: number; // -1 = 무제한
  galleryLimit: number; // -1 = 무제한
  hasWatermark: boolean;
  hdDownload: boolean;
  historyDays: number; // -1 = 영구 보관
  modelProfiles: number; // 0 = 본인만, -1 = 동적 계산
  canPreviewRecommendations: boolean; // 상품 추천만 먼저보기
  badgeColor: string; // Tailwind 색상 클래스
  features: string[];
  highlightFeatures?: string[];
}

export const TIER_CONFIG: Record<TierType, TierConfig> = {
  free: {
    name: TIER_FACTS.free.nameEn,
    nameKo: TIER_FACTS.free.nameKo,
    minAmount: TIER_FACTS.free.minAmount,
    dailyLimit: TIER_FACTS.free.dailyLimit,
    monthlyLimit: TIER_FACTS.free.monthlyLimit,
    galleryLimit: TIER_FACTS.free.galleryLimit,
    hasWatermark: TIER_FACTS.free.hasWatermark,
    hdDownload: TIER_FACTS.free.hdDownload,
    historyDays: TIER_FACTS.free.historyDays,
    modelProfiles: 0,
    canPreviewRecommendations: TIER_FACTS.free.canPreviewRecommendations,
    badgeColor: 'bg-gray-500',
    features: tierFeaturesKo('free'),
  },
  bronze: {
    name: TIER_FACTS.bronze.nameEn,
    nameKo: TIER_FACTS.bronze.nameKo,
    minAmount: TIER_FACTS.bronze.minAmount,
    dailyLimit: TIER_FACTS.bronze.dailyLimit,
    monthlyLimit: TIER_FACTS.bronze.monthlyLimit,
    galleryLimit: TIER_FACTS.bronze.galleryLimit,
    hasWatermark: TIER_FACTS.bronze.hasWatermark,
    hdDownload: TIER_FACTS.bronze.hdDownload,
    historyDays: TIER_FACTS.bronze.historyDays,
    modelProfiles: 0,
    canPreviewRecommendations: TIER_FACTS.bronze.canPreviewRecommendations,
    badgeColor: 'bg-amber-700',
    features: tierFeaturesKo('bronze'),
    highlightFeatures: ['월간 무제한', '워터마크 제거'],
  },
  silver: {
    name: TIER_FACTS.silver.nameEn,
    nameKo: TIER_FACTS.silver.nameKo,
    minAmount: TIER_FACTS.silver.minAmount,
    dailyLimit: TIER_FACTS.silver.dailyLimit,
    monthlyLimit: TIER_FACTS.silver.monthlyLimit,
    galleryLimit: TIER_FACTS.silver.galleryLimit,
    hasWatermark: TIER_FACTS.silver.hasWatermark,
    hdDownload: TIER_FACTS.silver.hdDownload,
    historyDays: TIER_FACTS.silver.historyDays,
    modelProfiles: 0,
    canPreviewRecommendations: TIER_FACTS.silver.canPreviewRecommendations,
    badgeColor: 'bg-gray-400',
    features: tierFeaturesKo('silver'),
    highlightFeatures: ['일일 10회', '상품 추천만 먼저보기 ✨'],
  },
  gold: {
    name: TIER_FACTS.gold.nameEn,
    nameKo: TIER_FACTS.gold.nameKo,
    minAmount: TIER_FACTS.gold.minAmount,
    dailyLimit: TIER_FACTS.gold.dailyLimit,
    monthlyLimit: TIER_FACTS.gold.monthlyLimit,
    galleryLimit: TIER_FACTS.gold.galleryLimit,
    hasWatermark: TIER_FACTS.gold.hasWatermark,
    hdDownload: TIER_FACTS.gold.hdDownload,
    historyDays: TIER_FACTS.gold.historyDays,
    modelProfiles: 0,
    canPreviewRecommendations: TIER_FACTS.gold.canPreviewRecommendations,
    badgeColor: 'bg-yellow-500',
    features: tierFeaturesKo('gold'),
    highlightFeatures: ['일일 20회', '히스토리 영구 보관'],
  },
  platinum: {
    name: TIER_FACTS.platinum.nameEn,
    nameKo: TIER_FACTS.platinum.nameKo,
    minAmount: TIER_FACTS.platinum.minAmount,
    dailyLimit: TIER_FACTS.platinum.dailyLimit,
    monthlyLimit: TIER_FACTS.platinum.monthlyLimit,
    galleryLimit: TIER_FACTS.platinum.galleryLimit,
    hasWatermark: TIER_FACTS.platinum.hasWatermark,
    hdDownload: TIER_FACTS.platinum.hdDownload,
    historyDays: TIER_FACTS.platinum.historyDays,
    modelProfiles: -1, // 동적 계산: 100만원당 1명
    canPreviewRecommendations: TIER_FACTS.platinum.canPreviewRecommendations,
    badgeColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
    features: tierFeaturesKo('platinum'),
    highlightFeatures: ['모든 기능 무제한', '모델 프로필 추가'],
  },
};

// 등급 순서 (다운그레이드/업그레이드 비교용)
export const TIER_ORDER: TierType[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];

// 누적 금액으로 등급 계산
export const calculateTierFromAmount = (totalAmount: number): TierType => {
  for (const tier of [...TIER_ORDER].reverse()) {
    if (tier !== 'free' && totalAmount >= TIER_CONFIG[tier].minAmount) return tier;
  }
  return 'free';
};

// 모델 프로필 슬롯 계산 (플래티넘: 100만원당 1명)
export const calculateModelProfileSlots = (totalAmount: number): number => {
  if (totalAmount >= 1000000) {
    return Math.floor(totalAmount / 1000000);
  }
  return 0;
};

// 다음 등급까지 필요 금액
export const getAmountToNextTier = (currentAmount: number): { nextTier: TierType | null; amountNeeded: number } => {
  const thresholds = [
    ...TIER_ORDER.filter((t) => t !== 'free').map((tier) => ({ tier, amount: TIER_CONFIG[tier].minAmount })),
  ];

  for (const { tier, amount } of thresholds) {
    if (currentAmount < amount) {
      return { nextTier: tier, amountNeeded: amount - currentAmount };
    }
  }

  // 이미 플래티넘
  const nextSlotAmount = (Math.floor(currentAmount / 1000000) + 1) * 1000000;
  return { nextTier: null, amountNeeded: nextSlotAmount - currentAmount };
};

// 등급 비교 (업그레이드/다운그레이드 판단)
export const compareTiers = (tier1: TierType, tier2: TierType): number => {
  return TIER_ORDER.indexOf(tier1) - TIER_ORDER.indexOf(tier2);
};

// 금액 포맷팅 (한국어)
export const formatAmountKo = (amount: number): string => {
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
};

// 금액 포맷팅 (영어)
export const formatAmountEn = (amount: number): string => {
  if (amount >= 1000000) {
    const m = amount / 1000000;
    return `₩${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return `₩${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `₩${amount.toLocaleString()}`;
};

// 언어별 금액 포맷팅
export const formatAmount = (amount: number, language: 'ko' | 'en'): string => {
  return language === 'en' ? formatAmountEn(amount) : formatAmountKo(amount);
};

// 등급명 (언어별)
export const getTierName = (tier: TierType, language: 'ko' | 'en'): string => {
  const config = TIER_CONFIG[tier];
  return language === 'en' ? config.name : config.nameKo;
};

// 등급별 혜택 요약 (업그레이드 모달용)
export const getTierBenefitsSummary = (tier: TierType): string[] => {
  switch (tier) {
    case 'bronze':
      return ['월간 생성 무제한', '워터마크 제거', '고화질 다운로드'];
    case 'silver':
      return ['일일 생성 10회로 증가', '상품 추천만 먼저보기', '갤러리 50장'];
    case 'gold':
      return ['일일 생성 20회로 증가', '갤러리 100장', '히스토리 영구 보관'];
    case 'platinum':
      return ['모든 기능 무제한', '모델 프로필 추가 가능', '우선 대기열'];
    default:
      return [];
  }
};
