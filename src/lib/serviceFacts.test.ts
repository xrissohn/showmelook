import { describe, expect, it } from 'vitest';
import { TIER_IDS, serviceKnowledgeKo, tierFaqAnswer, tierFeaturesKo } from '../../supabase/functions/_shared/serviceFacts';

// 요금제는 구독이 아니라 구매 등급제. 아직 적용되지 않는 혜택(월 한도·갤러리·히스토리·고화질)은 문구에 약속하지 않는다.
const UNENFORCED = /월간|월 \d|a month|monthly|갤러리 ?(저장|무제한|\d)|gallery|히스토리|history|고화질|HD/i;
// '월 구독 없음'은 허용하고 요금제를 구독으로 안내하는 표현만 막는다.
const NO_SUBSCRIPTION_OK = (s: string) => s.replace(/월 구독(이|은)? ?(아니라|없|아닌)/g, '').replace(/no monthly subscription|not a monthly subscription/gi, '');

describe('등급 문구는 실제 적용되는 혜택만 말한다', () => {
  it('등급별 혜택 목록', () => {
    for (const id of TIER_IDS) {
      for (const line of tierFeaturesKo(id)) expect(line, `${id}: ${line}`).not.toMatch(UNENFORCED);
    }
  });
  it('쇼미 등급 답변과 지식', () => {
    for (const text of [tierFaqAnswer('ko'), tierFaqAnswer('en'), serviceKnowledgeKo(new Date('2026-01-01'))]) {
      expect(NO_SUBSCRIPTION_OK(text)).not.toMatch(UNENFORCED);
    }
  });
  it('플래티넘은 무제한 생성·모델 프로필·우선 대기열을 약속한다', () => {
    expect(tierFeaturesKo('platinum')).toEqual(expect.arrayContaining(['무제한 스타일 생성', '우선 생성 대기열']));
  });
});
