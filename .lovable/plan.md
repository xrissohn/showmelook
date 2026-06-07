## 개요

세 가지 조각으로 구성합니다.
1. **앱 내 설문 페이지** `/survey/shomi` — 두 시안을 보여주고 선택 + 의견 받기
2. **자동 크레딧 지급** — 제출 즉시 `referral_rewards`에 10 보너스 크레딧 적립 (1인 1회)
3. **관리자 발송 도구** — 전체 가입자 이메일 CSV 내보내기 + 발송용 본문 템플릿 제공. 메일은 직접 Gmail에서 BCC로 발송 (대량 마케팅성 발송은 Lovable 시스템 발송 대상이 아니므로 외부 메일로 처리)

---

## 1) 이미지 업로드

- 두 시안 이미지를 Supabase Storage `avatars` 또는 새 public 버킷 `survey-assets`에 업로드 (관리자 페이지에 업로드 UI 추가, 또는 직접 업로드 후 URL 입력)

## 2) 설문 페이지 `/survey/shomi`

화면 구성:
- 헤더: "쇼미 캐릭터 AB 테스트 — 의견 주시면 10크레딧 드려요"
- 두 시안 카드 (A / B) — 큰 이미지, 라디오 선택
- 자유 의견 textarea (선택, 500자)
- "제출하고 10크레딧 받기" 버튼
- 비로그인 시 로그인 페이지로 유도 (제출하려면 로그인 필수)
- 이미 제출한 유저: "이미 참여하셨어요. 10크레딧이 지급되었습니다" 안내

로직:
- 로그인 확인 → `survey_responses`에 insert (user_id unique 제약으로 중복 차단)
- 성공 시 edge function `grant-survey-credit` 호출 → `referral_rewards`에 10크레딧 추가
- 완료 화면 + "지금 스타일 생성하러 가기" CTA

## 3) DB 스키마

```text
survey_responses
  - id uuid pk
  - user_id uuid unique (1인 1회)
  - survey_key text default 'shomi_ab_v1'
  - choice text  ('A' | 'B')
  - feedback text
  - created_at timestamptz
RLS: 본인만 select/insert, admin 전체 select
```

## 4) Edge Function `grant-survey-credit`

- JWT 검증 (auth.getUser → claims fallback)
- 이미 `referral_rewards`에 `reward_type='survey_shomi_ab'`로 받은 적 있으면 거부
- service role로 10 amount/remaining_amount, is_permanent=true, referral_code='SURVEY_SHOMI' 로 insert

## 5) 관리자 페이지 (`/admin` 내 새 탭 "설문")

- 응답 통계: 총 응답 수, A/B 비율, 최근 피드백 목록
- **"가입자 이메일 CSV 다운로드"** 버튼 — `profiles` + `auth.users` 조인하여 email/이름 CSV 내보내기 (admin-get-users 함수 확장)
- **메일 본문 템플릿 미리보기/복사** — Gmail에서 그대로 붙여넣어 BCC로 발송할 수 있는 한국어 본문 (설문 링크 https://showmelook.com/survey/shomi 포함)

## 6) 메일 발송 안내

대량 메일은 Lovable 메일 인프라로는 발송하지 않습니다 (수신자 평판/스팸 정책). 다음 중 선택:
- **권장**: 다운로드한 CSV의 이메일을 Gmail의 BCC에 붙여넣어 직접 발송 (Gmail 1일 약 500건 제한, 초과 시 분할)
- 발송량이 많거나 오픈율 추적이 필요하면 추후 Brevo/Mailgun 같은 외부 서비스 연동

---

## 기술 사항

- 신규 라우트 `/survey/shomi` 를 `src/App.tsx` 라우터에 추가
- 마이그레이션: `survey_responses` 테이블 생성 + GRANT + RLS (authenticated 본인, admin SELECT)
- 신규 Edge Function: `grant-survey-credit` (config.toml 등록, verify_jwt=false + 내부 토큰 검증)
- 관리자 패널: `src/pages/Admin.tsx`에 "설문" 탭 추가, `SurveyPanel.tsx` 신규
- CSV 내보내기: 기존 `admin-get-users` 함수 재사용 가능 여부 확인 후 필요한 컬럼만 클라이언트에서 CSV 변환
- 이메일 본문: 정적 텍스트 + 설문 URL, 클립보드 복사 버튼
