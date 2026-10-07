import { describe, expect, it } from 'vitest';
import {
  buildUserContext,
  cacheThreshold,
  isVagueRecommend,
  shortQueryCoverageOk,
} from '../../supabase/functions/_shared/shomiChat';

describe('isVagueRecommend', () => {
  it("한 단어 '추천' 류는 모호한 추천 요청", () => {
    for (const q of ['추천', '추천해줘', '추천 해줘!', '옷 추천', '코디추천해줘', '스타일 추천 좀', '뭐 입지?', 'recommend', 'Recommend me', 'what to wear']) {
      expect(isVagueRecommend(q), q).toBe(true);
    }
  });
  it('구체적인 질문은 아니다', () => {
    for (const q of ['겨울 데이트룩 추천해줘', '추천인 코드가 뭐야', '등급 알려줘', '키 170 남자 코트 추천', '가격이 얼마야']) {
      expect(isVagueRecommend(q), q).toBe(false);
    }
  });
});

describe('shortQueryCoverageOk', () => {
  it('아주 짧은 질문은 키워드가 대부분일 때만', () => {
    expect(shortQueryCoverageOk(2, 2)).toBe(true); // 등급
    expect(shortQueryCoverageOk(4, 2)).toBe(false); // 무료배송 ← '무료'
    expect(shortQueryCoverageOk(3, 2)).toBe(true);
  });
  it('긴 질문에는 영향 없다', () => {
    expect(shortQueryCoverageOk(6, 2)).toBe(true);
  });
});

describe('cacheThreshold', () => {
  it('짧은 질문은 기준을 높인다', () => {
    expect(cacheThreshold(4)).toBe(0.9);
    expect(cacheThreshold(7)).toBe(0.9);
    expect(cacheThreshold(8)).toBe(0.6);
  });
});

describe('buildUserContext', () => {
  it('프로필과 최근 추천을 담되 키·몸무게·나이는 쓰지 않는다', () => {
    const ctx = buildUserContext(
      { gender: 'female', body_type: '역삼각형', style_preferences: ['미니멀', '캐주얼'], ...({ height: 163, weight: 50 } as object) },
      [
        { prompt: '데이트룩 추천해줘', style_concept: '로맨틱 캐주얼' },
        { prompt: '출근\n룩', style_concept: null },
        { prompt: '', style_concept: '' },
        { prompt: '여행 코디', style_concept: '레이어드' },
        { prompt: '네번째는 안 들어감', style_concept: 'x' },
      ],
    );
    expect(ctx).toContain('성별 female');
    expect(ctx).toContain('체형 역삼각형');
    expect(ctx).toContain('선호 스타일 미니멀, 캐주얼');
    expect(ctx).toContain('1) 요청 "데이트룩 추천해줘" → 컨셉 "로맨틱 캐주얼"');
    expect(ctx).toContain('2) 요청 "출근 룩"');
    expect(ctx).toContain('3) 요청 "여행 코디"');
    expect(ctx).not.toContain('네번째');
    expect(ctx).not.toMatch(/163|50kg|height|weight|키 /);
  });
  it('맥락이 없으면 빈 문자열', () => {
    expect(buildUserContext(null, [])).toBe('');
    expect(buildUserContext({}, [{ prompt: '', style_concept: '' }])).toBe('');
  });
});
