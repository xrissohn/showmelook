import { describe, expect, it } from 'vitest';
import {
  safeConcept,
  aggregateFeedback,
  buildInsightPromptBlock,
  buildReportEmail,
  parseInsightResponse,
  sanitizeInsightLines,
  classifyCommentLocal,
  mergeModeration,
  parseAiModeration,
  redactPersonalInfo,
} from '../../supabase/functions/_shared/feedbackLearning';

describe('classifyCommentLocal', () => {
  it('민감한 내용은 분류에 걸린다', () => {
    expect(classifyCommentLocal('이 모델 야동 같아요')).toContain('sexual');
    expect(classifyCommentLocal('교회 갈 때 입을 옷도 있었으면')).toContain('religious');
    expect(classifyCommentLocal('대통령 룩처럼 만들어줘')).toContain('political');
    expect(classifyCommentLocal('한남 느낌 나서 싫어')).toContain('hate');
    expect(classifyCommentLocal('죽고 싶을 만큼 별로')).toContain('violence_self_harm');
    expect(classifyCommentLocal('010-1234-5678로 연락줘')).toContain('personal_info');
    expect(classifyCommentLocal('이게 뭐야 씨발')).toContain('profanity');
    expect(classifyCommentLocal('할인 코드 받으려면 www.example.com')).toContain('spam');
  });

  it('패션 평가는 걸리지 않는다 (노출·누드톤·섹시 등)', () => {
    for (const t of [
      '노출이 너무 많아서 부담스러워요',
      '누드톤 가디건이 예뻐요',
      '조금 더 섹시한 분위기면 좋겠어요',
      '바지 핏이 아쉬워요. 허리가 커 보여요',
      '색이 사진이랑 달라요. 검정인데 갈색으로 나왔어요',
      '남자친구랑 같이 입을 커플룩 추천해주세요',
      'The colors are off, I wanted more minimal looks',
      '',
    ]) expect(classifyCommentLocal(t), t).toEqual([]);
  });
});

describe('redactPersonalInfo', () => {
  it('연락처·이메일·링크를 가린다', () => {
    const r = redactPersonalInfo('010-1234-5678 / a@b.com / https://x.y/z 로 보내줘');
    expect(r).not.toMatch(/1234|a@b|https/);
    expect(r).toContain('[전화번호]');
    expect(r).toContain('[이메일]');
    expect(r).toContain('[링크]');
  });
});

describe('AI 분류 응답 처리', () => {
  it('JSON을 읽고 모르는 분류는 버린다', () => {
    expect(parseAiModeration('{"flagged":true,"categories":["sexual","weird"]}')).toEqual({ flagged: true, categories: ['sexual'] });
    expect(parseAiModeration('앞뒤 설명 {"flagged":false,"categories":[]} 끝')).toEqual({ flagged: false, categories: [] });
  });
  it('읽을 수 없으면 null', () => {
    expect(parseAiModeration('모르겠어요')).toBeNull();
    expect(parseAiModeration(null)).toBeNull();
  });
});

describe('mergeModeration', () => {
  it('규칙이나 AI 중 하나라도 걸리면 보류', () => {
    expect(mergeModeration(['religious'], { flagged: false, categories: [] })).toEqual({ flagged: true, categories: ['religious'] });
    expect(mergeModeration([], { flagged: true, categories: ['hate'] })).toEqual({ flagged: true, categories: ['hate'] });
  });
  it('둘 다 깨끗하면 통과', () => {
    expect(mergeModeration([], { flagged: false, categories: [] })).toEqual({ flagged: false, categories: [] });
  });
  it('AI를 쓰지 못했고 규칙에도 안 걸리면 사람이 보도록 보류', () => {
    expect(mergeModeration([], null)).toEqual({ flagged: true, categories: ['needs_review'] });
  });
});

const row = (rating: number, o: Partial<{ comment: string; style_concept: string; moderation_status: string; moderation_categories: string[] }> = {}) => ({
  rating, comment: null as string | null, style_concept: null as string | null, moderation_status: 'none', moderation_categories: [] as string[], ...o,
});

describe('aggregateFeedback', () => {
  const rows = [
    row(1, { style_concept: '미니멀', comment: '핏이 좋아요', moderation_status: 'clean' }),
    row(1, { style_concept: '미니멀' }),
    row(-1, { style_concept: '스트릿', comment: '색이 달라요', moderation_status: 'clean' }),
    row(-1, { style_concept: '스트릿', comment: '대통령 같아', moderation_status: 'flagged', moderation_categories: ['political'] }),
    row(0, { comment: '무난해요', moderation_status: 'approved' }),
    row(-1, { comment: '욕설', moderation_status: 'rejected', moderation_categories: ['profanity'] }),
  ];
  const s = aggregateFeedback(rows);
  it('개수와 좋아요 비율', () => {
    expect([s.total, s.up, s.neutral, s.down]).toEqual([6, 2, 1, 3]);
    expect(s.positiveRate).toBeCloseTo(2 / 5);
  });
  it('의견: 학습 사용(clean+승인) / 보류 / 제외', () => {
    expect(s.withComment).toBe(5);
    expect(s.usableComments).toBe(3);
    expect(s.flaggedComments).toBe(1);
    expect(s.rejectedComments).toBe(1);
    expect(s.flaggedByCategory).toEqual({ political: 1 });
  });
  it('반응 좋은/아쉬운 스타일', () => {
    expect(s.topLiked).toEqual([{ concept: '미니멀', up: 2, down: 0 }]);
    expect(s.topDisliked).toEqual([{ concept: '스트릿', up: 0, down: 2 }]);
  });
  it('피드백이 없어도 안전하다', () => {
    expect(aggregateFeedback([]).positiveRate).toBe(0);
  });
});

describe('인사이트 정리', () => {
  it('민감·링크가 섞인 줄은 버리고 길이·개수를 제한한다', () => {
    const lines = sanitizeInsightLines([
      '- 검정 상의는 갈색으로 보이지 않게 색을 분명히 추천하기',
      '대통령이 입는 스타일로 추천하기',
      '자세한 건 https://x.com 참고',
      '짧음',
      '1) 와이드 팬츠는 허리 핏 설명을 함께 주기',
      '와이드 팬츠는 허리 핏 설명을 함께 주기',
      42,
      ...Array.from({ length: 10 }, (_, i) => `체형별 코디 가이드 번호 ${i} 를 더 자세히 안내하기`),
    ]);
    expect(lines[0]).toBe('검정 상의는 갈색으로 보이지 않게 색을 분명히 추천하기');
    expect(lines).not.toContain('대통령이 입는 스타일로 추천하기');
    expect(lines.some((l) => l.includes('http'))).toBe(false);
    expect(lines.filter((l) => l.includes('허리 핏')).length).toBe(1);
    expect(lines.length).toBeLessThanOrEqual(5);
  });
  it('AI 응답을 읽고 민감한 요약은 비운다', () => {
    const ok = parseInsightResponse('설명 {"summary":"핏과 색 정확도에 대한 의견이 많았어요","insights":["색 정확도를 높이는 방향으로 추천하기"]}');
    expect(ok?.summary).toContain('핏');
    expect(ok?.insights).toEqual(['색 정확도를 높이는 방향으로 추천하기']);
    expect(parseInsightResponse('{"summary":"종교 이야기","insights":[]}')?.summary).toBe('');
    expect(parseInsightResponse('json 아님')).toBeNull();
  });
  it('프롬프트 블록: 없으면 빈 문자열, 있으면 이번 요청 우선을 명시', () => {
    expect(buildInsightPromptBlock([])).toBe('');
    const block = buildInsightPromptBlock([['색 정확도를 높이는 방향으로 추천하기']]);
    expect(block).toContain('- 색 정확도를 높이는 방향으로 추천하기');
    expect(block).toContain('이번 요청이 항상 우선');
  });
});

describe('관리자 리포트 이메일', () => {
  const stats = aggregateFeedback([
    row(1, { style_concept: '미니멀' }),
    row(-1, { comment: '대통령', moderation_status: 'flagged', moderation_categories: ['political'] }),
  ]);
  const mail = buildReportEmail({
    periodStart: '2026-10-06T00:00:00Z', periodEnd: '2026-10-07T00:00:00Z', stats,
    summary: '핏 의견이 많았어요 <b>', insightLines: ['색 정확도를 높이는 방향으로 추천하기'],
    pendingFlaggedTotal: 3, adminUrl: 'https://showmelook.com/admin?tab=feedback',
  });
  it('제목에 반응 수와 결정 필요 건수', () => {
    expect(mail.subject).toContain('👍1');
    expect(mail.subject).toContain('결정 필요 3건');
  });
  it('보류된 의견의 원문은 싣지 않고 분류별 건수만 싣는다', () => {
    expect(mail.html).not.toContain('대통령');
    expect(mail.text).not.toContain('대통령');
    expect(mail.text).toContain('정치 1건');
  });
  it('HTML을 이스케이프하고 반영한 가이드를 보여준다', () => {
    expect(mail.html).toContain('&lt;b&gt;');
    expect(mail.html).toContain('색 정확도를 높이는 방향으로 추천하기');
    expect(mail.html).toContain('https://showmelook.com/admin?tab=feedback');
  });
  it('결정 대기가 없으면 알림 상자를 빼고 그렇게 말한다', () => {
    const none = buildReportEmail({ periodStart: '2026-10-06T00:00:00Z', periodEnd: '2026-10-07T00:00:00Z', stats: aggregateFeedback([]), summary: '', insightLines: [], pendingFlaggedTotal: 0, adminUrl: 'u' });
    expect(none.text).toContain('결정이 필요한 의견은 없습니다');
    expect(none.subject).not.toContain('결정 필요');
  });
});

describe('safeConcept (리포트·AI 요약에 싣는 스타일 이름)', () => {
  it('짧은 스타일 이름은 그대로', () => {
    expect(safeConcept('  로맨틱   캐주얼 ')).toBe('로맨틱 캐주얼');
  });
  it('긴 문장(사용자 요청 원문일 가능성)·개인정보·민감·정체성 표현은 뺀다', () => {
    expect(safeConcept('남자친구랑 한강에서 입을 편한 데이트룩 추천해줘 제발요 부탁드립니다 감사합니다')).toBe('');
    expect(safeConcept('010-1234-5678 룩')).toBe('');
    expect(safeConcept('교회 룩')).toBe('');
    expect(safeConcept('게이 데이트룩')).toBe('');
    expect(safeConcept('lesbian style')).toBe('');
    expect(safeConcept(null)).toBe('');
  });
  it('집계에서도 걸러진 이름은 스타일 순위에 나오지 않는다', () => {
    const s = aggregateFeedback([
      { rating: 1, style_concept: '게이 데이트룩', moderation_status: 'none' },
      { rating: 1, style_concept: '미니멀', moderation_status: 'none' },
    ]);
    expect(s.topLiked.map((c) => c.concept)).toEqual(['미니멀']);
  });
});
