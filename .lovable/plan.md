## 목표

현재 보고 있는 슬라이드를 **브라우저 인쇄 파이프라인을 거치지 않고**, 화면에 보이는 그대로 캡처해서 PDF로 저장합니다. 사용자가 보는 뷰포트(1311×901 등)와 동일한 픽셀이 PDF 페이지에 그대로 들어갑니다.

## 동작 방식 (WYSIWYG 캡처)

1. `exportToPdf` 클릭 시:
   - `isExporting=true`, 진행률 0
   - 폰트/이미지 로드 대기 (기존 로직 재사용)
2. 슬라이드 컨테이너(라이브 DOM, 화면에 보이는 그 노드)에 `id="pitch-live-slide"` 부여
3. 슬라이드를 한 장씩 순회:
   - `setCurrentSlide(i)` → 한 프레임 대기 → 해당 슬라이드 노드를 `html2canvas` 로 캡처
   - 캡처 시 `scale = (선택된 DPI / 96)` 로 해상도 결정
     - 150dpi → 1.56x, 200dpi → 2.08x, 300dpi → 3.13x, 600dpi → 6.25x (메모리 한계 시 4x로 클램프)
   - `useCORS: true`, `backgroundColor: null`, `logging: false`
4. 첫 슬라이드의 캔버스 픽셀 크기를 기준으로 jsPDF 페이지 생성
   - `orientation`: 가로/세로 자동 판단
   - `unit: 'px'`, `format: [canvas.width, canvas.height]` → 화면 비율 그대로 보존
5. 이미지 삽입:
   - "부드럽게(사진)" → `addImage(dataURL, 'JPEG', 0,0,W,H, undefined, 'FAST')`, quality 0.92
   - "자동/선명/픽셀" → PNG 무손실
6. 마지막에 `doc.save('showmelook-pitch.pdf')`
7. `finally`에서 `isExporting=false`, 임시 마커 제거

## 무엇을 바꾸나

- 파일: `src/pages/Pitch.tsx` 한 곳
  - `exportToPdf` 콜백 본문 교체: `window.print()` 경로 제거 → html2canvas + jsPDF 경로
  - 라이브 슬라이드 노드에 캡처 마커 부여
  - `pitch-print-mode` 클래스 토글, 자동 fit-scale 로직, `@page` CSS 주입 → PDF 경로에서 호출 안 함 (코드 자체는 남겨두지만 비활성)
- 패널 UI는 그대로 유지 (용지 크기 옵션은 캡처 모드에서는 무시되며, "현재 보이는 뷰포트 그대로 출력"으로 설명 문구만 보강)

## 사용자가 체감할 변화

- PDF 페이지 크기 = 현재 슬라이드 박스의 실제 픽셀 크기(예: 1311×901)
- 그라디언트, 그림자, blur, 폰트 자간이 화면과 동일
- 파일 크기는 늘어나지만(비트맵), 300dpi 기준으로 인쇄/뷰잉에 충분
- 캡처 중에는 슬라이드가 자동으로 넘어가며 진행률 표시

## 주의

- `html2canvas`는 일부 최신 CSS(`oklch`, 일부 `backdrop-filter`)를 부분 지원합니다. 화면과 차이가 보이는 항목이 있으면 해당 슬라이드만 보정 패치를 추가합니다.
- 600dpi는 슬라이드당 캔버스가 매우 커져 모바일/저사양에서 OOM 가능 → 4x로 상한 클램프