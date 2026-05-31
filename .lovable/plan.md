문제 원인으로 보이는 부분은 `navigator.share()` 자체보다, 현재 카카오 공유가 비동기 함수/Popover 메뉴 클릭/상태 업데이트 흐름을 거치면서 모바일 Chrome에서 “사용자 제스처 직후 호출” 조건을 잃는 점입니다. 모바일 Chrome은 이 조건이 깨지면 공유 시트를 조용히 막는 경우가 많습니다.

계획:

1. 카카오 모바일 공유를 버튼 클릭 핸들러 안에서 즉시 실행
   - `KakaoTalk` 메뉴 클릭 시 `await shareToSNS(...)`로 들어가기 전에 모바일 카카오 여부를 먼저 판단합니다.
   - 모바일이면 클릭 이벤트 안에서 바로 `navigator.share({ title, text, url })`를 호출합니다.
   - 공유 메뉴 닫기, DB 공개 처리, toast 콜백은 공유 시트 호출 이후로 미룹니다.

2. `ShareButtons.tsx` 구조 수정
   - 모바일 카카오 전용 헬퍼를 추가해 `handleShare('kakao')`에서 최우선 실행합니다.
   - iOS Safari, iOS Chrome, Android Chrome 모두 Web Share API 경로로 통일합니다.
   - `navigator.share`가 없거나 실패하면 링크 복사 안내로 fallback합니다.
   - PC는 기존 Kakao SDK 공유를 그대로 유지합니다.

3. `StyleGenerator.tsx` 내부 중복 공유 UI도 동일하게 반영
   - 같은 공유 함수가 중복되어 있으므로 동일한 모바일 즉시 호출 구조로 맞춥니다.
   - 단, 기존 대형 파일은 필요한 부분만 최소 수정하고 리팩터링하지 않습니다.

4. 확인 기준
   - 코드상 모바일 카카오 클릭이 더 이상 `Kakao.Share.sendDefault()`로 가지 않는지 확인합니다.
   - 모바일 Chrome에서 공유 시트가 열릴 수 있도록 `navigator.share()`가 클릭 핸들러의 첫 동작에 가깝게 실행되는지 확인합니다.
   - 실제 카카오톡 앱 선택/전송은 브라우저 자동화 환경에서 완전 검증이 어렵지만, Safari와 같은 네이티브 공유 시트를 띄우는 구조로 변경합니다.

기대 결과:
- iOS Safari/Chrome: 공유 시트가 뜨고 카카오톡 선택 가능
- Android Chrome: 아무 반응 없는 상태 대신 공유 시트가 뜨고 카카오톡 선택 가능
- PC Chrome: 기존 카카오 SDK 공유 유지