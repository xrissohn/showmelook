

# 사진 스타일 분석 정확도 개선 (Gemini 2.5 Pro + 구조화 분석)

## 문제 분석

**문제 1: 추천 제품이 업로드 사진과 다름**
- 현재 `analyze-style-image`가 "미니멀하고 편안한 가을 데일리룩" 같은 **모호한 2-3문장 설명**만 반환
- `style-recommend`의 Stage 1이 이 텍스트에서 정확한 카테고리/색상/핏을 추출하지 못함

**문제 2: 얼굴이 달라짐**
- 사진 분석 결과 텍스트가 `customStylePrompt`로 들어가고, 이후 `generate-style`에서 `style` 파라미터로 전달됨
- 이 흐름 자체는 텍스트 추천과 동일하므로, **분석 텍스트에 인물 외모 묘사가 포함되면** 얼굴 합성 프롬프트와 충돌 가능

## 해결 방안

### 1. `analyze-style-image` Edge Function 업그레이드

**모델 변경**: `google/gemini-2.5-flash` → `google/gemini-2.5-pro`

**프롬프트 전면 개편**: Tool Calling으로 구조화된 JSON 반환

현재 자유형 텍스트 대신, 아이템별 구조화 분석을 수행:
- 각 의류 아이템(상의/하의/아우터/신발/가방) 개별 식별
- 카테고리, 색상, 소재, 핏, 패턴을 구조화
- **인물 외모 묘사 절대 제외** (얼굴 합성 충돌 방지)
- 전체 스타일 컨셉과 TPO도 함께 반환

반환 구조 예시:
```text
{
  items: [
    { category: "니트/스웨터", color: "베이지", material: "울", fit: "오버사이즈" },
    { category: "와이드팬츠", color: "인디고블루", material: "데님", fit: "와이드" }
  ],
  overallStyle: "미니멀 캐주얼",
  season: "가을/겨울",
  tpo: "데일리/카페",
  searchPrompt: "오버사이즈 베이지 울 니트와 인디고블루 와이드 데님 팬츠. 미니멀하고 편안한 가을 데일리룩. 뉴트럴 톤의 캐주얼 스타일."
}
```

`searchPrompt` 필드를 `customStylePrompt`에 입력하되, 이 텍스트에는 **의류 정보만** 포함되고 인물 묘사는 없음.

### 2. 프론트엔드 (`StyleGenerator.tsx`) 수정

- `handleStyleImageUpload`에서 새 응답 구조 처리
- `data.searchPrompt`를 `customStylePrompt`에 설정
- 구조화된 아이템 목록을 UI에 표시 (선택적)
- 분석된 아이템 정보를 토스트/배너로 보여주어 사용자가 정확도를 확인 가능

### 3. 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/functions/analyze-style-image/index.ts` | 모델 Pro로 변경, Tool Calling 기반 구조화 프롬프트, 인물 묘사 제외 지시 |
| `src/pages/StyleGenerator.tsx` | 새 응답 구조 처리, 분석 아이템 목록 표시 |

### 4. 비용 영향

- 요청당 약 3-5원 (KRW) — 현재 대비 약 10-15배 증가
- 사용자 1회 업로드 당 1회만 호출되므로 총 비용 영향은 제한적

