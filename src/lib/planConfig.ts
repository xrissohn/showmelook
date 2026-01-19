/**
 * 쇼미룩 구독 플랜 설정
 * 모든 플랜별 기능 제한 및 가격 정보
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
      '가족/애인 프로필 최대 5명',
      '가족 얼굴 합성 기능',
      '우선 생성 대기열',
    ],
    highlightFeatures: ['무제한 스타일 생성', '가족/애인 프로필 최대 5명'],
  },
};

// 업그레이드 유도 메시지
export type UpgradeReason = 
  | 'recommend-first' 
  | 'daily-limit' 
  | 'gallery-limit' 
  | 'hd-download' 
  | 'family-profile'
  | 'family-limit';

export const UPGRADE_MESSAGES: Record<UpgradeReason, { title: string; description: string; recommendedPlan: PlanType }> = {
  'recommend-first': {
    title: '스타일 추천 먼저 받기',
    description: 'Pro 멤버만 스타일 추천을 먼저 받을 수 있어요! 생성 전에 트렌디한 스타일을 미리 탐색해보세요.',
    recommendedPlan: 'pro',
  },
  'daily-limit': {
    title: '일일 생성 한도 초과',
    description: '오늘의 무료 생성을 모두 사용했어요! Pro로 업그레이드하면 매일 20회까지 생성할 수 있어요.',
    recommendedPlan: 'pro',
  },
  'gallery-limit': {
    title: '갤러리 저장 한도 초과',
    description: '갤러리가 꽉 찼어요! Pro로 업그레이드하면 50장까지 저장할 수 있어요.',
    recommendedPlan: 'pro',
  },
  'hd-download': {
    title: '고화질 다운로드',
    description: '고화질 다운로드는 Pro 전용이에요. 워터마크 없는 원본 이미지를 저장해보세요!',
    recommendedPlan: 'pro',
  },
  'family-profile': {
    title: '가족 프로필 추가',
    description: '가족/애인의 얼굴로 스타일 생성은 Premium 전용이에요! 소중한 사람 최대 5명까지 추가할 수 있어요.',
    recommendedPlan: 'premium',
  },
  'family-limit': {
    title: '가족 프로필 한도 초과',
    description: '가족 프로필은 최대 5명까지 추가할 수 있어요. (본인 포함 총 6명)',
    recommendedPlan: 'premium',
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
