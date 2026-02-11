
# OG 이미지 공유 개선: AI 제거, 순수 이미지 합성 방식으로 전환

## 문제점
1. 현재 Gemini AI를 호출하여 OG 이미지를 생성하므로 **매번 비용이 발생**
2. AI 변환 결과도 여전히 **머리/발이 잘리는 문제** 해결이 불완전
3. 크롤러 요청 시 AI 호출 대기 시간으로 타임아웃 위험

## 해결 방안
Gemini AI 호출을 완전히 제거하고, **순수 캔버스 합성 방식**으로 전환합니다.
원본 세로형(portrait) 이미지를 1200x630 가로형 프레임 안에 **비율 유지하며 전체가 보이도록(object-contain 방식)** 배치합니다.

```text
+--------------------------------------------------+
|                                                    |
|    배경 (#F0F0F0)     +----------+    배경          |
|                       |          |                  |
|                       | 원본     |                  |
|                       | 전신     |                  |
|                       | 이미지   |                  |
|                       |          |                  |
|                       +----------+                  |
|                                                    |
+--------------------------------------------------+
          1200 x 630 (OG 표준 사이즈)
```

## 구현 내용

### 1. `og-image-gen` Edge Function 전면 수정
- Gemini AI 호출 코드 전체 삭제
- Deno 환경에서 사용 가능한 순수 **SVG + foreignObject** 방식으로 1200x630 이미지 생성
  - 원본 이미지를 fetch하여 base64로 변환
  - SVG 내에서 이미지를 중앙 배치 (contain 방식)
  - 배경색 #F0F0F0으로 채움
- SVG를 그대로 반환 (Content-Type: image/svg+xml)
- 캐싱 로직 유지 (storage에 SVG 저장)

### 2. `share-preview` Edge Function 수정
- `og:image` URL은 그대로 `og-image-gen?lookId=` 엔드포인트 유지
- SVG 형식이 일부 SNS에서 지원 안 될 경우를 대비해, **원본 이미지 URL을 직접 사용하되 og:image:width/height를 원본 비율로 지정**하는 대안도 준비

### 3. 대안 전략 (SVG 미지원 플랫폼 대비)
카카오톡은 SVG를 og:image로 지원하지 않을 수 있으므로, 가장 안정적인 방법:
- **원본 이미지 URL을 og:image로 직접 사용**
- `og:image:width`와 `og:image:height`를 **원본 비율 그대로** 설정 (예: 768x1024)
- 카카오톡은 `summary` 카드 타입에서 정사각형 크롭을 하지만, 이미지 자체가 전신이면 중앙 기준으로 가장 많이 보임

최종 권장: **og-image-gen에서 순수 PNG 합성** (canvas 대신 간단한 이미지 리사이징)
- 원본 이미지를 다운로드
- 1200x630 흰색/회색 배경 PNG에 원본을 contain 방식으로 중앙 배치
- Deno에서 사용 가능한 경량 이미지 라이브러리(`imagescript`) 활용

## 기술 상세

### og-image-gen 수정 (핵심)
```typescript
// 기존: Gemini AI 호출 (87~142줄) → 전체 삭제
// 신규: imagescript 라이브러리로 순수 이미지 합성

import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

// 1. 원본 이미지 다운로드
// 2. Image.decode()로 디코딩
// 3. 1200x630 캔버스 생성 (배경 #F0F0F0)
// 4. 원본을 비율 유지하며 캔버스 중앙에 contain 방식 배치
// 5. PNG로 인코딩하여 반환 + storage에 캐싱
```

### 비용 절감 효과
- Gemini AI 호출: **완전 제거 (비용 0원)**
- imagescript: Deno 네이티브 라이브러리, 추가 비용 없음
- 캐싱으로 동일 이미지 재생성 방지

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `supabase/functions/og-image-gen/index.ts` | Gemini AI 제거, imagescript 기반 순수 이미지 합성으로 전환 |
| `supabase/functions/share-preview/index.ts` | 변경 없음 (og-image-gen URL 그대로 사용) |
