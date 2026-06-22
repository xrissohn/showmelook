## 문제 진단

콘솔에 다음 에러가 반복적으로 찍히고 있습니다:

```
Error preloading looks: { code: "57014", message: "canceling statement due to statement timeout" }
```

원인은 두 가지가 겹쳐 있습니다.

1. **DB 쿼리 타임아웃**: `generated_looks` 테이블에 `(user_id, created_at)` 복합 인덱스가 없습니다. 현재 인덱스는 `is_public=true` 조건부 인덱스 3개와 PK뿐이라, 본인 룩을 `user_id`로 필터링할 때 풀 스캔에 가까운 비용이 발생 → 룩이 많은 계정은 statement timeout(8초)에 걸려 `[]`가 반환됨 → 화면에 즉시 "아직 생성된 룩이 없습니다"가 뜸.
2. **로딩 중에도 빈 상태 화면 표시**: `StyleGenerator.tsx`의 `MyLooksGallery`는 `myLooks.length === 0`이면 곧바로 빈 상태 UI를 보여줍니다. 로딩 중인지 여부를 체크하지 않아, 프리로더가 데이터를 가져오는 동안에도 첨부 이미지처럼 "룩 없음" 화면이 깜빡입니다.

## 해결 방안

### 1) DB 인덱스 추가 (마이그레이션)

```sql
CREATE INDEX IF NOT EXISTS idx_generated_looks_user_created
  ON public.generated_looks (user_id, created_at DESC);
```

이걸로 본인 룩 조회는 인덱스 스캔으로 ms 단위로 떨어집니다 (현재 timeout → 정상화).

### 2) 프리로더 쿼리 경량화 (`src/contexts/DataPreloaderContext.tsx`)

- 첫 로드는 최신 100개로 LIMIT (`.limit(100)`). 마이갤러리 첫 화면에 충분.
- 무거운 컬럼(`tag_positions`, `style_reasoning`)은 1차 로드에서 제외하고, 상세 모달 열 때만 fetch (지금은 매번 전부 가져와서 페이로드도 큽니다).

### 3) 로딩 상태로 빈 화면 가드 (`src/pages/StyleGenerator.tsx`)

`MyLooksGallery`에 `isLooksLoading` prop을 받아, 로딩 중이면 스피너를 보이고, 로딩이 끝났는데 비어 있을 때만 "아직 생성된 룩이 없습니다"를 표시.

### 4) StyleGenerator 보조 쿼리도 LIMIT 추가

`refreshLooksOnly`와 메인 fetch에서 `generated_looks` 조회 시 동일하게 `.limit(100)` 적용 → 같은 타임아웃 재발 방지.

## 변경 파일

- `supabase/migrations/<new>.sql` — 인덱스 추가
- `src/contexts/DataPreloaderContext.tsx` — select 컬럼 축소 + limit
- `src/pages/StyleGenerator.tsx` — 로딩 가드 + limit 추가

## 검증

- 마이그레이션 적용 후 콘솔에 `57014` 에러 없는지 확인
- /mypage(또는 /style의 마이갤러리 탭) 진입 시 첨부 화면이 더 이상 깜빡이지 않고, 룩이 즉시 표시되는지 확인
