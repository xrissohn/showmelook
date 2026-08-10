/**
 * SEO Configuration for ShowMeLook
 * Centralized meta tag configuration for all pages
 */

export interface PageSEO {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE_URL = 'https://showmelook.com';
const DEFAULT_OG_IMAGE = undefined;

export const SEO_CONFIG: Record<string, PageSEO> = {
  landing: {
    title: '쇼미룩 - AI 패션 스타일링 서비스 | ShowMeLook',
    description: 'AI가 당신에게 딱 맞는 패션 스타일을 제안합니다. 사진 한 장으로 트렌디한 스타일을 경험하고, 나만의 룩북을 완성하세요. 무료로 시작하기!',
    keywords: 'AI 패션, 스타일링, 패션 추천, 코디 추천, 룩북, 버추얼 피팅, 가상 피팅, showmelook, 쇼미룩, AI 스타일링, 패션 AI, 옷 추천',
    canonical: `${BASE_URL}/`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  style: {
    title: 'AI 스타일 생성 - 나만의 패션 룩 만들기 | 쇼미룩',
    description: 'AI가 당신의 체형과 취향에 맞는 완벽한 스타일을 생성합니다. 상황별, 계절별 맞춤 코디 추천으로 패션 고민을 해결하세요.',
    keywords: 'AI 코디 생성, 맞춤 스타일링, 패션 룩북, 스타일 추천, 체형별 코디, 상황별 패션',
    canonical: `${BASE_URL}/style`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  pricing: {
    title: '요금제 안내 - 구매로 등급 업그레이드 | 쇼미룩',
    description: '쇼미룩은 무료로 시작할 수 있어요. 추천 상품을 구매하면 등급이 올라가고 더 많은 스타일을 생성할 수 있습니다. 브론즈부터 플래티넘까지!',
    keywords: '쇼미룩 요금제, 등급 시스템, 무료 패션 스타일링, AI 패션 가격, 구매 등급',
    canonical: `${BASE_URL}/pricing`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  mypage: {
    title: '마이페이지 - 내 스타일 관리 | 쇼미룩',
    description: '생성한 스타일 히스토리, 찜한 상품, 등급 현황을 한눈에 확인하세요. 가족 프로필로 소중한 사람들의 스타일도 관리할 수 있어요.',
    keywords: '마이페이지, 스타일 히스토리, 찜목록, 등급 확인, 가족 프로필',
    canonical: `${BASE_URL}/mypage`,
    ogImage: DEFAULT_OG_IMAGE,
    noindex: true,
  },
  auth: {
    title: '로그인 / 회원가입 | 쇼미룩',
    description: '쇼미룩에 가입하고 AI 패션 스타일링을 무료로 시작하세요. 이메일로 간편하게 가입할 수 있습니다.',
    keywords: '쇼미룩 로그인, 회원가입, AI 패션 시작하기',
    canonical: `${BASE_URL}/auth`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  privacy: {
    title: '개인정보처리방침 | 쇼미룩',
    description: '쇼미룩 ShowMeLook의 개인정보처리방침을 안내합니다. 수집 항목, 이용 목적, 보관 기간, 파기 절차 등 고객님의 개인정보 보호 정책을 자세히 확인하세요.',
    canonical: `${BASE_URL}/privacy`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  terms: {
    title: '이용약관 | 쇼미룩',
    description: '쇼미룩 ShowMeLook 서비스 이용약관입니다. 회원의 권리와 의무, 서비스 제공 범위, 결제 및 환불 정책 등 이용 조건을 확인하실 수 있습니다.',
    canonical: `${BASE_URL}/terms`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  community: {
    title: '스타일 갤러리 - AI 추천 룩 모음 | 쇼미룩',
    description: '쇼미룩 사용자들이 AI로 생성한 다양한 패션 스타일을 한곳에서 만나보세요. 트렌디한 룩북에서 영감을 얻고, 마음에 드는 코디를 바로 따라 해볼 수 있어요.',
    keywords: '스타일 갤러리, AI 룩북, 패션 영감, 코디 모음, 사용자 룩, 커뮤니티',
    canonical: `${BASE_URL}/community`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  promo: {
    title: '쇼미룩 프로모 영상 | ShowMeLook',
    description: '쇼미룩 ShowMeLook AI 가상피팅 서비스의 프로모션 영상입니다. 사진 한 장으로 만드는 나만의 스타일, 영상으로 빠르게 확인해보세요.',
    canonical: `${BASE_URL}/promo`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  cart: {
    title: '장바구니 | 쇼미룩',
    description: '쇼미룩에서 추천받은 상품들을 장바구니에서 확인하세요.',
    canonical: `${BASE_URL}/cart`,
    ogImage: DEFAULT_OG_IMAGE,
    noindex: true,
  },
  profileSetup: {
    title: '프로필 설정 - 맞춤 스타일링 시작 | 쇼미룩',
    description: '체형과 스타일 취향을 입력하면 더 정확한 AI 패션 추천을 받을 수 있어요.',
    canonical: `${BASE_URL}/profile-setup`,
    ogImage: DEFAULT_OG_IMAGE,
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다 | 쇼미룩',
    description: '요청하신 페이지를 찾을 수 없습니다. 홈으로 돌아가서 AI 패션 스타일링을 경험해보세요.',
    ogImage: DEFAULT_OG_IMAGE,
  },
};

export const getPageSEO = (pageKey: string): PageSEO => {
  return SEO_CONFIG[pageKey] || SEO_CONFIG.landing;
};
