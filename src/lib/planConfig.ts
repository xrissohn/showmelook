/**
 * 쇼미룩 구독 플랜 설정
 * 기존 플랜 (호환성 유지) + 구매 기반 등급 시스템과 통합
 * 
 * 등급 시스템: Free → Bronze → Silver → Gold → Platinum
 * - 구매 금액 기반으로 등급 상승
 * - 플래티넘 등급만 모델 프로필 추가 가능 (100만원당 1명)
 */

export type PlanType = 'free' | 'pro' | 'premium';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanConfig {
  name: string;
  nameKo: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number; // 퍼센트
  dailyLimit: number; // -1 = 무제한
  galleryLimit: number; // -1 = 무제한
  maxProfiles: number;
  canUseRecommendFirst: boolean;
  hasWatermark: boolean;
  hdDownload: boolean;
  historyDays: number; // -1 = 영구 보관
  priorityQueue: boolean;
  canUseFamilyProfiles: boolean;
  features: string[];
  highlightFeatures?: string[];
}

// 기존 플랜 설정 (호환성 유지 - 결제 시스템 준비 전까지)
export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameKo: '무료',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
    dailyLimit: 5,
    galleryLimit: 10,
    maxProfiles: 1,
    canUseRecommendFirst: false,
    hasWatermark: true,
    hdDownload: false,
    historyDays: 7,
    priorityQueue: false,
    canUseFamilyProfiles: false,
    features: [
      '일일 스타일 생성 5회',
      '갤러리 저장 10장',
      '스타일 히스토리 7일 보관',
      'AI 스타일 설명 제공',
    ],
    highlightFeatures: [],
  },
  pro: {
    name: 'Pro',
    nameKo: '프로',
    monthlyPrice: 4900,
    yearlyPrice: 49000, // 2개월 무료
    yearlyDiscount: 17,
    dailyLimit: 20,
    galleryLimit: 50,
    maxProfiles: 1,
    canUseRecommendFirst: true,
    hasWatermark: false,
    hdDownload: true,
    historyDays: 30,
    priorityQueue: false,
    canUseFamilyProfiles: false,
    features: [
      '일일 스타일 생성 20회',
      '스타일 추천 먼저 받기 ✨',
      '갤러리 저장 50장',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '스타일 히스토리 30일 보관',
    ],
    highlightFeatures: ['스타일 추천 먼저 받기 ✨'],
  },
  premium: {
    name: 'Premium',
    nameKo: '프리미엄',
    monthlyPrice: 9900,
    yearlyPrice: 99000, // 2개월 무료
    yearlyDiscount: 17,
    dailyLimit: -1, // 무제한
    galleryLimit: -1, // 무제한
    maxProfiles: 6, // 본인 + 5명
    canUseRecommendFirst: true,
    hasWatermark: false,
    hdDownload: true,
    historyDays: -1, // 영구 보관
    priorityQueue: true,
    canUseFamilyProfiles: true,
    features: [
      '무제한 스타일 생성',
      '스타일 추천 먼저 받기 ✨',
      '갤러리 무제한 저장',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '스타일 히스토리 영구 보관',
      '모델 프로필 최대 5명',
      '얼굴 합성 기능',
      '우선 생성 대기열',
    ],
    highlightFeatures: ['무제한 스타일 생성', '모델 프로필 최대 5명'],
  },
};

// 업그레이드 유도 메시지 (구매 기반 등급 시스템 반영)
export type UpgradeReason = 
  | 'recommend-first' 
  | 'daily-limit' 
  | 'gallery-limit' 
  | 'hd-download' 
  | 'family-profile'
  | 'family-limit';

export const UPGRADE_MESSAGES: Record<UpgradeReason, { title: string; description: string; recommendedPlan: PlanType; tierMessage: string }> = {
  'recommend-first': {
    title: '상품 추천만 먼저보기',
    description: '실버 등급 이상이면 생성 전에 AI가 추천하는 상품을 먼저 확인할 수 있어요!',
    recommendedPlan: 'pro',
    tierMessage: '쇼미룩에서 상품을 구매하면 등급이 올라가요!',
  },
  'daily-limit': {
    title: '일일 생성 한도 도달',
    description: '오늘의 생성 횟수를 모두 사용했어요. 등급이 높아지면 더 많이 생성할 수 있어요!',
    recommendedPlan: 'pro',
    tierMessage: '브론즈: 5회 → 실버: 10회 → 골드: 20회 → 플래티넘: 무제한',
  },
  'gallery-limit': {
    title: '갤러리 저장 한도 도달',
    description: '갤러리가 꽉 찼어요! 등급이 높아지면 더 많이 저장할 수 있어요.',
    recommendedPlan: 'pro',
    tierMessage: '무료: 10장 → 브론즈: 30장 → 실버: 50장 → 골드: 100장',
  },
  'hd-download': {
    title: '고화질 다운로드',
    description: '첫 구매 시 브론즈 등급부터 워터마크 없는 고화질 이미지를 다운로드할 수 있어요!',
    recommendedPlan: 'pro',
    tierMessage: '쇼미룩에서 상품을 구매하면 브론즈 등급이 됩니다.',
  },
  'family-profile': {
    title: '모델 프로필 추가',
    description: '소중한 사람을 위한 스타일 생성은 플래티넘 등급 전용이에요! 100만원당 1명씩 추가 가능해요.',
    recommendedPlan: 'premium',
    tierMessage: '누적 구매 100만원 이상 → 플래티넘 등급 (모델 프로필 추가 가능)',
  },
  'family-limit': {
    title: '모델 프로필 한도 도달',
    description: '100만원당 모델 프로필 1명을 추가할 수 있어요. 더 많은 구매로 슬롯을 늘려보세요!',
    recommendedPlan: 'premium',
    tierMessage: '누적 구매 금액이 높아질수록 더 많은 모델을 등록할 수 있어요.',
  },
};

// 가격 포맷팅 헬퍼
export const formatPrice = (price: number): string => {
  if (price === 0) return '무료';
  return `₩${price.toLocaleString()}`;
};

// 월 환산 가격 계산
export const getMonthlyEquivalent = (yearlyPrice: number): number => {
  return Math.round(yearlyPrice / 12);
};

// 연간 결제 시 절약 금액 계산
export const getYearlySavings = (monthlyPrice: number, yearlyPrice: number): number => {
  return (monthlyPrice * 12) - yearlyPrice;
};
