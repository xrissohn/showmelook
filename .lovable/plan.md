현재 코드상 iOS만 `navigator.share()`를 쓰고, Android Chrome은 여전히 `Kakao.Share.sendDefault()`로만 진입합니다. 그래서 Android Chrome에서는 앱 호출이 조용히 막히거나 실패해도 화면 변화가 없을 수 있습니다. 모바일 Chrome/Safari에서는 카카오 SDK 대신 브라우저의 네이티브 공유 시트를 먼저 열도록 통일하는 방향으로 수정하겠습니다.

1. `ShareButtons.tsx` 모바일 카카오 분기 수정
   - iOS와 Android 모두 `platform === 'kakao'`이면 `Kakao.Share.sendDefault()`로 가지 않게 합니다.
   - 모바일에서는 버튼 탭 직후 `navigator.share({ title, text, url })`를 가장 먼저 호출합니다.
   - 공유 시트가 열리면 사용자가 카카오톡을 선택해 Safari처럼 공유할 수 있게 합니다.
   - `navigator.share`가 없거나 실패하면 링크 복사 토스트로 fallback합니다.
   - `generated_looks.is_public = true` 업데이트는 공유 호출 뒤 fire-and-forget으로만 실행합니다.

2. `StyleGenerator.tsx` 내부 중복 공유 함수도 동일하게 수정
   - 이 파일에도 별도 `shareToSNS`가 있어 같은 버그가 반복됩니다.
   - 모바일 카카오 공유는 iOS/Android 공통 Web Share API 우선으로 통일합니다.
   - PC에서는 기존 카카오 SDK 공유 방식을 유지합니다.

3. 사용자 제스처가 끊기지 않도록 버튼 핸들러 구조 정리
   - 공유 메뉴 닫기나 상태 업데이트가 `navigator.share()`보다 먼저 실행되지 않도록 유지합니다.
   - 실패 시에도 Android/iOS 모두 “링크가 복사되었습니다” 같은 명확한 피드백이 뜨게 합니다.

4. 확인 방법
   - 모바일 viewport에서 공유 버튼과 카카오톡 메뉴가 노출되는지 확인합니다.
   - 코드상 Android Chrome이 더 이상 `Kakao.Share.sendDefault()` 분기로 가지 않는지 확인합니다.
   - 브라우저 자동화 환경에서는 실제 KakaoTalk 앱 호출까지는 검증할 수 없으므로, 네이티브 공유 시트 호출 분기와 fallback 동작을 검증합니다.

예상 결과:
- iPhone Chrome/Safari: Safari에서 보이는 것처럼 네이티브 공유 시트가 뜨고 카카오톡 선택 가능
- Android Chrome: 아무 반응 없는 SDK 분기 대신 네이티브 공유 시트가 뜨고 카카오톡 선택 가능
- PC Chrome: 기존 카카오톡 공유 방식 유지