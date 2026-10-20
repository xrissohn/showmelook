import { getVisitRegion, readChoice, trackingAllowed } from './gravityConsent';

export type GravityOutcome = 'complete_registration' | 'look_generated';
const observed = new Set<string>();
export const OUTCOME_EVENT = 'sml:gravity-outcome';

// IDs are used locally for deduplication only; they never leave the app.
export async function reportGravityOutcome(outcome: GravityOutcome, localId: string, occurredAt?: string) {
  const key = `${outcome}:${localId}`;
  if (observed.has(key)) return;
  observed.add(key);
  const current = readChoice();
  const at = occurredAt ?? new Date().toISOString();
  const history = current?.history.filter(item => item.at <= at) ?? [];
  const choiceAtAction = current && history.length ? { ...current, history } : null;
  const optedOut = () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1';
  const region = await getVisitRegion();
  if (!trackingAllowed(region, choiceAtAction, optedOut()) || !trackingAllowed(region, readChoice(), optedOut())) return;
  // Persist consent evidence before sending. No credentials or matching fields.
  try {
    const records = JSON.parse(localStorage.getItem('sml_advertising_outcomes') || '[]');
    if (!Array.isArray(records)) return;
    localStorage.setItem('sml_advertising_outcomes', JSON.stringify([...records, {
      outcome, at, region, visitor: choiceAtAction?.visitor ?? null,
      choice: choiceAtAction?.history.at(-1) ?? null,
    }].slice(-200)));
  } catch { return; }
  window.dispatchEvent(new CustomEvent(OUTCOME_EVENT, { detail: { outcome, region } }));
}