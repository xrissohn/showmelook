

# Admin 페이지 정리 및 자동화 계획

## 요약
16개 탭 → 13개 탭으로 축소. 부하테스트/Rate Limiter 삭제, 처리량+추론 통합, DNA 배치/에러정리/캐시정리 자동화. 쿠팡 리포트와 카페24 유지.

---

## 1. 삭제할 탭 (2개)

| 탭 | 이유 |
|---|---|
| **부하 테스트** (`loadtest`) | 개발 전용 |
| **Rate Limiter** (`ratelimit`) | 개발/디버깅 전용 |

삭제 대상 컴포넌트 파일:
- `src/components/admin/LoadTestPanel.tsx`
- `src/components/admin/TokenBucketMonitor.tsx`

## 2. 통합할 탭 (2→1)

**처리량 분석 + 추론 성능 → "성능 분석" 단일 탭**
- `ThroughputAnalytics`와 `InferenceMetricsPanel`을 하나의 탭에 상하 배치

## 3. 자동화 전환 (수동 버튼 → pg_cron)

| 기능 | 현재 | 변경 |
|---|---|---|
| DNA 배치 생성 | DNA 탭에서 수동 버튼 | `pg_cron` 10분 주기 자동 (batchSize: 50) |
| 에러 로그 30일 삭제 | 에러 탭에서 수동 버튼 | `pg_cron` 매일 00:00 자동 |
| 추천 캐시 정리 | 관리도구 탭에서 수동 버튼 | `pg_cron` 매일 01:00 자동 |

## 4. 간소화할 탭

### DNA 관리 탭
- **제거**: DNA 배치 생성 수동 버튼/셀렉트 (자동화됨)
- **유지**: DNA 커버리지 통계 + 피드백 학습 현황 (읽기 전용)

### 관리도구 탭
- **제거**: "추천 캐시 정리" 버튼 (자동화됨)
- **유지**: 일일 생성 횟수 초기화 + 상품 통계

### 에러 로그 탭
- **제거**: "30일 이전 삭제" 버튼 (자동화됨)
- **유지**: 에러 모니터링 + 새로고침

## 5. 쿠팡 리포트 수정
- 현재 `TabsTrigger`는 존재하지만 이전에 누락 여부 확인 → 코드상 정상 존재 확인됨 (line 1369-1372, TabsContent line 2719-2721)

## 6. 최종 탭 구성 (13개)

1. 제품 등록 | 2. DNA/피드백 (통계만) | 3. AI 추천 | 4. 딥링크
5. 등록 대기 | 6. 이미지 관리 | 7. 상품 관리 | 8. 사용자 관리
9. 에러 로그 | 10. 생성 큐 | 11. 성능 분석 (통합) | 12. 관리도구 (간소화)
13. 카페24 | 14. 쿠팡 리포트

## 7. 변경 파일 목록

- `src/pages/Admin.tsx` — 탭 삭제/통합/간소화, import 정리, 관련 state/함수 제거
- `src/components/admin/LoadTestPanel.tsx` — 삭제
- `src/components/admin/TokenBucketMonitor.tsx` — 삭제
- DB: `pg_cron` 3개 스케줄 등록 (dna-batch, cleanup-errors, cleanup-cache)

