import { describe, expect, it } from 'vitest';
import { PITCH_CATALOG, PITCH_ROADMAP } from './pitchFacts';

describe('pitch catalog snapshot', () => {
  it('uses the October 12, 2026 catalog count', () => {
    expect(PITCH_CATALOG.asOf).toBe('2026-10-12');
    expect(PITCH_CATALOG.totalProducts).toBe(10553);
  });
  it('separates active inventory from total inventory', () => {
    expect(PITCH_CATALOG.activeProducts).toBe(9759);
    expect(PITCH_CATALOG.totalProducts - PITCH_CATALOG.activeProducts).toBe(794);
  });
  it('counts nonempty DNA summaries separately', () => {
    expect(PITCH_CATALOG.dnaProducts).toBe(10553);
    expect(PITCH_CATALOG.activeDnaProducts).toBe(9759);
  });
  it('starts the proposed roadmap in the current quarter', () => {
    expect(PITCH_ROADMAP.map((stage) => stage.period)).toEqual([
      '2026 Q4 · 10~12월', '2027 Q1 · 1~3월', '2027 Q2~Q3 · 4~9월',
    ]);
  });
});