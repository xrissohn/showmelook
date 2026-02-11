

# Cafe24 앱스토어 반려 원인 분석 및 해결 방안

## 반려 사유 분석

에러 URL과 반려 메시지에서 **2가지 핵심 문제**가 확인됩니다.

---

## 문제 1: invalid_scope (스코프 오류)

에러 메시지: `The scope added by Cafe24 Developers is invalid`

현재 코드에서 요청하는 스코프:
```text
mall.read_store, mall.read_product, mall.read_category,
mall.read_collection, mall.read_customer, mall.read_order, mall.write_order
```

가상피팅 서비스에 **고객 정보(read_customer), 주문 읽기/쓰기(read_order, write_order)** 권한은 과도합니다. Cafe24 심사에서 앱 기능과 무관한 스코프를 등록하면 반려됩니다.

**해결:** 실제 필요한 최소 스코프만 남기기:
- `mall.read_store` - 쇼핑몰 정보 확인
- `mall.read_product` - 상품 정보 조회 (피팅 대상)
- `mall.read_category` - 카테고리 조회 (선택)

`mall.read_collection`, `mall.read_customer`, `mall.read_order`, `mall.write_order`는 제거합니다.

---

## 문제 2: 소스코드 노출 / 보안 취약점

### 2-1. HMAC 검증 비활성화 (치명적)

`cafe24-oauth/index.ts` 116~119번 줄에서 HMAC 검증 실패 시 차단하는 코드가 **주석 처리**되어 있습니다. 카페24는 설치 요청의 위변조 방지를 위해 HMAC 검증을 요구합니다.

**해결:** 주석을 해제하여 HMAC 검증 실패 시 403 에러를 반환하도록 활성화합니다.

### 2-2. 기본 라우트에서 API 엔드포인트 전체 목록 노출

`cafe24-oauth/index.ts` 580~599번 줄에서 어떤 엔드포인트도 매칭되지 않으면 전체 API 구조를 JSON으로 반환합니다. 이는 공격자에게 내부 구조를 알려주는 것과 같습니다.

**해결:** 기본 라우트는 단순 404 또는 최소 정보만 반환하도록 변경합니다.

### 2-3. CORS `Access-Control-Allow-Origin: *`

모든 도메인에서 API를 호출할 수 있도록 열려 있습니다. 카페24 앱 심사에서는 허용 도메인을 제한하는 것을 권장합니다.

**해결:** CORS 오리진을 `*.cafe24.com`, `showmelook.lovable.app` 등 필요한 도메인으로 제한합니다.

### 2-4. 콘솔 로그에서 민감 정보 노출

- 88번 줄: OAuth 엔드포인트 및 쿼리스트링 전체 로깅
- 101번 줄: HMAC 값 로깅
- 141번 줄: 전체 OAuth URL(client_id 포함) 로깅
- 266번 줄: 토큰 요청 대상 몰 ID 로깅

**해결:** 프로덕션 환경에서는 민감 데이터를 마스킹하거나 제거합니다.

### 2-5. cafe24-widget SDK에서 내부 URL 노출

`cafe24-widget/index.ts`의 SDK 코드에 `SUPABASE_URL`이 그대로 삽입됩니다. 또한 fitting-page HTML에도 내부 API URL이 직접 노출됩니다.

**해결:** SDK에서는 이미 공개된 위젯 URL만 사용하고, 내부 인프라 구조가 드러나지 않도록 합니다 (이 부분은 기능상 불가피한 면이 있으므로 최소화에 집중).

### 2-6. renderErrorPage XSS 취약점

에러 페이지에서 `title`과 `message`를 HTML에 직접 삽입하여 XSS 공격에 취약합니다.

**해결:** HTML 이스케이프 함수를 추가하여 사용자 입력값을 안전하게 렌더링합니다.

---

## 구현 계획

### 1단계: cafe24-oauth/index.ts 수정

| 항목 | 변경 내용 |
|:---|:---|
| 스코프 축소 | `mall.read_store`, `mall.read_product`, `mall.read_category`만 유지 |
| HMAC 검증 활성화 | 주석 해제, 검증 실패 시 403 반환 |
| CORS 제한 | `*.cafe24api.com`, `*.cafe24.com`, `showmelook.lovable.app` 허용 |
| 기본 라우트 | 엔드포인트 목록 대신 404 반환 |
| 로그 정리 | 민감 정보(HMAC, 전체 URL, 토큰) 마스킹 |
| XSS 방지 | `renderErrorPage`에 HTML 이스케이프 적용 |

### 2단계: cafe24-widget/index.ts 수정

| 항목 | 변경 내용 |
|:---|:---|
| SDK 보안 | 불필요한 내부 URL 노출 최소화 |
| fitting-page | API URL을 상대경로 또는 안전한 방식으로 전달 |

### 3단계: 재배포 후 카페24 개발자 센터 확인

- 카페24 개발자 센터에서 앱에 등록된 스코프가 코드의 스코프와 **정확히 일치**하는지 확인 필요
- 스코프 변경 후 앱 설치 흐름 재테스트

---

## 핵심 포인트

카페24 심사에서 가장 크게 지적하는 항목은:
1. **불필요한 권한(스코프) 요청** - 앱 기능과 무관한 권한은 반려 사유
2. **보안 검증 미비** - HMAC 미검증은 카페24 필수 요구사항 위반
3. **내부 구조 노출** - API 엔드포인트 목록 공개는 보안 취약점으로 판단

이 3가지를 해결하면 재심사 통과 가능성이 높습니다.

