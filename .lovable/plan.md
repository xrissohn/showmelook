

# 수동 태그 위치 편집 + AI 학습 고도화

## 개요
유저가 자신의 룩 사진에서 AI 태그 위치를 드래그하여 수동으로 보정할 수 있게 하고, 이 보정 데이터를 축적하여 향후 AI 태그 정확도를 높이는 시스템을 구축한다.

## Phase 1: 수동 태그 드래그 이동 기능

### 1-1. InteractiveProductTags 컴포넌트 수정
- `isEditable` prop 추가 (본인 룩일 때만 true)
- 편집 모드 진입 버튼 ("태그 위치 조정" 버튼)
- 각 태그에 터치/마우스 드래그 핸들러 추가
  - `onPointerDown` -> `onPointerMove` -> `onPointerUp` 으로 드래그 구현
  - 드래그 중 태그 위치를 실시간 업데이트
  - 이미지 영역 밖으로 나가지 않도록 클램핑 (x: 5-95%, y: 3-97%)
- 편집 완료 시 "저장" 버튼으로 확정

### 1-2. DB 저장
- `generated_looks.tag_positions` 컬럼에 수동 보정된 좌표를 저장
- 각 position 객체에 `source: 'manual' | 'ai'` 필드 추가하여 구분
- 수동 보정된 위치는 AI 재분석 시에도 덮어쓰지 않음

### 1-3. UI/UX
- 편집 모드 시 태그에 드래그 아이콘 표시
- 드래그 중 가이드라인 또는 반투명 원 표시
- 모바일: 롱프레스 후 드래그로 이동
- 저장 시 토스트 알림

## Phase 2: 보정 데이터 축적 (tag_corrections 테이블)

### 2-1. 새 테이블 생성
```text
tag_corrections
- id: uuid (PK)
- look_id: uuid (FK -> generated_looks)
- user_id: uuid
- category: text (정규화된 카테고리)
- ai_x, ai_y: numeric (AI가 추정한 원본 좌표)
- manual_x, manual_y: numeric (유저가 보정한 좌표)
- image_url: text (분석 대상 이미지)
- created_at: timestamptz
```

### 2-2. 수동 보정 시 자동 기록
- 유저가 태그를 이동하고 저장할 때, AI 원본 좌표와 수동 좌표의 차이를 `tag_corrections`에 INSERT
- 이동 거리가 최소 5% 이상일 때만 기록 (미세 조정은 무시)

## Phase 3: AI 프롬프트 고도화 (Few-shot 학습)

### 3-1. 보정 데이터 활용
- `analyze-image-positions` Edge Function에서 해당 카테고리의 최근 보정 데이터 N개를 조회
- AI 프롬프트에 "과거 보정 사례"로 삽입 (Few-shot):
  ```
  과거 유저 보정 사례:
  - 가방: AI가 (25, 55)로 예측했으나 유저가 (35, 42)로 보정 (3건)
  - 모자: AI가 (50, 8)로 예측했으나 유저가 (50, 5)로 보정 (5건)
  ```
- 카테고리별 평균 보정 오프셋을 계산하여 DEFAULT_POSITIONS도 점진적 업데이트

### 3-2. 배치 학습 (dna-batch와 유사)
- 주기적으로 보정 데이터를 집계하여 카테고리별 최적 기본 좌표를 갱신
- `recommendation_patterns` 테이블과 유사한 패턴으로 관리

## 구현 순서
1. Phase 1 (수동 드래그) 먼저 구현하여 바로 유저가 사용할 수 있게 함
2. Phase 2 (데이터 축적) 동시에 구현 - 테이블 + 저장 로직
3. Phase 3 (AI 고도화)는 보정 데이터가 충분히 쌓인 후(50건+) 적용

## 수정 파일 목록
- `src/components/style/InteractiveProductTags.tsx` - 드래그 기능 추가
- `src/components/style/LookDetailModal.tsx` - 편집 모드 연동
- `src/pages/StyleGenerator.tsx` - 편집 모드 연동
- `supabase/functions/analyze-image-positions/index.ts` - Few-shot 프롬프트 추가
- DB 마이그레이션: `tag_corrections` 테이블 생성

