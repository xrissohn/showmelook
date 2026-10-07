# 피드백·학습·리포트 시뮬레이션

실제 엣지 함수 코드(`submit-look-feedback`, `feedback-learning-report`)를 **가짜 DB·가짜 AI** 위에서 그대로 실행해,
페르소나별(게이·레즈비언·여장·남장·양성애자·스팸 등) 피드백 시나리오와 일일 리포트 흐름을 검증한다.
운영 DB·AI·메일에는 아무것도 보내지 않는다.

```bash
deno run --allow-all --import-map=scripts/qa/import_map.json --no-check scripts/qa/sim_feedback.ts
# QA_OUT=<폴더> 를 주면 결과(results.json)와 샘플 리포트(sample_report.html/.txt)를 그 폴더에 저장한다
```

Deno가 필요하다(`npm i deno` 로 설치 가능). `npm test`(vitest)에는 포함되지 않는다.
이 폴더는 `supabase/functions` 밖에 있어야 한다 — 안에 두면 함수 빌드 검사 대상이 된다.
