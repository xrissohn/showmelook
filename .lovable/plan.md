

## 품절 상품 자동 감지 및 삭제 시스템 (Layer 2 + Layer 3)

### 구현 범위
- **Layer 2**: 구매 클릭 시 HTTP HEAD로 URL 유효성 검증 → 404/410이면 `products_cache`에서 삭제 + 사용자에게 안내
- **Layer 3**: 매일 새벽 배치로 전체 상품 URL HEAD 검사 → 품절/단종 상품 자동 삭제

### 변경 파일

**1. 새 Edge Function: `supabase/functions/product-health-check/index.ts`**
- **단건 모드** (`{ url, productId }`): 구매 클릭 시 호출. HEAD 요청으로 URL 확인 → 404/410/5xx이면 해당 상품을 `products_cache`에서 DELETE하고 `{ alive: false }` 반환
- **배치 모드** (`{ batch: true }`): pg_cron에서 호출. `products_cache`에서 활성 상품 100개씩 HEAD 검사 → 죽은 URL의 상품 DELETE. 남은 상품이 있으면 자동 반복 (최대 50회, ~5,000개)
- HEAD 요청 시 3초 타임아웃, 리다이렉트는 허용하되 최종 응답이 404/410이면 품절 판정

**2. 프론트엔드 수정: `src/pages/StyleGenerator.tsx`**
- `handlePurchase` 및 `handleProductPurchase` 함수에 구매 전 `product-health-check` 단건 호출 추가
- `alive: false`이면 빈 창을 닫고, 토스트로 "해당 상품은 더 이상 판매되지 않습니다" 안내
- 해당 상품을 현재 추천 결과에서 UI상으로도 즉시 제거 (상태에서 필터링)

**3. pg_cron 스케줄 등록 (SQL insert)**
- `product-health-batch`: 매일 04:00 KST(19:00 UTC) 실행
- `product-health-check` 함수를 `{ "batch": true }` body로 호출

**4. `supabase/config.toml` 업데이트**
- `[functions.product-health-check]` verify_jwt = false 추가

### 처리 흐름

```text
[Layer 2 - 클릭 시]
구매 버튼 클릭 
  → product-health-check({ url, productId }) 
  → HEAD 요청 
  → 404? → DELETE FROM products_cache → "품절" 토스트
  → 200? → 딥링크 변환 → 구매 페이지 이동

[Layer 3 - 배치]
pg_cron 04:00 KST 
  → product-health-check({ batch: true })
  → SELECT 100개 (is_active = true)
  → 각 URL HEAD 요청
  → 404/410 → DELETE FROM products_cache
  → 반복 (남은 상품 있으면 계속)
```

### 기술 세부사항
- 품절 판정 기준: HTTP 404, 410, 연속 3회 타임아웃
- DELETE 처리: `is_active = false`가 아닌 실제 DELETE로 상품 수에서 완전 제거
- 배치 처리 시 동시 요청 10개씩 (Promise.allSettled)으로 Edge Function 타임아웃 방지
- 쿠팡 상품은 URL 패턴이 다를 수 있으므로 리다이렉트 후 최종 상태코드로 판정

