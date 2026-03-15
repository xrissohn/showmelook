
# 사진 업로드 -> AI 스타일 분석 -> 유사 스타일 추천 기능

## 개요
사용자가 참고할 패션 사진을 업로드하면 AI가 해당 사진의 스타일을 분석하여 텍스트 프롬프트로 변환하고, 기존 `style-recommend` 파이프라인에 자연스럽게 연결하는 기능.

## 구현 구조

```text
[사진 업로드] --> [analyze-style-image Edge Function] --> 스타일 설명 텍스트
                                                              |
                                                              v
                                               [customStylePrompt에 자동 입력]
                                                              |
                                                              v
                                               [기존 style-recommend 호출]
```

## 변경 파일

### 1. 새 Edge Function: `supabase/functions/analyze-style-image/index.ts`

- 사용자가 업로드한 이미지 URL(base64 data URL 또는 public URL)을 받아 Gemini 2.5 Flash로 분석
- 프롬프트: "이 패션 사진의 스타일을 한국어로 자연스럽게 설명해줘. 의류 종류, 색상, 분위기, 계절감, TPO 등을 포함해서 2-3문장으로."
- 응답 예시: `"오버사이즈 베이지 니트에 와이드 데님 팬츠, 미니멀하고 편안한 가을 데일리룩. 뉴트럴 톤 중심의 캐주얼 스타일."`
- 모델: `google/gemini-2.5-flash` (비용 최소, 이미지 분석 지원)
- LOVABLE_API_KEY 사용 (추가 키 불필요)

### 2. 프론트엔드: `src/pages/StyleGenerator.tsx`

스타일 프롬프트 Textarea 영역(라인 4720 부근)에 사진 업로드 버튼 추가:

- 카메라/이미지 아이콘 버튼 추가 (Textarea 우측 상단 또는 하단)
- 클릭 시 `<input type="file" accept="image/*">` 트리거
- 이미지 선택 -> base64로 변환 -> `analyze-style-image` Edge Function 호출
- 분석 결과를 `customStylePrompt`에 자동 입력
- 분석 중 로딩 표시 (스피너 + "사진 분석 중...")
- 업로드된 이미지 미리보기 썸네일 표시
- 분석 실패 시 토스트 에러 메시지

UI 변경:
- Textarea 위에 작은 배너/버튼: `📷 사진으로 스타일 찾기`
- 이미지 업로드 후 썸네일 + X 버튼으로 제거 가능
- 분석 완료 시 Textarea에 텍스트 자동 채워짐 + "AI가 분석한 스타일입니다" 안내

### 3. `supabase/config.toml` 업데이트

```toml
[functions.analyze-style-image]
verify_jwt = false
```

## 기술 세부사항

### Edge Function 구현

```text
POST /analyze-style-image
Body: { image_data: "data:image/jpeg;base64,..." }
Response: { success: true, description: "오버사이즈 니트에 와이드 데님..." }
```

- base64 이미지를 Gemini vision에 전달
- 최대 이미지 크기: 5MB (프론트에서 리사이즈)
- 응답 시간: 약 2-3초 (Flash 모델)
- 에러 처리: 429/402 Rate Limit 핸들링 포함

### 프론트엔드 이미지 처리

- FileReader로 base64 변환
- 큰 이미지는 canvas로 리사이즈 (최대 1024px)
- 미리보기 표시용 Object URL 생성
- 상태: `styleImageFile`, `styleImagePreview`, `isAnalyzingImage`

## 비용 영향
- Gemini 2.5 Flash 이미지 분석: 요청당 약 0.1~0.3원 (KRW)
- 기존 style-recommend 비용에 추가되는 금액 무시 가능 수준

## 사용자 흐름
1. "스타일 설정" 영역에서 `📷 사진으로 스타일 찾기` 클릭
2. 갤러리/카메라에서 참고 사진 선택
3. 썸네일 표시 + "AI 분석 중..." 로딩 (2-3초)
4. 분석 완료: Textarea에 스타일 설명 자동 입력
5. 사용자가 필요시 텍스트 수정 가능
6. "스타일 추천 받기" 버튼으로 기존 플로우 진행
