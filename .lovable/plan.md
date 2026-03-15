

# 사진 업로드 시 AI 평가 + 직접 매칭 모드 구현 계획

## 현재 문제

사진 업로드 → analyze-style-image (1단계, 정확) → style-recommend Stage 2 AI 스타일리스트가 **주관적으로 다른 제품을 선택** → 사진과 전혀 다른 결과

## 해결 방향

사진 모드일 때 Stage 2의 역할을 **"추천"에서 "평가"로 전환**:
- 기존 텍스트 프롬프트: Stage 2 = AI 스타일리스트 추천 (기존 그대로)
- 사진 업로드: Stage 2 = AI 패션 평가사 (스타일 평가 + 점수 기반 직접 매칭)

## 변경 파일 및 내용

### 1. `supabase/functions/style-recommend/index.ts`

사진 모드(`hasPhotoAnalysis`)일 때 Stage 2 처리를 완전히 분기:

**Stage 2 AI 호출을 "평가 모드"로 교체:**
- 상품 선택은 `calculatePhotoMatchScore` 점수 기반으로 **직접 선택** (카테고리별 최고 점수 1개)
- Stage 2 AI는 상품을 고르는 게 아니라, **사진 속 스타일에 대한 평가 코멘트만 생성**
  - 색상 조화 평가, 시즌 적합성, TPO 분석, 스타일링 강점/개선점
  - 예: "네이비와 올리브의 조합이 절묘해요. 가을 비즈니스 캐주얼로 완벽한 선택입니다."
- AI가 `selectedProductIds`를 결정하지 않으므로 엉뚱한 상품이 나올 수 없음

로직 흐름:
```text
사진 모드:
1. calculatePhotoMatchScore로 각 분석 아이템별 최고 점수 상품 직접 선택
2. AI에게는 "선택된 상품 + 사진 분석 결과"를 주고 스타일 평가만 요청
3. ragResponse = { selectedProductIds: 점수기반, styleReasoning: AI평가 }

텍스트 모드:
(기존 Stage 2 로직 100% 유지 — 세계최고 AI 패셔니스타 추천)
```

**평가 모드 AI 프롬프트 (새로 추가):**
```text
"당신은 세계 최고의 패션 평론가입니다.
사용자가 업로드한 패션 사진을 분석한 결과와, DB에서 매칭된 유사 상품을 보고
스타일 평가를 해주세요.

평가 항목:
1. 전체 스타일 완성도 (★~★★★★★)
2. 색상 조화 분석
3. 시즌/TPO 적합성
4. 이 스타일의 강점
5. 업그레이드 팁 (선택)

⚠️ 상품을 선택하거나 변경하지 마세요. 평가만 하세요."
```

### 2. `src/pages/StyleGenerator.tsx`

- 사진 모드일 때 UI에 "평가 결과" 섹션 표시
- 기존 `styleReasoning` 영역에 평가 코멘트가 자연스럽게 표시됨 (추가 UI 변경 최소화)
- 응답의 `mode: 'evaluation'` 플래그로 프론트에서 "AI 추천" vs "AI 평가" 라벨 구분

### 3. 응답 포맷 확장

```typescript
// style-recommend 응답에 mode 필드 추가
{
  success: true,
  mode: 'evaluation' | 'recommendation',  // 새 필드
  look: {
    name: "비즈니스 캐주얼 룩",
    styleReasoning: "★★★★☆ 네이비와 올리브의 조합이...", // 평가 코멘트
    items: [...],  // 점수 기반 직접 매칭 결과
  }
}
```

## 핵심 변경 요약

| 구분 | 텍스트 프롬프트 | 사진 업로드 |
|---|---|---|
| Stage 1 | AI TPO 분석 | 사진 분석 결과 직접 사용 (기존) |
| Stage 2 상품 선택 | AI 스타일리스트 추천 | **점수 기반 직접 매칭** |
| Stage 2 AI 역할 | 추천 + 코멘트 | **스타일 평가만** |
| AI 비용 | Stage1 + Stage2 | Stage1 스킵 + Stage2 (평가만, 경량) |

## 기대 효과

- 사진과 추천 결과의 100% 일관성 보장 (AI가 상품을 바꿀 수 없음)
- "세계 최고 AI 패셔니스타" 브랜드 유지 (텍스트 모드는 완전히 동일)
- 사진 모드에서는 평가라는 새로운 가치 제공
- Stage 2 AI 프롬프트가 가벼워져 비용/속도 개선

