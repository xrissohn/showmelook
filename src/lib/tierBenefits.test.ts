import { describe, expect, it } from 'vitest';
import { getTierBenefits } from './tierBenefits';

describe('getTierBenefits (구매 등급 기준)', () => {
  it('무료: 워터마크 있음, 추천 먼저보기·모델 프로필 없음', () => {
    const b = getTierBenefits('free');
    expect(b).toMatchObject({ dailyLimit: 5, hasWatermark: true, canUseRecommendFirst: false, canUseFamilyProfiles: false, maxProfiles: 1, priorityQueue: false });
  });
  it('브론즈부터 워터마크 제거, 실버부터 추천 먼저보기', () => {
    expect(getTierBenefits('bronze').hasWatermark).toBe(false);
    expect(getTierBenefits('bronze').canUseRecommendFirst).toBe(false);
    expect(getTierBenefits('silver')).toMatchObject({ dailyLimit: 10, canUseRecommendFirst: true });
    expect(getTierBenefits('gold').dailyLimit).toBe(20);
  });
  it('플래티넘: 무제한, 모델 프로필 슬롯만큼 추가, 우선 대기열', () => {
    expect(getTierBenefits('platinum', { modelProfileSlots: 3 })).toMatchObject({ dailyLimit: -1, canUseFamilyProfiles: true, maxProfiles: 4, priorityQueue: true });
  });
  it('관리자는 플래티넘 이상으로 본다', () => {
    expect(getTierBenefits('free', { isAdmin: true })).toMatchObject({ dailyLimit: -1, hasWatermark: false, canUseFamilyProfiles: true, priorityQueue: true });
  });
});
