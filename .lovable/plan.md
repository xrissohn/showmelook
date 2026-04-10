

## 쿠팡 배치 pg_cron 스케줄 업데이트

### 문제
현재 크론 잡(jobid: 5)의 body가 `{"limit": 20}`으로 고정되어 있어, `coupang-batch` 함수 내 카테고리별 limit 설정(여성패션 100, 남성패션 100, 신발 50, 가방 30)이 무시됩니다.

### 변경 사항

**1. 기존 크론 잡 삭제 후 재생성**

기존 `coupang-batch-hourly`(jobid 5)를 삭제하고, limit 파라미터를 제거한 새 잡을 생성합니다.

```sql
-- 기존 잡 삭제
SELECT cron.unschedule('coupang-batch-hourly');

-- 새 잡 생성 (limit 제거 → 카테고리별 기본값 사용)
SELECT cron.schedule(
  'coupang-batch-hourly',
  '0 */2 * * *',  -- 2시간마다 (API rate limit 고려)
  $$
  SELECT net.http_post(
    url := 'https://mggedvvzpwxlgrhatrau.supabase.co/functions/v1/coupang-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
```

### 주요 변경점
- **limit 파라미터 제거**: Edge Function 내 카테고리별 기본 limit(100/50/30)이 자동 적용됨
- **스케줄 변경**: 매시간 → 2시간마다 (6개 카테고리 × 최대 100개 = API 호출량 증가 반영)
- `{"scheduled": true}`만 전달하여 향후 카테고리 추가/변경 시 함수 코드만 수정하면 크론은 자동 반영

### 기술 세부사항
- `cron.unschedule` → `cron.schedule` 순서로 SQL 실행 (insert tool 사용)
- 기존 다른 크론 잡(DNA batch, cleanup 등)은 변경 없음

