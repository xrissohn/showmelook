# 구매 기반 등급 시스템 구현 현황

## ✅ 완료된 작업

### Phase 1: 데이터베이스 마이그레이션
- [x] `purchase_intents` 테이블 생성 (구매 클릭 추적)
- [x] `user_purchase_stats` 테이블 생성 (누적 구매 통계)
- [x] `tier_change_history` 테이블 생성 (등급 변동 이력)
- [x] `monthly_generation_usage` 테이블 생성 (월간 사용량)
- [x] `user_subscriptions` 테이블 확장 (5단계 등급 지원)
- [x] `calculate_user_tier` DB 함수 생성
- [x] `calculate_model_profile_slots` DB 함수 생성
- [x] RLS 정책 설정

### Phase 2: Edge Functions
- [x] `deeplink` 함수 수정 - tracking_id 생성 및 purchase_intents 기록
- [x] `linkprice-postback` 함수 생성 - 구매 확정/취소 처리
  - confirmed: 등급 업그레이드, 이력 기록, 슬롯 계산
  - cancelled: 등급 롤백, 유예 기간 생성

### Phase 3: 프론트엔드 설정
- [x] `src/lib/tierConfig.ts` 생성 - 5단계 등급 설정
- [x] `src/components/subscription/TierPolicyNotice.tsx` 생성 - 등급 정책 안내

### Phase 4: Pricing 페이지 개편
- [x] 5단계 등급 프로그레스 표시
- [x] 등급별 혜택 카드 UI
- [x] 등급별 기능 비교 테이블
- [x] 등급 정책 안내 (TierPolicyNotice) 추가
- [x] FAQ 업데이트 (구매 기반 시스템 관련)

---

## 🔄 다음 단계 (선택적)

### useSubscription 훅 확장
- [ ] `user_purchase_stats` 조회 통합
- [ ] 동적 등급 및 모델 프로필 슬롯 반환

### MyPage 등급 표시
- [ ] 현재 등급 배지 표시
- [ ] 누적 구매 금액 및 다음 등급 진행 상황
- [ ] 등급 변동 이력 UI

### 등급 변동 토스트 알림
- [ ] 등급 업그레이드 시 축하 토스트
- [ ] 등급 다운그레이드 시 안내 토스트
- [ ] 모델 프로필 유예 기간 알림

---

## 📋 등급 체계 요약

| 등급 | 누적 구매 금액 | 일일 생성 | 월간 생성 | 모델 프로필 |
|------|---------------|-----------|-----------|-------------|
| Free | 0원 | 5회 | 25회 | 본인만 |
| Bronze | 1원+ | 5회 | 무제한 | 본인만 |
| Silver | 10만원+ | 10회 | 무제한 | 본인만 |
| Gold | 30만원+ | 20회 | 무제한 | 본인만 |
| Platinum | 100만원+ | 무제한 | 무제한 | +1명/100만원 |

---

## 🔗 LinkPrice Postback URL

```
https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/linkprice-postback
  ?lpinfo={lpinfo}
  &order_id={order_id}
  &price={price}
  &payout={payout}
  &status={status}
```

- `lpinfo`: tracking_id (deeplink에서 생성)
- `status`: `confirmed` 또는 `cancelled`
