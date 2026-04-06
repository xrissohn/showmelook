

## sub_style 미생성 상품 일괄 업데이트 계획

### 문제 분석
- 5,075개 상품 중 114개만 `sub_style` 보유 (2.2%)
- 현재 `forceRegenerate`는 `dna_generated_at` 기준 필터라 이미 DNA가 있는 상품은 스킵됨
- sub_style 추출은 AI 호출 없이 규칙 기반이므로 한 번에 대량 처리 가능

### 구현 계획

**1. dna-batch Edge Function에 `subStyleOnly` 모드 추가**
- 새 파라미터: `{ subStyleOnly: true }`
- `dna_meta`는 있지만 `sub_style`이 없는 상품만 조회
- 기존 `dna_meta`를 유지하면서 `sub_style` 필드만 추가
- AI 호출 없이 `extractSubStyle()` 함수만 사용하므로 배치 사이즈를 **500개**로 대폭 확대
- 자동 반복 루프: 한 배치 완료 후 남은 상품이 있으면 계속 처리 (최대 20회 반복, ~10,000개 커버)

**2. Admin UI 업데이트 (`src/pages/Admin.tsx`)**
- 기존 "전체 DNA 재생성" 대신 **"세부 스타일 일괄 추출"** 버튼 추가
- 진행 상황 표시: "처리 중... 500/4961개 완료"
- `subStyleOnly: true`로 dna-batch 호출

**3. 처리 흐름**
```text
Admin 클릭 → dna-batch(subStyleOnly=true)
  → SELECT WHERE dna_meta IS NOT NULL 
           AND (dna_meta->>'sub_style' IS NULL)
  → LIMIT 500
  → 각 상품: extractSubStyle(name) → dna_meta.sub_style 업데이트
  → 반복 (남은 상품 > 0이면 계속)
  → 응답: { processed: 4961, total: 5075 }
```

### 기술 상세
- `extractSubStyle()` 함수는 이미 dna-batch에 구현되어 있음 (100+ 세부 스타일 매핑)
- UPDATE 쿼리: `dna_meta = {...기존dna_meta, sub_style: 추출값}` 형태로 병합
- Edge Function 타임아웃(~60초) 안에 500개 규칙 기반 처리 충분히 가능

