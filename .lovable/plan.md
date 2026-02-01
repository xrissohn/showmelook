
# 쿠팡 일별 수익 리포트 연동 구현 계획

쿠팡 파트너스 일별 수익 리포트 API를 활용하여 D-1일 데이터를 오후 6시(KST)에 조회하고, 사용자별 구매를 추적하여 등급 시스템에 자동 반영하는 기능을 구현합니다.

---

## 구현 개요

- 매일 오후 6시(KST = UTC 09:00)에 전날(D-1) 데이터 조회
- subId를 purchase_intents.tracking_id와 매칭하여 사용자별 구매 확인
- 구매 확정 시 user_purchase_stats 업데이트 및 등급 자동 재계산
- 관리자 페이지에 수동 실행 버튼 추가

---

## 작업 목록

### 1. 데이터베이스 테이블 생성

**coupang_daily_reports 테이블**

일별 리포트 원본 데이터를 저장하여 추적 및 감사에 활용

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 고유 식별자 |
| report_date | date | 리포트 날짜 (D-1) |
| tracking_code | text | AF1234567 형식 |
| sub_id | text | tracking_id와 매칭용 |
| click_count | integer | 클릭 수 |
| order_count | integer | 주문 수 |
| cancel_count | integer | 취소 수 |
| gmv | integer | 총 거래액 |
| commission | integer | 수수료 |
| processed | boolean | 처리 완료 여부 |
| created_at | timestamptz | 생성 시간 |

UNIQUE 제약: (report_date, sub_id) - 중복 저장 방지

---

### 2. Edge Function 생성: coupang-daily-report

**기능:**
- 쿠팡 일별 리포트 API 호출 (GET /v1/reports/daily)
- HMAC-SHA256 인증 (기존 deeplink 함수의 로직 재사용)
- 페이지네이션 처리 (1000개 초과 시)
- coupang_daily_reports 테이블에 원본 데이터 저장
- subId로 purchase_intents 매칭 및 상태 업데이트
- 구매 확정 시 user_purchase_stats 누적 및 등급 재계산

**주요 로직:**

```text
1. 날짜 계산: 전날(D-1) yyyyMMdd 형식
2. API 호출: startDate=D-1, endDate=D-1
3. 페이지네이션: 1000개 초과 시 다음 페이지 호출
4. 각 레코드 처리:
   - coupang_daily_reports에 upsert
   - sub_id로 purchase_intents 조회
   - order > 0: status='purchased', confirmation_status='confirmed'
   - cancel > 0: status='cancelled' (gmv 차감)
   - gmv를 user_purchase_stats에 누적
   - 등급 재계산 (calculate_user_tier)
   - 등급 변경 시 tier_change_history 기록
```

---

### 3. pg_cron 스케줄 등록

**스케줄:** 매일 오후 6시 KST (= UTC 09:00)

```text
0 9 * * * (UTC 기준)
```

---

### 4. supabase/config.toml 업데이트

```toml
[functions.coupang-daily-report]
verify_jwt = false
```

---

### 5. Admin 페이지에 수동 실행 UI 추가

**위치:** /admin 페이지 내 새 섹션 또는 기존 탭

**기능:**
- 날짜 선택 (기본값: 전날)
- "리포트 조회" 버튼
- 조회 결과 표시 (주문 수, GMV, 처리 건수 등)
- 처리 상태 및 에러 로그 표시

---

## 데이터 흐름

```text
[매일 오후 6시 KST]
        │
        ▼
┌───────────────────────┐
│ pg_cron 트리거        │
│ (UTC 09:00)           │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ coupang-daily-report  │
│ Edge Function         │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ 쿠팡 API 호출         │
│ GET /v1/reports/daily │
│ startDate/endDate=D-1 │
└───────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ coupang_daily_reports 저장 (원본)     │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ sub_id ↔ tracking_id 매칭            │
│ purchase_intents 상태 업데이트        │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ user_purchase_stats 누적              │
│ 등급 재계산 (calculate_user_tier)     │
│ tier_change_history 기록              │
└───────────────────────────────────────┘
```

---

## 기술 세부사항

### API 엔드포인트
```
GET https://api-gateway.coupang.com/v2/providers/affiliate_open_api/apis/openapi/v1/reports/daily
```

### 필수 쿼리 파라미터
- startDate: yyyyMMdd (전날)
- endDate: yyyyMMdd (전날)
- page: 0부터 시작

### HMAC 인증
기존 deeplink 함수의 generateCoupangHmacSignature 함수 재사용

### 에러 처리
- 429 (Rate Limit): 1분 후 재시도
- 빈 응답: 정상 종료 (해당 날짜에 실적 없음)
- API 오류: 에러 로그 기록 및 알림

### 취소 처리 로직
- cancel_count > 0인 경우, 해당 사용자의 GMV를 차감
- user_purchase_stats.total_purchased_amount에서 차감
- 등급 하락 시 tier_change_history에 'refund' 사유로 기록

---

## 파일 변경 목록

| 파일 | 작업 |
|------|------|
| supabase/migrations/새파일.sql | coupang_daily_reports 테이블 생성 |
| supabase/functions/coupang-daily-report/index.ts | 새 Edge Function 생성 |
| supabase/config.toml | 함수 설정 추가 |
| src/pages/Admin.tsx | 수동 실행 UI 추가 |

---

## 제약사항 및 고려사항

1. **API 요청 제한:** 분당 100회 제한이므로 페이지네이션 시 딜레이 추가
2. **중복 처리 방지:** report_date + sub_id UNIQUE 제약으로 동일 데이터 재처리 방지
3. **이미 처리된 purchase_intent:** 상태가 이미 'purchased'인 경우 중복 업데이트 방지
4. **환불 롤백:** 기존 linkprice-postback의 롤백 로직 패턴 참고

