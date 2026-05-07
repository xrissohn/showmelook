# 피치덱 화면 캡처 → 하이브리드 PPTX 생성

## 접근

`Pitch.tsx`는 이미 `id="pitch-slide-capture"`라는 슬라이드 캡처 컨테이너와 슬라이드 인덱스 네비게이션을 가지고 있어, 각 슬라이드를 동일한 레이아웃으로 1장씩 렌더링합니다. 이를 헤드리스 브라우저로 순회 캡처해서 PPTX에 풀블리드 이미지로 삽입하면 화면과 100% 일치하는 결과를 얻을 수 있습니다.

## 단계

1. **캡처 친화 모드 추가 (소규모 UI 보강)**
   - `/pitch?capture=1&slide=N` 쿼리로 진입 시 네비게이션/푸터/진행바 숨김, 흰 배경 letterbox 제거
   - 슬라이드 컨테이너에 명시적 폭(예: 1600px) + 폰트 로드 완료 신호용 `data-ready="true"` 속성 부여
   - 기존 `/pitch` UX는 영향 없음

2. **헤드리스 캡처 스크립트 (`/tmp/capture_pitch.mjs`)**
   - Playwright(또는 Puppeteer) 사용, 뷰포트 1920x1080 / DPR 2
   - 슬라이드 수만큼 루프: `goto('/pitch?capture=1&slide=N')` → `data-ready` 대기 → 폰트/이미지 로드 대기 → `#pitch-slide-capture` 요소 스크린샷
   - 결과: `/tmp/pitch_slides/slide-01.png` ~ `slide-19.png` (약 3200x1800)
   - 배포된 `https://showmelook.com/pitch` 사용 (최신 변경사항 반영 확인 필요)

3. **PPTX 빌드 스크립트 (`/tmp/build_pitch_v2.js`, pptxgenjs)**
   - 16:9 LAYOUT_WIDE, 모든 슬라이드 배경 = 피치덱과 동일한 다크 네이비
   - **이미지 슬라이드 (대부분)**: 캡처 PNG를 base64로 임베드, 슬라이드 가운데 풀블리드 배치 (비율 유지, letterbox 색상 일치)
   - **편집 가능한 텍스트 슬라이드 (하이브리드)**:
     - 슬라이드 1 (표지): 제목/태그라인/날짜를 텍스트 레이어로
     - 마지막 투자 요청 슬라이드: 투자금액/런웨이/MAU 목표/연락처를 텍스트 박스로
   - 결과: `/mnt/documents/ShowMeLook_Pitch_Deck_v2.pptx`

4. **QA**
   - LibreOffice로 PDF 변환 → `pdftoppm`으로 슬라이드별 JPG 생성
   - 모든 슬라이드 시각 검수: 잘림/흐림/누락/한글 폰트 깨짐 확인
   - 문제가 있으면 캡처 폭/대기 시간/letterbox 색을 조정하고 재생성

## 결과물
- `ShowMeLook_Pitch_Deck_v2.pptx` — 화면과 동일한 그래픽 + 핵심 슬라이드는 텍스트 편집 가능

## 주의사항
- 한글 폰트는 캡처에 픽셀로 박히므로 PPTX에서 깨질 일이 없음
- 텍스트 편집 가능한 2개 슬라이드는 시스템 한글 폰트(맑은 고딕/Apple SD Gothic) 사용
- 기존 `ShowMeLook_Pitch_Deck.pptx`는 보존
