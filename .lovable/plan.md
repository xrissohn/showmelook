## 문제

새 프롬프트로 "추천받기"를 누르면 AI 스타일 생성 단계에서 **이전에 생성된 룩 이미지가 결과 영역에 잠깐 다시 표시**되는 현상.

## 원인

`StyleGenerator.tsx`의 결과 렌더 조건은:
```
{isGenerating/Searching ? <로딩> : generatedImage ? <이전 이미지> : <빈 상태>}
```

세 곳의 생성 시작 핸들러 모두 이전 결과 상태(`generatedImage`, `generatedLookId`, `generatedTagPositions`, `generatedLookIsPublic`)를 **초기화하지 않은 채** 새 작업을 시작합니다. 따라서 로딩 게이트가 false로 잠깐 떨어지는 구간(예: 추천만 완료되고 합성은 시작 전, 또는 폴백 분기)에서 **직전 생성된 룩이 다시 노출**됩니다.

## 해결 방안

세 함수의 **첫 줄(생성 시작 시점, validation 통과 직후)** 에서 이전 결과 상태를 모두 초기화합니다.

### 수정 대상 파일
- `src/pages/StyleGenerator.tsx`

### 변경 내용

**1) `handleCustomStyleSearch` (line 4117 부근)**
- `setIsCustomSearching(true)` 직후 다음 4줄 추가:
  ```ts
  setGeneratedImage(null);
  setGeneratedLookId(null);
  setGeneratedLookIsPublic(false);
  setGeneratedTagPositions(null);
  ```

**2) `generateStyleWithRecommendation` (line 4285 부근)**
- `setIsGenerating(true); setIsCustomSearching(true);` 직후 동일한 4줄 초기화 추가.

**3) `generateStyle` (line 4657 부근)**
- `setIsGenerating(true);` 직후 동일한 4줄 초기화 추가.

**4) 타입 통일 (작은 정리)**
- 기존 코드 5247, 6109줄에서 `setGeneratedImage('')` 로 빈 문자열을 쓰는 부분을 `setGeneratedImage(null)`로 변경 (타입은 `string | null`이며 truthy 체크와 일관되도록).

## 영향 범위

- 결과 영역의 렌더 게이트는 그대로 유지 (`isGenerating ? 로딩 : generatedImage ? 결과 : 빈상태`).
- 이전 룩은 `myLooks` 배열과 갤러리에 그대로 보존됨 (DB/캐시 영향 없음).
- 메모리상 표시 상태만 즉시 비우므로, 새 추천 진행 중에는 **로딩 → 빈 상태 → 새 결과** 순서로만 노출됨.
- 다른 핸들러/하위 컴포넌트 로직 변경 없음. 안전한 4줄짜리 패치.

## 위험 요소

- StyleGenerator는 6,400줄+ 거대 파일이며 리팩토링 금지 대상이지만, 본 변경은 **3곳에 동일한 4줄 추가 + 2곳 빈 문자열 → null 치환**뿐이라 스코프가 매우 좁고 사이드 이펙트 위험이 낮음.
