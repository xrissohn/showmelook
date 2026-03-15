

# AI 태그 정확도 향상 계획: 생성 시점 구조 데이터 활용

## 현재 문제

현재 플로우:
```text
generate-style (이미지 생성) → DB 저장 (tag_positions 없음)
→ InteractiveProductTags 렌더링 시 analyze-image-positions 호출
→ Gemini Flash가 완성 이미지만 보고 위치 추정 → 부정확
```

생성 시점에 이미 알고 있는 정보(어떤 카테고리 상품이 어디에 입혀졌는지)를 버리고, 완성 이미지만으로 다시 추정하고 있어서 정확도가 낮음.

## 핵심 전략

**"생성 입력 → 구조 anchor 저장 → 태그 배치"** 패턴으로 전환.

`generate-style` Edge Function에서 이미지 생성 직후, 같은 AI 호출(또는 후속 경량 호출)로 **각 상품의 위치 anchor를 함께 추출**하여 DB에 즉시 저장.

## 변경 사항

### 1. `generate-style` Edge Function 수정

이미지 생성 후, AI 응답의 text content에서 위치 정보를 추출하거나, 생성 직후 같은 세션에서 경량 위치 분석 수행:

- 이미지 생성 프롬프트에 **"각 아이템의 중심 좌표를 JSON으로 함께 반환"** 지시 추가
- Gemini image 모델의 text 응답에서 좌표 JSON 파싱
- 파싱 실패 시 productDetails의 카테고리 정보 + 표준 body-zone 매핑으로 **rule-based anchor** 생성 (현재 DEFAULT_POSITIONS보다 정교한 버전: 상품 개수, 겹침 순서 고려)
- 생성된 tag_positions를 응답에 포함하여 반환

### 2. 응답 포맷 확장

```typescript
// generate-style 응답에 추가
{
  success: true,
  imageUrl: "...",
  tagPositions: [
    { category: "상의", x: 48, y: 32, confidence: 0.95, source: "generation" },
    { category: "하의", x: 50, y: 65, confidence: 0.95, source: "generation" },
    ...
  ]
}
```

### 3. StyleGenerator.tsx 수정

DB 저장 시 `tag_positions`를 함께 insert:

```typescript
const { data: insertedLook } = await supabase.from('generated_looks').insert({
  ...existingFields,
  tag_positions: genData.tagPositions || null,  // 생성 시점 anchor
}).select('id').single();
```

### 4. Rule-based Anchor 로직 (fallback)

AI가 좌표를 반환하지 않을 때, productDetails의 카테고리와 레이어 순서를 활용한 정밀 매핑:

- 상품 목록에서 카테고리별 body-zone 할당 (outer > top > bottom > shoes 순서)
- 같은 zone에 여러 상품이 있으면 좌우/상하 오프셋 자동 분배
- 소품(가방, 액세서리)은 성별/스타일에 따라 좌우 배치 결정
- confidence를 0.85로 설정 (AI 추정보다 높고, 수동보다 낮음)

### 5. InteractiveProductTags 수정

- `cachedPositions`에 `source: "generation"` 데이터가 있으면 AI 재분석을 **스킵**
- `analyze-image-positions` 호출은 `source: "generation"` 데이터가 없는 레거시 룩에만 실행
- 기존 few-shot 학습 루프는 유지 (수동 보정 → tag_corrections 저장)

### 6. analyze-image-positions 역할 축소

- 레거시 룩(tag_positions 없는 기존 데이터)에만 사용
- 새로 생성되는 룩에서는 호출되지 않으므로 AI 비용 절감

## 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `supabase/functions/generate-style/index.ts` | 프롬프트에 좌표 반환 지시 추가, rule-based anchor fallback, 응답에 tagPositions 포함 |
| `src/pages/StyleGenerator.tsx` | DB insert 시 tag_positions 저장, genData에서 tagPositions 전달 |
| `src/components/style/InteractiveProductTags.tsx` | `source: "generation"` 캐시 있으면 AI 재분석 스킵 |

## 기대 효과

- AI 태그 위치 분석 호출 제거 → 비용 절감 + 로딩 속도 향상
- 생성 시점의 구조 데이터(카테고리, 레이어 순서) 활용 → 정확도 대폭 향상
- 수동 보정 피드백 루프는 유지하여 지속적 개선

