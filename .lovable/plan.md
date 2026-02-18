

# 사진별 + 갤러리별 보기 + 유저 갤러리 이동

## 개요
현재 `/community`는 사진(룩) 단위로만 볼 수 있는 단일 피드입니다. 여기에 **갤러리(유저) 단위 탭**을 추가하고, 사진을 보다가 마음에 드는 유저의 갤러리로 바로 이동할 수 있게 합니다.

---

## UX 흐름

```text
/community
  ├─ [사진별] 탭: 현재와 동일한 개별 룩 그리드 (기본)
  │    └─ 각 카드에 유저 닉네임 표시 → 클릭 시 /gallery/:userId 이동
  │
  └─ [갤러리별] 탭: 유저 단위 카드 목록
       └─ 유저 아바타 + 닉네임 + 대표 룩 3~4장 미리보기 + 공개 룩 수
            └─ 클릭 시 /gallery/:userId 이동

/gallery/:userId (유저 갤러리 페이지)
  ├─ 타인 방문: 공개 룩만 표시
  └─ 본인 방문: 전체 룩 + 각 룩별 공개/비공개 토글(잠금/지구 아이콘)
       └─ 탭 필터: 전체 / 공개만 / 비공개만
```

---

## 구현 항목

### 1. DB 변경: profiles 테이블 RLS 정책 추가

현재 `profiles` 테이블은 본인만 조회 가능합니다. 유저 갤러리에서 닉네임/아바타를 보여주려면 **공개 프로필 정보 조회를 위한 RLS 정책**이 필요합니다.

- 새 SELECT 정책: "Anyone can view public profile info" -- 모든 사용자가 `full_name`, `avatar_url` 조회 가능
- 보안 방법: RLS에서 전체 SELECT를 열되, 민감 정보(height, weight 등)는 프론트에서 필요한 컬럼만 select하는 방식으로 제한. 또는 `user_id`, `full_name`, `avatar_url`만 반환하는 DB View를 생성.
- **추천 방식:** `profiles_public`이라는 DB View를 생성하여 `user_id`, `full_name`, `avatar_url`만 노출. 이 View에 별도 RLS 없이 누구나 조회 가능하게 설정.

### 2. Community 페이지에 탭 추가

| 탭 | 내용 |
|---|---|
| 사진별 (기본) | 현재 LookCard 그리드 (변경 없음) + 유저 닉네임 오버레이 추가 |
| 갤러리별 | 공개 룩이 있는 유저 목록을 카드로 표시 |

- 탭 전환은 Radix Tabs 또는 간단한 버튼 그룹 사용
- 각 탭에서 정렬(인기순/최신순) 필터는 그대로 유지

### 3. LookCard에 유저 정보 추가

- 카드 좌상단에 유저 닉네임 표시 (작은 텍스트, 반투명 배경)
- 닉네임 클릭 시 `/gallery/:userId`로 이동 (이벤트 전파 차단)
- `useCommunityFeed`에서 피드 fetch 후 고유 `user_id` 목록 추출 → `profiles_public` 뷰에서 배치 조회 → 룩 데이터에 매핑

### 4. 갤러리별 탭 구현 (GalleryList)

- `useGalleryUsers` 훅: 공개 룩이 1개 이상인 유저 목록 조회
  - 쿼리: `generated_looks`에서 `is_public = true`인 고유 `user_id` 추출 + 각 유저별 공개 룩 수, 총 좋아요 합산
  - `profiles_public` 뷰에서 닉네임/아바타 배치 조회
- `GalleryUserCard` 컴포넌트: 아바타 + 닉네임 + 대표 이미지 미리보기(최대 4장) + 공개 룩 수 + 총 좋아요

### 5. 유저 갤러리 페이지 (`/gallery/:userId`)

- **프로필 헤더:** 아바타, 닉네임, 공개 룩 수, 받은 총 좋아요 수
- **타인 방문:** 공개 룩만 그리드로 표시 + 좋아요 기능
- **본인 방문:**
  - 탭 필터: 전체 / 공개 / 비공개
  - 각 룩 카드 우상단에 공개(지구)/비공개(잠금) 토글 아이콘
  - 비공개 룩은 `opacity-60` + 잠금 아이콘 오버레이로 시각 구분
  - "전체 공개" / "전체 비공개" 일괄 토글 버튼

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| DB 마이그레이션 | `profiles_public` 뷰 생성 (user_id, full_name, avatar_url) |
| `src/hooks/useCommunityFeed.ts` | 유저 프로필 배치 조회 추가, CommunityLook에 user_name/user_avatar 필드 추가 |
| `src/hooks/useGalleryUsers.ts` | **신규** - 갤러리별 탭용 유저 목록 훅 |
| `src/hooks/useUserGallery.ts` | **신규** - 개별 유저 갤러리 데이터 훅 |
| `src/components/community/LookCard.tsx` | 유저 닉네임 추가 + 갤러리 링크 |
| `src/components/community/GalleryUserCard.tsx` | **신규** - 갤러리별 탭의 유저 카드 |
| `src/components/community/GalleryLookCard.tsx` | **신규** - 갤러리 내 공개/비공개 토글 카드 |
| `src/pages/Community.tsx` | 사진별/갤러리별 탭 추가 |
| `src/pages/UserGallery.tsx` | **신규** - 유저 갤러리 페이지 |
| `src/App.tsx` | `/gallery/:userId` 라우트 추가 |

---

## 기술 상세

### profiles_public 뷰 (DB)
```text
CREATE VIEW profiles_public AS
SELECT user_id, full_name, avatar_url
FROM profiles;

GRANT SELECT ON profiles_public TO anon, authenticated;
```
이렇게 하면 기존 profiles RLS를 건드리지 않으면서 공개 정보만 안전하게 노출합니다.

### useCommunityFeed 변경
- fetch 완료 후 고유 user_id 배열 추출
- `profiles_public`에서 해당 user_id들의 full_name, avatar_url 배치 조회
- CommunityLook 객체에 user_name, user_avatar 매핑

### useGalleryUsers 훅
- `generated_looks`에서 `is_public = true`인 레코드의 user_id별 count, sum(like_count) 집계
- DB 함수 또는 클라이언트 사이드 집계
- `profiles_public`에서 프로필 정보 매핑
- 대표 이미지: 각 유저별 like_count 상위 4개 룩의 image_url

### useUserGallery 훅
- userId 파라미터
- 본인이면 전체 룩 조회 (RLS가 `is_public=true OR auth.uid()=user_id` 허용)
- 타인이면 공개 룩만 조회
- 프로필 정보 + 통계(공개 룩 수, 총 좋아요) 계산

### GalleryLookCard (본인 갤러리용)
- LookCard 기반 + 우상단 토글 버튼
- 비공개 상태: opacity-60 + 잠금 아이콘
- 토글 시 `generated_looks.update({ is_public })` 호출 + 낙관적 UI

