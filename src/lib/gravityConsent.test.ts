import { beforeEach, describe, expect, it } from 'vitest';
import { needsConsent, readChoice, saveChoice, trackingAllowed, NOTICE_VERSION } from './gravityConsent';

beforeEach(() => localStorage.clear());
describe('regional advertising permission', () => {
  it('blocks unresolved and consent regions until acceptance', () => {
    for (const region of ['XX', 'T1', 'DE', 'GB', 'KR']) expect(trackingAllowed(region, null, false)).toBe(false);
    expect(needsConsent('US')).toBe(false);
    expect(trackingAllowed('US', null, false)).toBe(true);
  });
  it('allows accepted visits but never overrides an explicit refusal', () => {
    saveChoice(true, 'DE', 'en');
    expect(trackingAllowed('DE', readChoice(), false)).toBe(true);
    saveChoice(false, 'US', 'en');
    expect(trackingAllowed('US', readChoice(), false)).toBe(false);
    expect(trackingAllowed('DE', readChoice(), false)).toBe(false);
  });
  it('preserves acceptance evidence on withdrawal', () => {
    saveChoice(true, 'DE', 'en');
    saveChoice(false, 'DE', 'en');
    expect(readChoice()?.history.map(item => item.advertising)).toEqual([true, false]);
    expect(readChoice()?.history[0].noticeVersion).toBe(NOTICE_VERSION);
    expect(readChoice()?.history[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('honors browser opt-out even with acceptance', () => {
    saveChoice(true, 'US', 'en');
    expect(trackingAllowed('US', readChoice(), true)).toBe(false);
  });
});