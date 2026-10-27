import { describe, expect, it, vi, beforeEach } from 'vitest';

const updateSpy = vi.fn();
const eqSpy = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (v: unknown) => { updateSpy(v); return { eq: (...a: unknown[]) => { eqSpy(...a); return { select: () => Promise.resolve({ data: [{ user_id: a[1], personal_color: v }], error: null }) }; } }; },
    }),
    functions: { invoke: vi.fn() },
  },
}));

import {
  validateAnalysis, buildManualPersonalColor, interpretAnalyzeReply, personalColorMode, personalColorBonus,
  parseSavedPersonalColor, savePersonalColor, PERSONAL_COLOR_GOOD_BONUS, PERSONAL_COLOR_AVOID_PENALTY,
} from './personalColor';

// Synthetic model output (not from any real photo).
const okReply = {
  status: 'ok', season: 'autumn_warm', confidence: 'medium', summary: 'Warm, golden undertone with medium contrast.',
  palette: [
    { name: 'Camel', hex: '#C19A6B' }, { name: 'Olive', hex: '#6F7339' }, { name: 'Rust', hex: '#B7410E' },
    { name: 'Mocha', hex: '#7B5A44' }, { name: 'Mustard', hex: '#D4A73A' },
  ],
  avoid: [{ name: 'Icy Pink', hex: '#F7C6D9' }],
  tips: ['Wear camel near your face.'],
};

describe('AI result validation', () => {
  it('accepts a well-formed result and marks it as a photo estimate', () => {
    const r = validateAnalysis(okReply);
    expect(r.kind).toBe('result');
    if (r.kind === 'result') {
      expect(r.result.source).toBe('ai_photo');
      expect(r.result.undertone).toBe('warm');
      expect(r.result.palette).toHaveLength(5);
    }
  });
  it('turns bad-photo replies into a retake with only known reasons', () => {
    expect(validateAnalysis({ status: 'retake', retake_reasons: ['multiple_faces', 'made_up'] }))
      .toEqual({ kind: 'retake', reasons: ['multiple_faces'] });
    expect(validateAnalysis({ status: 'retake', retake_reasons: ['no_face'] })).toEqual({ kind: 'retake', reasons: ['no_face'] });
  });
  it('rejects unknown seasons, broken hex palettes, missing tips and non-objects (no fake fallback)', () => {
    expect(validateAnalysis({ ...okReply, season: 'deep_winter' }).kind).toBe('invalid');
    expect(validateAnalysis({ ...okReply, palette: okReply.palette.map((p) => ({ ...p, hex: 'brown' })) }).kind).toBe('invalid');
    expect(validateAnalysis({ ...okReply, tips: [] }).kind).toBe('invalid');
    expect(validateAnalysis(null).kind).toBe('invalid');
    expect(validateAnalysis('autumn').kind).toBe('invalid');
  });
  it('drops text that mentions ethnicity or health', () => {
    const r = validateAnalysis({ ...okReply, summary: 'Typical of your ethnic background.', tips: ['Looks healthy', 'Wear camel.'] });
    expect(r.kind).toBe('result');
    if (r.kind === 'result') {
      expect(r.result.summary).toBeUndefined();
      expect(r.result.tips).toEqual(['Wear camel.']);
    }
  });
  it('never reports a confidence percentage', () => {
    const r = validateAnalysis({ ...okReply, confidence: '92%' });
    expect(r.kind === 'result' && r.result.confidence).toBe('low');
  });
});

describe('client reply handling', () => {
  it('maps server errors and timeouts to error states', () => {
    expect(interpretAnalyzeReply({ success: false, error_code: 'daily_limit' }, null)).toEqual({ status: 'error', code: 'daily_limit' });
    expect(interpretAnalyzeReply(null, {}, 'busy')).toEqual({ status: 'error', code: 'busy' });
    expect(interpretAnalyzeReply(null, {})).toEqual({ status: 'error', code: 'network' });
  });
  it('refuses an "ok" reply that is not a valid AI result', () => {
    expect(interpretAnalyzeReply({ success: true, status: 'ok', result: { season: 'x' } }, null).status).toBe('error');
    expect(interpretAnalyzeReply({ success: true, status: 'ok', result: buildManualPersonalColor('spring_warm', 'ko') }, null).status).toBe('error');
  });
});

describe('manual selection, save and delete', () => {
  beforeEach(() => { updateSpy.mockClear(); eqSpy.mockClear(); });
  it('manual picks are labelled manual and carry no AI confidence', () => {
    const m = buildManualPersonalColor('winter_cool', 'en');
    expect(m.source).toBe('manual');
    expect(m.confidence).toBeUndefined();
    expect(m.analyzedAt).toBeUndefined();
    expect(parseSavedPersonalColor(m)?.source).toBe('manual');
  });
  it('save writes only personal_color on the owner row', async () => {
    const m = buildManualPersonalColor('summer_cool', 'ko');
    await savePersonalColor('user-1', m);
    expect(updateSpy).toHaveBeenCalledWith({ personal_color: m });
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
  });
  it('delete clears only personal_color', async () => {
    await savePersonalColor('user-1', null);
    expect(updateSpy).toHaveBeenCalledWith({ personal_color: null });
  });
});

describe('recommendation priority', () => {
  const camel = { name: 'Wool coat', dna_meta: { color_family: ['camel'] } };
  const unknown = { name: 'Wool coat' };
  it('soft-boosts matching real colors and lightly lowers avoided ones', () => {
    expect(personalColorBonus(camel, 'autumn_warm', 'soft')).toBe(PERSONAL_COLOR_GOOD_BONUS);
    expect(personalColorBonus(camel, 'winter_cool', 'soft')).toBe(PERSONAL_COLOR_AVOID_PENALTY);
  });
  it('explicit colors or photo requests win over the tone', () => {
    expect(personalColorMode('블랙 코트로 출근룩', false)).toBe('explicit_color');
    expect(personalColorMode('출근룩', true)).toBe('photo_request');
    expect(personalColorBonus(camel, 'winter_cool', personalColorMode('베이지 코트 룩', false))).toBe(0);
  });
  it('no saved tone or no color metadata leaves scores unchanged', () => {
    expect(personalColorMode('주말 데이트룩', false)).toBe('soft');
    expect(personalColorBonus(camel, null, 'soft')).toBe(0);
    expect(personalColorBonus(unknown, 'autumn_warm', 'soft')).toBe(0);
  });
  it('ignores malformed saved values', () => {
    expect(parseSavedPersonalColor({ season: 'autumn_warm', source: 'guess' })).toBeNull();
    expect(parseSavedPersonalColor(null)).toBeNull();
  });
});

import { confirmSavedRow, analyzePersonalColor as analyzeFn, buildManualPersonalColor as buildManual } from './personalColor';

describe('save confirmation', () => {
  const v = buildManual('autumn_warm', 'ko');
  it('accepts only the caller row with the new value', () => {
    expect(confirmSavedRow([{ user_id: 'u1', personal_color: v }], 'u1', v)?.season).toBe('autumn_warm');
  });
  it('rejects when no row was updated', () => {
    expect(() => confirmSavedRow([], 'u1', v)).toThrow('not_saved');
  });
  it('rejects another user row', () => {
    expect(() => confirmSavedRow([{ user_id: 'u2', personal_color: v }], 'u1', v)).toThrow('not_saved');
  });
  it('delete is confirmed only when the column came back empty', () => {
    expect(confirmSavedRow([{ user_id: 'u1', personal_color: null }], 'u1', null)).toBeNull();
    expect(() => confirmSavedRow([{ user_id: 'u1', personal_color: v }], 'u1', null)).toThrow('not_saved');
  });
});

describe('consent on every send', () => {
  it('sends nothing without current consent', async () => {
    const res = await analyzeFn('data:image/jpeg;base64,AAAA', 'ko', { consent: false });
    expect(res).toEqual({ status: 'error', code: 'consent_required' });
  });
});
