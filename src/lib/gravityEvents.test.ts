import { beforeEach, expect, it, vi } from 'vitest';
import { saveChoice } from './gravityConsent';
import { OUTCOME_EVENT, reportGravityOutcome } from './gravityEvents';

vi.mock('./gravityConsent', async importOriginal => ({
  ...await importOriginal<typeof import('./gravityConsent')>(),
  getVisitRegion: async () => 'DE',
}));
beforeEach(() => localStorage.clear());
it('sends signup and saved look outcomes once, without local identifiers', async () => {
  saveChoice(true, 'DE', 'en');
  const events: unknown[] = [];
  const listener = (event: Event) => events.push((event as CustomEvent).detail);
  window.addEventListener(OUTCOME_EVENT, listener);
  await reportGravityOutcome('complete_registration', 'private-signup-id');
  await reportGravityOutcome('look_generated', 'private-look-id');
  await reportGravityOutcome('look_generated', 'private-look-id');
  expect(events).toEqual([{ outcome: 'complete_registration', region: 'DE' }, { outcome: 'look_generated', region: 'DE' }]);
  expect(localStorage.getItem('sml_advertising_outcomes')).not.toContain('private-');
  window.removeEventListener(OUTCOME_EVENT, listener);
});
it('does not replay a completion that occurred before acceptance', async () => {
  const occurredAt = '2026-10-19T00:00:00Z';
  saveChoice(true, 'DE', 'en');
  await reportGravityOutcome('look_generated', 'blocked-past-look', occurredAt);
  expect(localStorage.getItem('sml_advertising_outcomes')).toBeNull();
});
it('refusal blocks both successful outcomes', async () => {
  saveChoice(false, 'DE', 'en');
  await reportGravityOutcome('complete_registration', 'refused-signup');
  await reportGravityOutcome('look_generated', 'refused-look');
  expect(localStorage.getItem('sml_advertising_outcomes')).toBeNull();
});