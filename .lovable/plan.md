

## 원인 분석 결과

### 문제 1: 쿠팡 모바일 구매 버튼 → 상세 페이지 구매 섹션으로 이동하지 않음

**로그 분석:**
```
[deeplink] Re-converted to mobile-compatible URL: https://link.coupang.com/a/el6MNH
[deeplink] Coupang API response: {"rCode":"0", "data":[{"shortenUrl":"https://link.coupang.com/a/el6MNH", ...}]}
```

**원인:** DB에 저장된 쿠팡 `product_url`이 `link.coupang.com/re/AFFSDP?...` 형식이고, deeplink 함수가 이를 `coupang.com/vp/products/{pageKey}?itemId=...&vendorItemId=...`로 복원 후 API를 호출하여 `link.coupang.com/a/...` 단축 URL을 생성한다. 하지만 이 단축 URL은 쿠팡 앱에서 **상품 상세 페이지 최상단**으로 이동하며, 특정 옵션(사이즈/색상)이 선택된 구매 섹션으로 바로 스크롤되지 않는다.

**해결 방안:** 쿠팡 파트너스 API의 단축 URL은 구매 섹션 직접 이동을 지원하지 않으므로, 모바일 웹 브라우저에서 `m.coupang.com` URL로 직접 열리도록 대체 전략을 적용한다. `itemId`와 `vendorItemId`를 포함한 모바일 웹 URL(`https://m.coupang.com/vm/products/{pageKey}?itemId=...&vendorItemId=...`)을 생성하면 옵션이 미리 선택된 상태로 페이지가 열린다.

### 문제 2: "쿠팡에서 추천해줘"라고 해도 다른 쇼핑몰 상품만 추천

**로그 분석:**
```
[style-recommend] Request: "..."  ← 사용자 요청 텍스트
[style-recommend] Selected IDs: 43f4aa7f..., fa16aba3..., 76763551..., 2f03e944...
```
→ 선택된 4개 상품 조회 결과: **wconcept 3개, hfashion 1개** — 쿠팡 0개.
→ 로그에 "🏪 머천트/브랜드 선호 감지" 메시지가 **전혀 없음**.

**원인:** `detectMerchantPreference` 함수 자체는 '쿠팡' 키워드를 올바르게 감지하지만, 감지 결과가 Stage 2 AI 프롬프트에 전달될 때 **비독점(isExclusive=false) 모드에서 단순 가점(+0.60)만 부여**한다. 그런데 쿠팡 제품은 전체 4,800여 개 중 261개(약 5.4%)에 불과하고, 대부분이 키친타월/장갑 등 비패션 아이템이다. 따라서 Stage 1 필터링(카테고리/시즌/성별)을 통과하는 쿠팡 패션 상품이 극소수여서 가점이 있어도 다른 머천트 상품에 밀린다. 또한 로그에 감지 메시지가 없으므로, 해당 요청의 `userRequest` 텍스트에 실제로 '쿠팡'이 포함되지 않았을 가능성도 있다.

---

## 수정 계획

### 1. 쿠팡 모바일 딥링크 개선 (deeplink + style-recommend)
- `convertCoupangToMobileUrl` 함수에서 API 단축 URL 대신 **모바일 웹 URL 우선 전략** 적용
- `m.coupang.com/vm/products/{pageKey}?itemId={itemId}&vendorItemId={vendorItemId}&sourceType=SDP` 형식으로 생성
- 어필리에이트 추적을 위해 API 호출은 유지하되, 최종 사용자에게는 `shortenUrl`이 아닌 `landingUrl`(AFFSDP 형식) 또는 모바일 웹 URL 사용
- 테스트: 안드로이드/iOS 모바일에서 상품 옵션이 선택된 상태로 열리는지 확인

### 2. 쿠팡 머천트 선호 감지 강화 (style-recommend)
- 머천트 감지 로그를 **항상** 출력하도록 변경 (감지 실패 시에도 요청 텍스트와 함께 로그)
- 쿠팡 감지 시 `isExclusive` 판단 로직 완화: "쿠팡에서"만으로도 독점으로 판단
- 독점 필터 최소 상품 수 조건(현재 4개)을 2개로 완화
- Stage 2 AI 프롬프트에서 머천트 선호 상품의 가점을 0.60 → 0.80으로 상향 (비독점 모드)
- 쿠팡 패션 상품 비율이 낮은 경우에도 최소 1-2개는 포함되도록 강제 슬롯 확보 로직 추가

### 수정 파일
- `supabase/functions/deeplink/index.ts` — 모바일 URL 생성 전략 변경
- `supabase/functions/style-recommend/index.ts` — 머천트 감지 강화 + 강제 슬롯 확보

