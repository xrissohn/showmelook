
# 네비게이션 마이페이지 버튼에 등급 배지 추가

## 목표
모바일 메뉴와 데스크탑 네비게이션의 마이페이지 버튼에 사용자의 현재 등급(Free/Bronze/Silver/Gold/Platinum) 배지를 표시합니다.

---

## 변경 사항 요약

### 1. TierBadge 컴포넌트 분리 (재사용성)
`TierStatusCard.tsx` 내부에 있는 `TierBadge` 컴포넌트를 별도 파일로 분리하여 여러 곳에서 재사용할 수 있게 합니다.

**새 파일**: `src/components/ui/tier-badge.tsx`
- 등급별 색상 스타일 (Free: 회색, Bronze: 황동색, Silver: 은색, Gold: 금색, Platinum: 보라+핑크 그라디언트)
- `size` prop 추가 (`sm`, `md`) - 네비게이션에는 작은 사이즈 사용

### 2. MainNavigation 업데이트
**파일**: `src/components/MainNavigation.tsx`

- `usePurchaseStats` 훅을 import하여 로그인된 사용자의 등급 정보 조회
- **모바일 메뉴**: "마이페이지" 항목 옆에 등급 배지 표시
- **데스크탑**: 프로필/마이페이지 아이콘 버튼 추가 + 등급 배지 (또는 기존 장바구니 버튼 옆에 배치)

### 3. TierStatusCard 수정
기존 내부 `TierBadge`를 새로 분리한 컴포넌트로 대체합니다.

---

## 상세 구현

### 새 컴포넌트: TierBadge

```text
┌─────────────────────────────────────┐
│  TierBadge                          │
│  - tier: TierType                   │
│  - size: 'sm' | 'md' (기본: md)     │
│  - showIcon?: boolean               │
├─────────────────────────────────────┤
│  출력 예시:                          │
│  [👑 브론즈]  (md, 아이콘 포함)       │
│  [실버]      (sm, 아이콘 없음)        │
└─────────────────────────────────────┘
```

### MainNavigation 변경 (모바일)

변경 전:
```
[ User 아이콘 ] 마이페이지
```

변경 후:
```
[ User 아이콘 ] 마이페이지  [브론즈 배지]
```

### MainNavigation 변경 (데스크탑)

변경 전:
```
[ 요금제 ] [ 앱 설치 ] [ 장바구니 ] [ 내 스타일 만들기 ]
```

변경 후:
```
[ 요금제 ] [ 앱 설치 ] [ 프로필(등급배지) ] [ 장바구니 ] [ 내 스타일 만들기 ]
```

---

## 기술 세부사항

1. **데이터 로딩 최적화**: `usePurchaseStats`는 이미 캐싱 및 에러 핸들링이 구현되어 있어 네비게이션에서 바로 사용 가능
2. **조건부 렌더링**: 로그인한 사용자(`user`)가 있을 때만 등급 정보 조회 및 배지 표시
3. **로딩 상태**: 등급 로딩 중에는 배지 숨김 또는 스켈레톤 표시 (네비게이션이므로 숨김 권장)
4. **반응형**: 모바일에서는 `sm` 사이즈, 데스크탑에서는 `md` 사이즈 배지 사용

---

## 파일 변경 목록

| 파일 | 작업 |
|------|------|
| `src/components/ui/tier-badge.tsx` | 새로 생성 |
| `src/components/MainNavigation.tsx` | 수정 |
| `src/components/mypage/TierStatusCard.tsx` | 수정 (import 변경) |
