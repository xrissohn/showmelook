

# 경량 갤러리 (Strategy B) 구현 계획

## 개요
사용자가 자신의 AI 스타일링을 공개/비공개로 설정하고, 공개된 룩을 모든 사람이 탐색할 수 있는 경량 스타일 갤러리를 구현합니다. 댓글/팔로우 없이 **좋아요 + 구매 버튼**만 있는 심플한 구조입니다.

**현재 상태:** `generated_looks` 테이블에 `is_public` 필드가 이미 존재하며, 265개 룩 중 225개가 이미 공개 상태입니다 (SNS 공유 시 자동 공개).

---

## 구현 항목

### 1. DB 마이그레이션

**새 테이블: `look_likes`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `look_id` (uuid, NOT NULL, FK -> generated_looks)
- `created_at` (timestamptz, default now())
- UNIQUE(user_id, look_id) -- 중복 좋아요 방지

**`generated_looks` 컬럼 추가:**
- `like_count` (integer, default 0) -- 비정규화 카운트로 정렬 성능 확보
- `view_count` (integer, default 0)
- `caption` (text, nullable) -- 사용자 한마디

**RLS 정책 (look_likes):**
- SELECT: 모든 인증 사용자 허용
- INSERT: `auth.uid() = user_id` (본인만)
- DELETE: `auth.uid() = user_id` (좋아요 취소)

---

### 2. 새 파일 생성

| 파일 | 역할 |
|------|------|
| `src/pages/Community.tsx` | 메인 피드 페이지 (/community) |
| `src/components/community/LookCard.tsx` | 피드 카드 컴포넌트 |
| `src/components/community/CommunityFilters.tsx` | 필터 바 (성별/스타일/정렬) |
| `src/hooks/useCommunityFeed.ts` | 피드 데이터 fetching + 무한스크롤 |
| `src/hooks/useLookLikes.ts` | 좋아요 토글 훅 |

---

### 3. /community 피드 페이지

**레이아웃:**
- 상단: 필터 바 (인기순/최신순 + 성별 필터)
- 본문: 카드 그리드 (모바일 2열, 데스크톱 3~4열)
- 무한 스크롤 (기존 `useInfiniteScroll` 훅 재활용)

**LookCard 구성:**
- AI 스타일 이미지 (aspect-ratio 3:4)
- 좋아요 버튼 + 카운트 (하트 아이콘)
- 스타일 태그 뱃지 (최대 3개)
- 캡션 (있을 경우)
- 클릭 시 `/look/:lookId` 상세 페이지로 이동 (기존 SharedLook 재활용)

**데이터 쿼리:**
```text
generated_looks WHERE is_public = true
ORDER BY like_count DESC (인기순) 또는 created_at DESC (최신순)
```

---

### 4. StyleGenerator 공개/비공개 토글

**갤러리 카드에 추가:**
- 각 룩 카드에 공개/비공개 토글 아이콘 (잠금/지구 아이콘)
- 토글 시 `is_public` 필드 업데이트

**생성 직후:**
- 결과 화면에 "커뮤니티에 공개" 스위치 추가
- 캡션 입력 필드 (선택사항)

---

### 5. 좋아요 기능 (useLookLikes 훅)

**기능:**
- 좋아요 토글 (INSERT/DELETE on look_likes)
- 토글 시 `generated_looks.like_count` 동시 업데이트 (+1/-1)
- 낙관적 업데이트 (즉시 UI 반영)
- 로그인 안 된 경우 로그인 유도 토스트

---

### 6. 네비게이션 메뉴 추가

- **데스크톱:** "스타일 갤러리" 버튼 추가 (요금제 옆)
- **모바일 햄버거 메뉴:** "스타일 갤러리" 항목 추가 (스타일 만들기 아래)

---

### 7. 라우팅 추가

`App.tsx`에 `/community` 라우트 추가 (lazy import)

---

## 구현 순서

1. DB 마이그레이션 (look_likes 테이블 + generated_looks 컬럼 추가 + RLS)
2. `useLookLikes.ts` 훅 생성
3. `useCommunityFeed.ts` 훅 생성
4. `LookCard.tsx` + `CommunityFilters.tsx` 컴포넌트 생성
5. `Community.tsx` 페이지 생성
6. `App.tsx` 라우트 추가
7. `MainNavigation.tsx` 메뉴 추가
8. `StyleGenerator.tsx`에 공개/비공개 토글 + 캡션 입력 추가

