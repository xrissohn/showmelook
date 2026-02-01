

# 구매 취소/환불 대응 + 등급 적용 시점 구현 계획

## 개요
구매 후 등급 즉시 적용과 취소/환불 시 등급 롤백 로직을 구현하고, 사용자에게 명확한 안내 문구를 제공합니다.

---

## 1. 등급 적용 정책

### 적용 시점
| 이벤트 | 처리 | 예상 시간 |
|--------|------|----------|
| LinkPrice `confirmed` Postback 수신 | 즉시 등급 적용 | 구매 후 1~24시간 |
| LinkPrice `cancelled` Postback 수신 | 등급 롤백 | 취소 후 1~7일 |

### 등급 확정 상태
- `pending_confirmation`: 적용됨, 7일 이내 취소 가능
- `confirmed`: 7일 경과, 확정됨

---

## 2. 데이터베이스 변경

### 2-1. `purchase_intents` 테이블 컬럼 추가
```text
purchase_intents
├── ... (기존 컬럼)
├── tier_applied_at (timestamptz, nullable) - 등급 적용 시각
├── confirmation_status (text) - 'pending_confirmation' | 'confirmed' | 'rolled_back'
└── rolled_back_at (timestamptz, nullable) - 롤백 시각
```

### 2-2. `user_purchase_stats` 컬럼 추가
```text
user_purchase_stats
├── ... (기존 컬럼)
├── pending_amount (integer, default 0) - 확정 대기 중인 금액
└── last_tier_change_at (timestamptz, nullable) - 마지막 등급 변동 시각
```

### 2-3. `tier_change_history` 새 테이블 (등급 변동 이력)
```text
tier_change_history
├── id (uuid, PK)
├── user_id (uuid)
├── previous_tier (text)
├── new_tier (text)
├── change_reason (text) - 'purchase' | 'refund' | 'admin'
├── amount_change (integer) - +/- 금액
├── related_order_id (text, nullable)
├── created_at (timestamptz)
```

---

## 3. Edge Function 변경

### 3-1. `linkprice-postback` 수정

**confirmed 처리 (구매 확정)**:
```text
1. purchase_intents 상태 업데이트 (pending → purchased)
2. user_purchase_stats.total_purchased_amount 증가
3. 등급 재계산 (calculate_user_tier)
4. 등급 변경 시 tier_change_history에 기록
5. 모델 프로필 슬롯 재계산
6. user_subscriptions.plan 업데이트
7. confirmation_status = 'pending_confirmation' 설정
8. tier_applied_at = now() 설정
```

**cancelled 처리 (취소/환불)**:
```text
1. purchase_intents 상태 업데이트 (purchased → cancelled)
2. user_purchase_stats.total_purchased_amount 차감
3. 등급 재계산 (calculate_user_tier)
4. 등급 다운그레이드 시:
   a. tier_change_history에 기록
   b. 모델 프로필 슬롯 재계산
   c. 초과 프로필 있으면 3일 유예 기간 생성
5. user_subscriptions.plan 업데이트
6. confirmation_status = 'rolled_back' 설정
7. rolled_back_at = now() 설정
```

### 3-2. 새 Edge Function: `confirm-pending-purchases` (7일 확정 배치)
```text
매일 실행 (cron)
1. confirmation_status = 'pending_confirmation' AND tier_applied_at < now() - 7일
2. confirmation_status = 'confirmed'로 업데이트
```

---

## 4. 등급 롤백 상세 로직

### 4-1. 누적 금액 차감
```typescript
// cancelled Postback 수신 시
const newTotalAmount = currentTotal - refundedAmount;

// 새 등급 계산
const newTier = calculateTier(newTotalAmount);
const oldTier = user.currentTier;

if (newTier !== oldTier) {
  // 등급 다운그레이드 처리
  await handleTierDowngrade(userId, oldTier, newTier);
}
```

### 4-2. 모델 프로필 슬롯 초과 처리
```typescript
// 플래티넘 → 골드로 다운그레이드 시
const oldSlots = Math.floor(oldAmount / 1000000); // 예: 2
const newSlots = Math.floor(newAmount / 1000000); // 예: 0 (골드는 0)

if (newSlots < currentProfileCount) {
  // 3일 유예 기간 생성 (기존 createGracePeriodForExcessProfiles 활용)
  await createGracePeriodForExcessProfiles(userId, newSlots);
}
```

---

## 5. 프론트엔드 UI 변경

### 5-1. 등급 안내 문구 추가 위치

**Pricing 페이지 (`src/pages/Pricing.tsx`)**:
```text
하단 FAQ 또는 안내 섹션에 추가:

"등급 적용 안내"
• 구매 확인 후 1~24시간 이내에 등급이 자동으로 적용됩니다.
• 주문 취소 또는 환불 시 누적 금액이 조정되어 등급이 변동될 수 있습니다.

"모델 프로필 안내"
• 등급 변동으로 모델 프로필 슬롯이 줄어들 경우, 3일간의 유예 기간이 주어집니다.
• 유예 기간 내 추가 구매로 슬롯을 유지할 수 있습니다.
```

**마이페이지 등급 섹션 (`src/pages/MyPage.tsx`)**:
```text
현재 등급 표시 영역 하단에:

"ⓘ 등급은 누적 구매 금액을 기준으로 산정됩니다.
   주문 취소/환불 시 등급이 변동될 수 있습니다."
```

**구매 버튼 근처 (상품 카드/추천 결과)**:
```text
작은 안내 텍스트:
"구매 시 등급 혜택이 적용됩니다 (1~24시간 소요)"
```

### 5-2. 등급 변동 알림 토스트
```typescript
// 등급 업그레이드 시
toast.success("🎉 축하합니다! 골드 등급으로 업그레이드되었습니다.");

// 등급 다운그레이드 시
toast.info("등급이 실버로 변경되었습니다. (환불 반영)");

// 모델 프로필 유예 기간 알림
toast.warning("모델 프로필 슬롯이 줄어들었습니다. 3일 내 추가 구매 시 유지됩니다.");
```

### 5-3. 등급 변동 이력 UI (선택적)
마이페이지에 "등급 변동 내역" 섹션 추가:
```text
| 날짜 | 변동 | 사유 |
|------|------|------|
| 2024-01-15 | 실버 → 골드 | 상품 구매 (+20만원) |
| 2024-01-10 | 무료 → 실버 | 상품 구매 (+12만원) |
```

---

## 6. 구현 순서

| 순서 | 작업 | 소요 시간 |
|------|------|----------|
| 1 | DB 마이그레이션 (컬럼 추가 + tier_change_history) | 15분 |
| 2 | `linkprice-postback` cancelled 처리 로직 추가 | 30분 |
| 3 | 등급 롤백 + 모델 프로필 유예 기간 로직 | 30분 |
| 4 | Pricing 페이지 안내 문구 추가 | 15분 |
| 5 | 마이페이지 등급 안내 문구 추가 | 10분 |
| 6 | 등급 변동 토스트 알림 | 15분 |
| 7 | (선택) 등급 변동 이력 UI | 30분 |

---

## 7. 적용 시점 최종 권장

| 방식 | 장점 | 단점 | 권장 |
|------|------|------|------|
| **즉시 적용** (Postback 수신 시) | UX 좋음, 고객 만족도 높음 | 환불 악용 가능성 | **권장** |
| 24시간 후 적용 | 일부 취소 필터링 | 고객 대기 필요 | X |
| 7일 후 적용 | 환불 완전 확정 후 | UX 매우 나쁨 | X |

**최종 권장**: 
- **Postback 수신 즉시 등급 적용** (1~24시간 내)
- **7일간 `pending_confirmation` 상태로 관리**
- **취소/환불 시 즉시 롤백**
- **UI에 "1~24시간 내 적용" 안내**

---

## 8. 기술적 세부사항

### 등급 롤백 함수
```typescript
async function handleTierRollback(
  userId: string,
  refundedAmount: number,
  orderId: string
) {
  // 1. 현재 통계 조회
  const stats = await getUserPurchaseStats(userId);
  
  // 2. 금액 차감
  const newTotal = stats.total_purchased_amount - refundedAmount;
  
  // 3. 새 등급 계산
  const newTier = calculateUserTier(newTotal);
  const oldTier = stats.current_tier;
  
  // 4. 통계 업데이트
  await updatePurchaseStats(userId, {
    total_purchased_amount: newTotal,
    current_tier: newTier,
    model_profile_slots: newTier === 'platinum' 
      ? Math.floor(newTotal / 1000000) 
      : 0
  });
  
  // 5. 등급 변동 기록
  if (newTier !== oldTier) {
    await recordTierChange(userId, oldTier, newTier, 'refund', -refundedAmount, orderId);
  }
  
  // 6. 모델 프로필 초과 시 유예 기간
  const newSlots = newTier === 'platinum' ? Math.floor(newTotal / 1000000) : 0;
  const currentProfiles = await getModelProfileCount(userId);
  
  if (currentProfiles > newSlots) {
    await createGracePeriodForExcessProfiles(userId, newSlots);
  }
  
  // 7. 구독 정보 업데이트
  await updateUserSubscription(userId, { plan: newTier });
}
```

### 안내 문구 컴포넌트
```typescript
// TierPolicyNotice.tsx
export const TierPolicyNotice = () => (
  <div className="text-sm text-muted-foreground mt-4 p-4 bg-muted/50 rounded-lg">
    <h4 className="font-medium mb-2">등급 적용 안내</h4>
    <ul className="list-disc list-inside space-y-1">
      <li>구매 확인 후 1~24시간 이내에 등급이 자동 적용됩니다.</li>
      <li>주문 취소 또는 환불 시 누적 금액이 조정되어 등급이 변동될 수 있습니다.</li>
      <li>등급 변동 시 모델 프로필은 3일간의 유예 기간이 주어집니다.</li>
    </ul>
  </div>
);
```

