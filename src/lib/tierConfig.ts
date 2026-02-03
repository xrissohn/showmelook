/**
 * 쇼미룩 구매 기반 5단계 등급 설정
 * Free → Bronze → Silver → Gold → Platinum
 */

export type TierType = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum';

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
    name: 'Free',
    nameKo: '무료',
    minAmount: 0,
    dailyLimit: 5,
    monthlyLimit: 25,
    galleryLimit: 10,
    hasWatermark: true,
    hdDownload: false,
    historyDays: 7,
    modelProfiles: 0,
    canPreviewRecommendations: false,
    badgeColor: 'bg-gray-500',
    features: [
      '일일 스타일 생성 5회',
      '월간 스타일 생성 25회',
      '갤러리 저장 10장',
      '스타일 히스토리 7일 보관',
    ],
  },
  bronze: {
    name: 'Bronze',
    nameKo: '브론즈',
    minAmount: 1,
    dailyLimit: 5,
    monthlyLimit: -1, // 무제한
    galleryLimit: 30,
    hasWatermark: false,
    hdDownload: true,
    historyDays: 30,
    modelProfiles: 0,
    canPreviewRecommendations: false,
    badgeColor: 'bg-amber-700',
    features: [
      '일일 스타일 생성 5회',
      '월간 스타일 생성 무제한',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '갤러리 저장 30장',
      '스타일 히스토리 30일 보관',
    ],
    highlightFeatures: ['월간 무제한', '워터마크 제거'],
  },
  silver: {
    name: 'Silver',
    nameKo: '실버',
    minAmount: 100000, // 10만원
    dailyLimit: 10,
    monthlyLimit: -1,
    galleryLimit: 50,
    hasWatermark: false,
    hdDownload: true,
    historyDays: 90,
    modelProfiles: 0,
    canPreviewRecommendations: true,
    badgeColor: 'bg-gray-400',
    features: [
      '일일 스타일 생성 10회',
      '월간 스타일 생성 무제한',
      '상품 추천만 먼저보기 ✨',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '갤러리 저장 50장',
      '스타일 히스토리 90일 보관',
    ],
    highlightFeatures: ['일일 10회', '상품 추천만 먼저보기 ✨'],
  },
  gold: {
    name: 'Gold',
    nameKo: '골드',
    minAmount: 300000, // 30만원
    dailyLimit: 20,
    monthlyLimit: -1,
    galleryLimit: 100,
    hasWatermark: false,
    hdDownload: true,
    historyDays: -1, // 영구 보관
    modelProfiles: 0,
    canPreviewRecommendations: true,
    badgeColor: 'bg-yellow-500',
    features: [
      '일일 스타일 생성 20회',
      '월간 스타일 생성 무제한',
      '상품 추천만 먼저보기 ✨',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '갤러리 저장 100장',
      '스타일 히스토리 영구 보관',
    ],
    highlightFeatures: ['일일 20회', '히스토리 영구 보관'],
  },
  platinum: {
    name: 'Platinum',
    nameKo: '플래티넘',
    minAmount: 1000000, // 100만원
    dailyLimit: -1, // 무제한
    monthlyLimit: -1,
    galleryLimit: -1,
    hasWatermark: false,
    hdDownload: true,
    historyDays: -1,
    modelProfiles: -1, // 동적 계산: 100만원당 1명
    canPreviewRecommendations: true,
    badgeColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
    features: [
      '무제한 스타일 생성',
      '모든 기능 무제한',
      '상품 추천만 먼저보기 ✨',
      '워터마크 없는 이미지',
      '고화질 다운로드',
      '갤러리 무제한 저장',
      '스타일 히스토리 영구 보관',
      '모델 프로필 추가 (100만원당 +1명)',
      '우선 생성 대기열',
    ],
    highlightFeatures: ['모든 기능 무제한', '모델 프로필 추가'],
  },
};

// 등급 순서 (다운그레이드/업그레이드 비교용)
export const TIER_ORDER: TierType[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];

// 누적 금액으로 등급 계산
export const calculateTierFromAmount = (totalAmount: number): TierType => {
  if (totalAmount >= 1000000) return 'platinum';
  if (totalAmount >= 300000) return 'gold';
  if (totalAmount >= 100000) return 'silver';
  if (totalAmount >= 1) return 'bronze';
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
    { tier: 'bronze' as TierType, amount: 1 },
    { tier: 'silver' as TierType, amount: 100000 },
    { tier: 'gold' as TierType, amount: 300000 },
    { tier: 'platinum' as TierType, amount: 1000000 },
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
