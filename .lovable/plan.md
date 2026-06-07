# 쇼미 AB 설문 — 전체 가입자 메일 발송 시스템

이미 `send-referral-success-email`에서 `noreply@showmelook.com` (Resend 인증 도메인)으로 발송이 동작 중이므로, 같은 경로로 설문 안내 메일을 일괄 발송합니다.

## 1) DB 변경

### `survey_email_sends` (신규)
- `user_id` (unique), `email`, `survey_key='shomi_ab_v1'`, `status` (`sent`/`failed`/`skipped`), `error`, `sent_at`
- RLS: admin SELECT, service_role ALL
- 발송 이력 기록 + 1인 1회 보장

### `profiles.email_opt_out` (신규 컬럼, boolean default false)
- 수신거부한 사용자 제외용

## 2) Edge Function: `send-survey-broadcast` (신규)

관리자 패널 "설문" 탭의 "전체 가입자에게 발송" 버튼이 호출.

흐름:
1. JWT 검증 + admin 권한 확인
2. `auth.users` + `profiles` 조회 (이메일 + opt_out=false)
3. 다음 사용자 제외:
   - `survey_responses`에 이미 응답한 user_id
   - `survey_email_sends`에 이미 발송된 user_id
   - `profiles.email_opt_out=true`
4. 배치 처리 (한 번에 50명씩, Resend rate limit 대응 — 초당 ~10건)
5. 각 메일에 유저별 unsubscribe 토큰 포함 (`https://showmelook.com/unsubscribe?token=...`)
6. 발송 결과를 `survey_email_sends`에 기록
7. 결과 요약 반환 (`{ total, sent, failed, skipped }`)

발송 본문: HTML 템플릿 (`send-referral-success-email`과 동일한 디자인 톤)
- 제목: "✨ 쇼미 캐릭터 AB 테스트 — 참여하고 무료 10크레딧 받으세요"
- CTA 버튼: "설문 참여하기" → https://showmelook.com/survey/shomi
- 푸터: "이 메일이 불편하셨다면 [수신거부]" 링크

## 3) Edge Function: `survey-unsubscribe` (신규, JWT 없음)

GET `?token=<base64(user_id:hmac)>` 요청을 받아:
1. HMAC 검증 (`SURVEY_UNSUB_SECRET` 시크릿 사용 — 신규 추가 필요)
2. `profiles.email_opt_out=true` 업데이트
3. 간단한 HTML 페이지 응답: "수신거부 처리되었습니다. 다시 받으시려면 마이페이지에서 변경하세요."

## 4) 관리자 패널 (`SurveyPanel.tsx`) 업데이트

기존 "메일 본문 복사" 섹션 아래에 새 카드 추가:

**"앱에서 직접 발송 (noreply@showmelook.com)"**
- 발송 대상 미리보기: "총 N명 (이미 응답 M명 / 이미 발송 K명 제외 → 실제 발송 X명)"
- "테스트 발송" 버튼 (본인 이메일에만 1건)
- "전체 발송" 버튼 + 확인 다이얼로그 ("X명에게 실제 발송됩니다. 진행하시겠습니까?")
- 발송 진행 상황 실시간 표시
- 발송 통계: 성공/실패 카운트

기존 "Gmail BCC" 섹션은 백업 옵션으로 유지.

## 5) 신규 시크릿

- `SURVEY_UNSUB_SECRET` — unsubscribe 토큰 HMAC 키 (랜덤 문자열, 사용자에게 add_secret으로 요청)

## 기술 사항

- 발송 함수는 `config.toml`에 `verify_jwt = false`로 등록 후 내부에서 JWT/admin 검증
- Resend는 직접 fetch (`https://api.resend.com/emails`), 기존 `send-referral-success-email`과 동일 패턴
- 배치 발송 시 `Promise.allSettled` + 50개씩 청크, 청크 사이 200ms sleep
- 발송 결과는 트랜잭션 아니어도 됨 (각 메일 독립 기록)
- TypeScript 타입은 마이그레이션 후 자동 재생성
- 한국 정보통신망법: "(광고)" 표기는 정보성/설문 보상 안내라 생략 가능하지만, 안전하게 메일 제목 앞에 `[쇼미룩]` 브랜드 표기 + 푸터에 발신자 정보 명시

## 발송 한도 주의

Resend 무료 플랜은 일일 100건이라 가입자 수가 그 이상이면 유료 플랜 업그레이드가 필요합니다. 발송 직전 관리자에게 알림 + 실패 시 자동 중단합니다.
