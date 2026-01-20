// 제휴 문구 헬퍼

export type AffiliateType = 'coupang' | 'linkprice';

/**
 * 상품 URL 또는 merchant_id로 제휴사 타입 판별
 */
export function getAffiliateType(productUrl?: string | null, merchantId?: string | null): AffiliateType {
  // merchant_id로 먼저 확인
  if (merchantId?.toLowerCase() === 'coupang') {
    return 'coupang';
  }
  
  // product_url로 확인
  if (productUrl?.includes('coupang.com')) {
    return 'coupang';
  }
  
  return 'linkprice';
}

/**
 * 제휴사 타입에 따른 공시 문구 반환
 */
export function getAffiliateDisclosureText(affiliateType: AffiliateType): string {
  if (affiliateType === 'coupang') {
    return "이 제품은 '쿠팡 파트너스' 활동의 일환으로, 구매 시 일정 수수료를 제공받을 수 있습니다.";
  }
  return "이 제품은 '링크프라이스' 활동의 일환으로, 구매 시 일정 수수료를 제공받을 수 있습니다.";
}

/**
 * 상품 정보로 제휴 공시 문구 바로 반환
 */
export function getProductAffiliateDisclosure(productUrl?: string | null, merchantId?: string | null): string {
  const affiliateType = getAffiliateType(productUrl, merchantId);
  return getAffiliateDisclosureText(affiliateType);
}
