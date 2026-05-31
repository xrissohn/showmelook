## 진단 요약

(a) JS Domain 등록됨 → 도메인 문제 아님
(b) "로그인 안 됨/요청 실패" → 카카오 팝업에서 발생. `sendDefault` 자체는 로그인 불필요하므로, 십중팔구 **`imageUrl`이 카카오 서버에서 크롤링 불가**(Supabase signed URL, blob, data URL 등)거나 SDK가 비동기 컨텍스트에서 호출되어 팝업이 정상 흐름을 못 탐
(c) 팝업 차단 아이콘 없음 → 팝업은 떴음. SDK 내부 에러 메시지일 가능성 높음

## 변경 사항

### 1. `src/components/style/ShareButtons.tsx`

**(A) `handleKakaoClickSync`에 PC 분기 추가** — 사용자 클릭 동기 컨텍스트에서 `Kakao.Share.sendDefault()` 즉시 호출 (현재는 `handleShare('kakao')` async 체인으로 위임되어 컨텍스트 소실).

**(B) `imageUrl` 안전화 헬퍼**
```text
isPublicShareableImage(url):
  - http(s)로 시작하고
  - blob:/data:/ 가 아니고
  - URL 내 'token=' / '/sign/' 포함 안 함
  → true면 그대로, false면 'https://showmelook.com/og-image.png' 사용
```

**(C) `case 'kakao'` 및 PC 동기 분기 둘 다 적용**:
- Kakao SDK 미로드/미초기화 시 즉시 재초기화 시도
- 에러를 `console.error('[Kakao Share]', err)`로 노출 (현재 `catch {}`로 가려져 있음)
- 실패 시 toast 메시지 + 링크 복사 fallback

**(D) `sendDefault` 호출부 정리**:
```text
Kakao.Share.sendDefault({
  objectType: 'feed',
  content: {
    title, description,
    imageUrl: safeImageUrl,     // 위 (B)로 검증된 공개 URL
    link: { mobileWebUrl: shareUrl, webUrl: shareUrl }
  },
  buttons: [{ title: '스타일 보기', link: {...} }]
})
```

### 2. `src/pages/StyleGenerator.tsx`

동일한 패턴 적용:
- `handleKakaoClickSync`에 PC 동기 분기 추가
- 동일한 `isPublicShareableImage` 헬퍼 적용
- `catch` 블록 에러 로깅 강화

### 3. 분기 흐름 최종 정리

```text
KakaoTalk 버튼 onClick (동기)
 ├─ Mobile Chrome   → 링크 복사 (현 상태 유지)
 ├─ Mobile Safari 등 → navigator.share() 즉시 호출 (현 상태 유지)
 └─ PC (Desktop)    → Kakao.Share.sendDefault() 즉시 호출 [NEW]
                       │
                       ├─ imageUrl 안전화 적용
                       ├─ 성공: toast '카카오톡 공유 창이 열렸습니다'
                       └─ 실패: console.error + 링크 복사 fallback + toast
```

## 검증 방법

1. PC Chrome에서 스타일 생성 후 KakaoTalk 클릭 → 팝업에서 정상적으로 친구 선택 화면 도달
2. 실패 시 브라우저 콘솔에 `[Kakao Share]` 에러 출력 확인 가능
3. 모바일 Chrome/Safari 동작은 변경 없음 (기존 분기 유지)

## 변경 대상

- `src/components/style/ShareButtons.tsx` (수정)
- `src/pages/StyleGenerator.tsx` (수정)

DB/edge function 변경 없음, UI/공유 로직만 수정.