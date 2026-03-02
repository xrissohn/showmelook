

# style-recommend 페이지네이션 + 신상품 가산점 구현

## 문제
현재 `style-recommend` Edge Function의 DB 쿼리(라인 1421-1429)가 Supabase 기본 1000행 제한에 걸려, 전체 3,176개+ 상품 중 1,000개만 조회됨. 최근 등록된 신상품이 추천 후보에서 빠지는 원인.

## 변경 사항

### 1. 페이지네이션 헬퍼 함수 추가
`fetchAllProducts`라는 헬퍼 함수를 추가하여, `.range()`를 사용해 1,000개씩 반복 조회 후 합산. 최대 10,000개까지 지원.

```text
async function fetchAllProducts(supabase, filters) {
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('products_cache')
      .select(...)
      .eq('is_active', true)
      .eq('is_in_stock', true)
      .not('image_url', 'is', null)
      .not('dna_meta', 'is', null)
      .range(from, from + PAGE_SIZE - 1);
    
    if (error || !data || data.length === 0) break;
    allData.push(...data);
    if (data.length < PAGE_SIZE) break; // 마지막 페이지
    from += PAGE_SIZE;
  }
  return allData;
}
```

기존 라인 1421-1429의 단일 쿼리를 이 함수 호출로 교체.

### 2. Freshness Boost (신상품 가산점) 함수 추가
`collected_at` 기준으로 최근 등록된 상품에 가산점 부여:

- 3일 이내: +15% (0.15)
- 7일 이내: +10% (0.10)  
- 14일 이내: +5% (0.05)
- 그 이상: 0%

### 3. 스코어링 로직 수정 (라인 1589-1608)
기존 점수 계산에 freshness 가산점을 추가:

```text
// 기존
totalScore = (feedbackScore * 0.25) + (conceptScore * 0.35) + (formalityScore * 0.25) + diversityBonus

// 변경: freshness 추가 (기존 가중치 약간 조정)
const freshnessBonus = calculateFreshnessBoost(p.collected_at);
totalScore = (feedbackScore * 0.20) + (conceptScore * 0.35) + (formalityScore * 0.20) + freshnessBonus + diversityBonus
```

### 4. Stage 2 AI 프롬프트에 [NEW] 태그 추가
Stage 2에 전달하는 상품 목록에서, 14일 이내 등록된 상품에 `[NEW]` 태그를 붙이고, 프롬프트에 "동일 조건이면 신상품 우선 선택" 지시 추가.

## CachedProduct 인터페이스 수정
`collected_at` 필드를 인터페이스에 추가 (이미 DB에는 존재하나 타입 정의에 누락).

## 수정 파일
- `supabase/functions/style-recommend/index.ts` (단일 파일)

## 기대 효과
- 전체 상품이 추천 후보에 포함됨 (1,000개 제한 해소)
- 신상품이 자연스럽게 더 자주 노출되되, 기존 인기 상품도 계속 추천됨
- 추가 쿼리 시간: 약 2-3초 (3,176개 기준 4회 쿼리)

