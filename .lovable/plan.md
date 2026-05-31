## 문제 원인
현재 iOS 분기는 `navigator.share()`를 사용하도록 추가됐지만, 그 전에 `await supabase.from('generated_looks').update(...)`가 먼저 실행됩니다. iOS Web Share API는 버튼 클릭 직후의 사용자 제스처 안에서 즉시 호출되어야 해서, async DB 업데이트가 먼저 일어나면 네이티브 공유 시트가 차단될 수 있습니다. 그러면 기존 Kakao SDK 경로 또는 fallback 페이지처럼 보이는 문제가 계속 발생합니다.

## 수정 계획
1. `ShareButtons.tsx`의 Kakao 공유 경로를 수정합니다.
   - iOS + Kakao 선택 시 `navigator.share()`를 함수 초반에 가장 먼저 실행합니다.
   - `generated_looks.is_public = true` 업데이트는 공유 호출 이후 백그라운드로 실행하거나, 공유 URL 생성에 필요한 최소 값만 먼저 계산합니다.
   - iOS에서는 절대 `Kakao.Share.sendDefault()`로 내려가지 않도록 명확히 차단합니다.

2. `StyleGenerator.tsx` 내부 중복 공유 함수도 같은 방식으로 수정합니다.
   - 이 파일은 크지만 기존 구조를 유지하고 공유 함수의 순서만 최소 변경합니다.
   - iOS Kakao 공유는 무조건 Web Share API 또는 링크 복사 fallback만 사용하게 합니다.

3. iOS Chrome/Safari용 메시지를 정리합니다.
   - 사용자가 공유를 취소한 경우는 오류로 보지 않습니다.
   - `navigator.share` 자체가 없거나 실패하면 링크를 복사하고, “공유 시트를 열 수 없어 링크를 복사했습니다”로 안내합니다.

## 기대 동작
- iPhone Chrome/Safari: KakaoTalk 버튼 클릭 → iOS 네이티브 공유 시트 → KakaoTalk 선택
- Android/PC: 기존 Kakao SDK 공유 유지
- iOS에서 더 이상 `talk-apps.kakao.com` 다운로드 안내 화면으로 가지 않음

## 검증
- 코드상 iOS Kakao 경로가 `Kakao.Share.sendDefault()`에 도달하지 않는지 확인합니다.
- 관련 TypeScript 구문 오류가 없도록 변경 범위를 최소화합니다.