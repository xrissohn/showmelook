

## 진단 결과: 팝업 차단으로 인한 구매 링크 오류

### 문제 원인

`window.open()`이 **비동기 호출 이후**에 실행되고 있어서, 모바일 브라우저(특히 인앱 브라우저, Safari)에서 **팝업 차단**됨.

```text
사용자 클릭 → await getSession() → await deeplink() → window.open() ← 차단!
                ↑ 비동기 대기로 인해 "사용자 제스처" 컨텍스트가 사라짐
```

PC Chrome은 관대하게 허용하지만, 모바일/인앱 브라우저는 엄격하게 차단함. 이것이 "내 컴퓨터에서는 되는데 유저에게는 안 되는" 원인.

### 영향 범위

| 파일 | 함수 | 문제 |
|------|------|------|
| `LookDetailModal.tsx` | `handleProductPurchase` | await 2회 후 window.open |
| `StyleGenerator.tsx` | `handlePurchase` | await 2회 후 window.open |
| `SharedLook.tsx` | `handleProductClick` | affiliate_url 캐시 있으면 OK, 없으면 동일 문제 |

### 해결 방법: "먼저 창 열고, 나중에 URL 교체"

클릭 시점에 `window.open('')`으로 빈 창을 먼저 열고, deeplink 응답 후 해당 창의 URL을 교체하는 패턴 적용.

```typescript
// Before (차단됨)
const handlePurchase = async (product) => {
  const { data } = await supabase.functions.invoke('deeplink', {...});
  window.open(data.affiliate_url, '_blank');  // ← 팝업 차단
};

// After (안전)
const handlePurchase = async (product) => {
  const newWindow = window.open('', '_blank');  // ← 클릭 시점에 열기
  try {
    const { data } = await supabase.functions.invoke('deeplink', {...});
    if (newWindow) {
      newWindow.location.href = data?.affiliate_url || product.product_url;
    }
  } catch {
    if (newWindow) newWindow.location.href = product.product_url;
  }
};
```

### 수정 대상 파일 (3개)

1. **`src/components/style/LookDetailModal.tsx`** — `handleProductPurchase` 함수 수정
2. **`src/pages/StyleGenerator.tsx`** — `handlePurchase` 함수 수정  
3. **`src/pages/SharedLook.tsx`** — `handleProductClick` 함수에서 deeplink 호출 시 동일 패턴 적용

### 추가 방어

- `newWindow`가 `null`인 경우(팝업 완전 차단 환경) → `window.location.href`로 현재 페이지에서 이동하는 fallback 추가
- 인앱 브라우저에서는 `_blank` 대신 `_self`로 이동하는 옵션 고려

