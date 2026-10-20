export const CONSENT_KEY = 'sml_advertising_consent';
export const LEGACY_AD_NOTICE = {
  ko: 'Gravity(trygravity.ai)에 방문 페이지(주소의 검색어·해시 제외), 접속 시각, 광고 클릭 식별자, 쿠키 및 방문·세션 식별자, IP 주소와 기본 브라우저 정보를 전송하여 ChatGPT 광고의 사이트 방문 성과를 측정합니다. 이메일·전화번호·신체정보는 전달하지 않습니다. 거절해도 서비스를 이용할 수 있고 광고 설정에서 언제든 철회할 수 있습니다.',
  en: 'Gravity (trygravity.ai) receives visited pages (without URL queries or fragments), visit times, ad click identifiers, cookies and visitor/session identifiers, IP address and basic browser information to measure site visits from ChatGPT ads. We do not share email, phone or body information. Rejecting does not affect the service. You can withdraw at any time in Advertising settings.',
};
export const NOTICE_VERSION = 'gravity-outcomes-2026-10-20';
export const AD_NOTICE = {
  ko: 'Gravity(trygravity.ai)에 방문 페이지(주소의 검색어·해시 제외), 접속 시각, 광고 클릭 식별자, 쿠키 및 방문·세션 식별자, IP 주소와 기본 브라우저 정보, 가입 완료·룩 생성 완료 행동을 전송하여 ChatGPT 광고 성과를 측정합니다. 이메일·전화번호·신체정보는 전달하지 않습니다. 실제 구매 측정은 아직 연결되지 않았으며 구매 버튼 클릭을 구매로 집계하지 않습니다. 거절해도 서비스를 이용할 수 있고 광고 설정에서 언제든 철회할 수 있습니다.',
  en: 'Gravity (trygravity.ai) receives visited pages (without URL queries or fragments), visit times, ad click identifiers, cookies and visitor/session identifiers, IP address and basic browser information, and completed signup/look-generation actions to measure ChatGPT advertising outcomes. We do not share email, phone or body information. Confirmed purchase measurement is not connected; purchase clicks are not counted as orders. Rejecting does not affect the service. Withdraw at any time in Advertising settings.',
};
export const NOTICE_ARCHIVE = { 'gravity-visits-2026-10-20': LEGACY_AD_NOTICE, [NOTICE_VERSION]: AD_NOTICE };
const CONSENT_COUNTRIES = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH BR KR ZA TR'.split(' '));
export interface AdvertisingChoice {
  visitor: string;
  history: { advertising: boolean; at: string; region: string; noticeVersion: string; language: string }[];
}
export function needsConsent(region: string) {
  return !/^[A-Z]{2}$/.test(region) || region === 'XX' || region === 'T1' || CONSENT_COUNTRIES.has(region);
}
export function readChoice(): AdvertisingChoice | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (!value || typeof value !== 'object' || !('visitor' in value) || !('history' in value)) return null;
    const choice = value as AdvertisingChoice;
    if (typeof choice.visitor !== 'string' || !Array.isArray(choice.history) || !choice.history.length) return null;
    if (!choice.history.every(item => typeof item.advertising === 'boolean' && typeof item.at === 'string' && typeof item.noticeVersion === 'string')) return null;
    return choice;
  } catch { return null; }
}
export function trackingAllowed(region: string, choice: AdvertisingChoice | null, optedOut: boolean) {
  if (optedOut) return false;
  const latest = choice?.history.at(-1);
  if (latest?.advertising === false) return false;
  if (latest?.advertising === true && latest.noticeVersion !== NOTICE_VERSION) return false;
  return latest?.advertising === true || !needsConsent(region);
}
export function saveChoice(advertising: boolean, region: string, language: string) {
  const previous = readChoice();
  const choice: AdvertisingChoice = {
    visitor: previous?.visitor ?? crypto.randomUUID(),
    history: [...(previous?.history ?? []), { advertising, at: new Date().toISOString(), region, noticeVersion: NOTICE_VERSION, language }],
  };
  // If storage is unavailable, do not grant tracking permission.
  localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
  window.dispatchEvent(new Event('sml:advertising-choice'));
}
let regionPromise: Promise<string> | undefined;
export function getVisitRegion() {
  regionPromise ??= (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch('/cdn-cgi/trace', { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok) return 'XX';
      const country = (await response.text()).match(/^loc=([A-Z]{2}|T1)$/m)?.[1];
      return country ?? 'XX';
    } catch { return 'XX'; }
    finally { clearTimeout(timer); }
  })();
  return regionPromise;
}