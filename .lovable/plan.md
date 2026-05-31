# iOS Chrome 카카오톡 공유 문제 해결

## 문제 요약

iOS Chrome(및 Safari 이외 모든 iOS 브라우저)은 WebKit 강제 정책 때문에 Kakao JS SDK의 `kakaolink://` 커스텀 스킴이 차단되어, SDK가 `talk-apps.kakao.com` 웹 폴백 페이지로 빠집니다. 사용자에게는 "카톡 설치/다운로드" 안내 화면이 보이고 설치된 카톡으로 링크가 전달되지 않습니다.

코드 버그가 아니라 iOS 플랫폼 제약입니다. **Web Share API**(`navigator.share`)는 iOS Chrome/Safari/Edge 모두 지원하고, 호출 시 iOS 네이티브 공유 시트가 열려 설치된 KakaoTalk으로 바로 전달됩니다.

## 해결 전략

공유 함수 진입 시 환경을 분기:

```text
[공유 버튼 클릭]
       │
       ▼
   iOS 인가?
   ├─ Yes ──► navigator.share() (네이티브 공유 시트 → 카톡 선택)
   │           └─ 실패/미지원 시 → 링크 복사 fallback
   │
   └─ No ───► Kakao.Share.sendDefault() (기존 로직 유지)
               └─ 실패 시 → 링크 복사 fallback
```

PC/Android 동작은 그대로 두고, iOS 경로만 추가합니다.

## 변경 사항

### 1. 공유 유틸 함수 분기 추가
공유 로직이 있는 파일(`src/components/style/ShareButtons.tsx` 및 `LookDetailModal.tsx`에서 호출하는 `shareToKakao` 함수)을 수정:

- iOS 감지: `/iPhone|iPad|iPod/i.test(navigator.userAgent)` (기존 `inAppBrowserDetector.ts` 재사용 가능)
- iOS + `navigator.share` 사용 가능 → `navigator.share({ title, text, url })` 호출
  - **사용자 클릭 핸들러 내에서 동기적으로 호출**해야 iOS가 허용 (async/await로 await 후 호출 금지 — 미리 데이터 준비 후 즉시 호출)
- iOS인데 `navigator.share` 없거나 사용자 취소 외 에러 → 링크 복사 + 토스트로 "Safari에서 공유 가능" 안내
- 비-iOS → 기존 Kakao SDK 경로 그대로

### 2. (선택) 인앱 브라우저 안내 강화
iOS 인앱 브라우저(카톡/인스타/네이버)는 `navigator.share`도 차단되는 경우가 있어, 기존 `InAppBrowserRedirect`/`InAppBrowserWarning` 동선 그대로 유지.

### 3. QA 시나리오
- iOS Chrome에서 공유 클릭 → 네이티브 시트 → 카톡 선택 → 카톡 앱 진입 후 친구 선택 화면 (정상)
- iOS Safari → 동일하게 네이티브 시트 동작 (정상)
- Android Chrome → Kakao SDK로 카톡 직접 호출 (기존과 동일)
- PC Chrome → Kakao SDK 웹 공유 (기존과 동일)
- 인앱 브라우저 → 기존 안내 모달

## 기술 디테일

- `navigator.share`는 HTTPS + 사용자 제스처 컨텍스트 필요 (조건 충족됨: 버튼 클릭)
- 이미지 첨부(`files`)는 iOS 지원이 불안정하므로 `title/text/url`만 전달
- 에러 핸들링:
  - `AbortError`(사용자 취소) → 무시
  - 그 외 에러 → 링크 복사 fallback 실행
- Kakao SDK 코드/초기화는 그대로 유지 (Android/PC에서 계속 사용)

## 영향 범위

- 수정 파일: `src/components/style/ShareButtons.tsx` (또는 공유 로직이 위치한 파일) — frontend only
- 백엔드, edge function, DB 변경 없음
- 기존 Android/PC 사용자 경험 변화 없음

## 참고: 사용자에게 알릴 점

iOS Chrome에서 "카카오톡으로 직접 공유" 버튼이 SDK로는 작동하지 않는 것이 정상이라는 점은 카카오 공식 문서에도 명시되어 있습니다 (Universal Link 기반 동작은 Safari 우선 지원). 이번 수정은 iOS의 네이티브 공유 시트를 활용해 우회하는 표준 패턴입니다.