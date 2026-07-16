# ShowMeLook (쇼미룩)

> AI 에이전트와 실제 패션 상품·공개 코디 데이터를 연결하는 오픈소스 패션 커머스 플랫폼

[![CI](https://github.com/xrissohn/showmelook/actions/workflows/ci.yml/badge.svg)](https://github.com/xrissohn/showmelook/actions/workflows/ci.yml)
[![CodeQL](https://github.com/xrissohn/showmelook/actions/workflows/codeql.yml/badge.svg)](https://github.com/xrissohn/showmelook/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) · [서비스](https://showmelook.com) · [MCP 연결](#mcp-연결) · [기여하기](CONTRIBUTING.md)

## 프로젝트 소개

ShowMeLook은 체형·취향·상황을 바탕으로 코디를 구성하고, 실제 구매 가능한 상품과 공개 스타일 콘텐츠를 연결하는 패션 플랫폼입니다. 이 저장소에는 React 기반 웹 앱, Supabase Edge Functions, 상품·커뮤니티 데이터 계층, 그리고 AI 클라이언트가 패션 데이터를 사용할 수 있게 하는 **ShowMeLook MCP 서버**가 포함되어 있습니다.

2026 오픈소스 개발자대회 출품 기준의 핵심 오픈소스 범위는 `src/lib/mcp`와 이를 구동하는 공개 데이터 인터페이스입니다. 이 MCP 경로는 특정 AI 모델을 탑재하지 않는 모델 중립형 커넥터이며, 읽기 전용 도구를 제공합니다. 전체 서비스의 선택적 이미지 생성·추천 경로에서 사용하는 외부 상용 모델은 대회 기준 경로와 분리되어 있습니다. 자세한 내용은 [AI 모델 공개 문서](docs/AI_MODEL_DISCLOSURE.md)를 확인하세요.

## 핵심 기능

- 개인 프로필 기반 스타일 탐색: 성별, 키, 체중, 체형, 선호 스타일과 TPO를 반영합니다.
- 실제 상품 연결: 브랜드·가격·재고·이미지·구매 링크를 코디 결과와 함께 제공합니다.
- 공개 룩 갤러리: 생성된 코디를 저장·공유하고 좋아요와 조회 기반으로 탐색합니다.
- MCP 커넥터: AI 에이전트가 상품 검색, 상품 상세 조회, 공개 룩 탐색을 수행할 수 있습니다.
- PWA: 모바일 설치, 코드 분할, 오프라인 자산 캐싱을 지원합니다.
- 운영 도구: 상품 수집·정제, 피드백, 제휴 링크, Cafe24 연동, 추론 모니터링 기능을 포함합니다.

## MCP 도구

| 도구 | 역할 | 변경 여부 |
|---|---|---|
| `search_products` | 키워드·카테고리·성별·가격으로 판매 가능 상품 검색 | 읽기 전용 |
| `get_product` | 상품 ID로 가격·이미지·스타일 태그·구매 URL 조회 | 읽기 전용 |
| `list_public_looks` | 최신순 또는 인기순 공개 코디 탐색 | 읽기 전용 |

MCP 구현은 `src/lib/mcp`에 있으며 Supabase Edge Function용 번들은 `supabase/functions/mcp`에 생성됩니다.

## 아키텍처

```text
React + Vite PWA
       │
       ├── Supabase Auth / PostgreSQL / Storage
       │        └── Edge Functions (Deno)
       │
       └── ShowMeLook MCP
                ├── search_products
                ├── get_product
                └── list_public_looks
```

전체 웹 서비스의 선택적 추천·이미지 생성 경로는 별도 AI 게이트웨이를 사용할 수 있습니다. MCP 출품 경로는 모델 호출 없이 공개 상품·코디 데이터만 제공합니다.

## 빠른 시작

### 요구 사항

- Node.js 22 이상
- npm 10 이상
- 로컬 백엔드까지 실행할 경우 Supabase CLI

```bash
git clone https://github.com/xrissohn/showmelook.git
cd showmelook
cp .env.example .env.local
npm ci
npm run dev
```

브라우저에서 `http://localhost:8080`을 엽니다.

### 환경 변수

프런트엔드 최소 설정:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

MCP 서버는 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`(또는 `SUPABASE_ANON_KEY`)를 사용합니다. 서비스 역할 키와 외부 API 키는 클라이언트 번들에 넣지 마세요. 전체 목록과 설명은 [.env.example](.env.example)에 있습니다.

## 검증

```bash
npm run lint
npm test
npm run build
```

현재 테스트는 인앱 브라우저 감지기의 12개 동작을 검증하며, CI는 lint·test·production build를 모두 실행합니다.

## 오픈소스 및 대회 자료

- [CONTRIBUTING.md](CONTRIBUTING.md): 개발 환경, 브랜치, PR 기준
- [SECURITY.md](SECURITY.md): 취약점 비공개 신고 정책
- [docs/SBOM.md](docs/SBOM.md): 직접 의존성 자재명세서
- [docs/AI_MODEL_DISCLOSURE.md](docs/AI_MODEL_DISCLOSURE.md): 모델·AI 보조도구 공개 범위
- [docs/CONTEST_COMPLIANCE.md](docs/CONTEST_COMPLIANCE.md): 대회 제출 범위와 규정 체크리스트
- [CHANGELOG.md](CHANGELOG.md): 사용자 관점 변경 이력
- [RELEASING.md](RELEASING.md): 버전 및 릴리스 절차

## 보안·개인정보

사진, 체형 정보, 이메일 등 개인정보를 다루는 배포에서는 최소 권한 RLS, 저장 기간, 삭제 정책을 별도로 검토해야 합니다. 공개 이슈에 키·토큰·개인정보를 올리지 말고 [SECURITY.md](SECURITY.md)의 절차를 이용하세요.

## 라이선스

직접 작성한 코드는 [MIT License](LICENSE)로 배포됩니다. 제3자 패키지·서비스·모델에는 각각의 라이선스와 이용약관이 적용됩니다. 자세한 내역은 [docs/SBOM.md](docs/SBOM.md)와 [docs/AI_MODEL_DISCLOSURE.md](docs/AI_MODEL_DISCLOSURE.md)를 확인하세요.

---

## English

ShowMeLook is an open-source fashion commerce platform that connects AI agents with real products and public outfit data. The repository contains a React PWA, Supabase backend functions, catalog/community data flows, and a model-agnostic MCP server.

The contest-ready open-source scope is the ShowMeLook MCP connector in `src/lib/mcp`. It embeds no AI model and exposes three read-only tools: `search_products`, `get_product`, and `list_public_looks`. Optional commercial AI routes used by the full hosted demo are explicitly separated and documented in [docs/AI_MODEL_DISCLOSURE.md](docs/AI_MODEL_DISCLOSURE.md).

### Quick start

```bash
git clone https://github.com/xrissohn/showmelook.git
cd showmelook
cp .env.example .env.local
npm ci
npm run dev
```

Run `npm run check` before opening a pull request. Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md).
