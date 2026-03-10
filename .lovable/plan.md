

# 사진 분석 → DB 직접 매칭 (1차 필터링 강화)

## 문제 진단

현재 흐름:
```text
사진 → analyze-style-image (구조화 분석) → searchPrompt 텍스트만 추출
  → style-recommend Stage 1 (AI가 텍스트를 재해석) → Stage 2 (AI가 상품 선택)
```

**핵심 문제**: `analyze-style-image`가 이미 정확한 구조화 데이터(카테고리, 색상, 소재, 핏)를 반환하는데, 이 데이터를 **버리고** `searchPrompt` 텍스트만 `style-recommend`에 전달함. Stage 1이 텍스트를 재해석하면서 "카라 있는 아우터" → "야구복 스타일 아우터" 같은 변환이 발생.

## 해결 방안

사진 분석 결과의 **구조화된 아이템 데이터**를 `style-recommend`에 직접 전달하여, DB의 `dna_meta`/`dna_text`/`color`/`category` 필드와 **직접 매칭**하는 새로운 경로 추가.

```text
사진 → analyze-style-image (구조화 분석) → items[] + searchPrompt
  → style-recommend에 items[] 직접 전달 (photoAnalysisItems 파라미터)
    → Stage 1 스킵 (이미 분석 완료)
    → DB에서 각 아이템별로 색상/카테고리/소재/핏 직접 매칭 필터링
    → 매칭된 후보군으로 Stage 2 실행 (최종 조합 선택만)
```

## 변경 파일

### 1. `src/pages/StyleGenerator.tsx`
- `handleCustomStyleSearch`에서 사진 분석 결과(`items`, `overallStyle`, `season`, `tpo`)를 `style-recommend` 호출 시 `photoAnalysisItems` 파라미터로 함께 전달
- `handleStyleImageUpload` 완료 시 분석된 아이템 데이터를 상태로 저장 (`styleImageAnalysis`)

### 2. `supabase/functions/style-recommend/index.ts`
- `photoAnalysisItems` 파라미터 수신 처리 추가
- 사진 분석 아이템이 있을 때의 새로운 필터링 로직:
  - **Stage 1 스킵**: 사진 분석 결과가 이미 카테고리/색상/소재/핏을 포함하므로 TPO 분석 불필요
  - **아이템별 DB 직접 매칭**: 각 분석된 아이템(예: `{type: "outer", category: "카라 자켓", color: "네이비", material: "면"}`)에 대해:
    - `dna_meta.item_slot` 매칭 (outer → outer)
    - `color` 필드 또는 `dna_meta.color_family` 매칭
    - `dna_text`에서 소재/핏 키워드 매칭 (텍스트 유사도)
    - 카테고리 키워드 매칭 (제품명에서 "카라", "자켓" 등 검색)
  - 매칭 점수가 높은 후보군을 카테고리별로 선별
- Stage 2 프롬프트에 **원본 사진 분석 결과를 컨텍스트로 추가**: "사용자가 참고한 사진에는 네이비 카라 자켓, 화이트 티셔츠가 있었습니다. 이와 가장 유사한 상품을 선택하세요."

## 기술 세부사항

### 새 매칭 함수 (`calculatePhotoMatchScore`)
```text
입력: 분석된 아이템 1개 + DB 상품 1개
출력: 0~1 점수

매칭 기준 (가중치):
- item_slot 일치: 필수 (불일치 시 0점)
- 색상 매칭: 0.35 (color 필드 + dna_meta.color_family)
- 카테고리 키워드: 0.30 (제품명/sub_category에서 키워드 검색)
- 소재 매칭: 0.20 (dna_text에서 material 키워드)
- 핏 매칭: 0.15 (dna_text에서 fit 키워드)
```

### 프론트엔드 상태 추가
- `styleImageAnalysis`: 분석된 아이템 배열을 저장 (사진 업로드 시 설정, 사진 제거 시 null)
- `handleCustomStyleSearch` 호출 시 이 데이터를 `style-recommend`에 전달

## 비용 영향
- 사진 분석 모드에서 Stage 1 AI 호출을 스킵하므로 오히려 **비용 절감** (GPT-5-mini 1회 절약)
- Stage 2는 동일하게 실행

