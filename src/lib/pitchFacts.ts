// Read-only snapshot, not live recommendation eligibility.
export const PITCH_CATALOG = {
  asOf: '2026-10-12', totalProducts: 10553, activeProducts: 9759,
  dnaProducts: 10553, activeDnaProducts: 9759,
} as const;

export const PITCH_ROADMAP = [
  { period: '2026 Q4 · 10~12월', items: ['구매 직전 재고 확인 고도화', '활성 상품·DNA 품질 관리', 'A/B 테스트·구매 전환 검증', '설치형 PWA 운영 안정화'], color: 'sky' },
  { period: '2027 Q1 · 1~3월', items: ['Cafe24 앱스토어 출시 추진', 'B2B 파일럿 모집·전환 검증', '푸시 알림 도입 검토', '인플루언서 캠페인 검증'], color: 'coral' },
  { period: '2027 Q2~Q3 · 4~9월', items: ['B2B SaaS 정식 출시 추진', '일본·동남아 진출 검증', 'WebXR AR 피팅 R&D 검토', 'MAU 10만·B2B 10곳 목표'], color: 'primary' },
] as const;