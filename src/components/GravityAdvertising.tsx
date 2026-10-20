import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { AD_NOTICE, CONSENT_KEY, NOTICE_VERSION, getVisitRegion, needsConsent, readChoice, saveChoice, trackingAllowed } from '@/lib/gravityConsent';
import { OUTCOME_EVENT, reportGravityOutcome, type GravityOutcome } from '@/lib/gravityEvents';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function GravityAdvertising() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [region, setRegion] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const optedOut = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1';
  const choice = readChoice();
  const latest = choice?.history.at(-1);
  const show = settings || (!optedOut && region !== null && (
    (needsConsent(region) && !choice) || (latest?.advertising === true && latest.noticeVersion !== NOTICE_VERSION)
  ));

  useEffect(() => {
    let active = true;
    getVisitRegion().then(country => { if (active) setRegion(country); });
    const update = () => setRevision(value => value + 1);
    const storage = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) update(); };
    const openSettings = () => setSettings(true);
    window.addEventListener('storage', storage);
    window.addEventListener('sml:advertising-choice', update);
    window.addEventListener('sml:advertising-settings', openSettings);
    return () => { active = false; window.removeEventListener('storage', storage); window.removeEventListener('sml:advertising-choice', update); window.removeEventListener('sml:advertising-settings', openSettings); };
  }, []);

  useEffect(() => {
    if (!region) return;
    const allowed = trackingAllowed(region, readChoice(), optedOut);
    if (!allowed) { frame.current?.remove(); frame.current = null; return; }
    if (frame.current) return;
    const element = document.createElement('iframe');
    element.hidden = true;
    element.title = 'Gravity advertising measurement';
    element.referrerPolicy = 'no-referrer';
    element.src = '/gravity-pixel.html';
    element.onload = () => {
      if (trackingAllowed(region, readChoice(), optedOut)) {
        const landing = new URL(window.location.origin + window.location.pathname);
        const search = new URLSearchParams(window.location.search);
        for (const key of ['grclid', 'grcpid', 'grpuid', 'gradid', 'grsig', 'graid', 'oppref']) {
          const value = search.get(key);
          if (value && /^[A-Za-z0-9_.~-]{1,512}$/.test(value)) landing.searchParams.set(key, value);
        }
        element.contentWindow?.postMessage({ type: 'sml-gravity-start', url: landing.href }, window.location.origin);
      }
    };
    document.body.appendChild(element);
    frame.current = element;
  }, [region, revision, optedOut]);
  useEffect(() => () => { frame.current?.remove(); frame.current = null; }, []);

  useEffect(() => {
    const send = (event: Event) => {
      const detail = (event as CustomEvent<{ outcome: GravityOutcome; region: string }>).detail;
      if (!detail || !trackingAllowed(detail.region, readChoice(), optedOut)) return;
      frame.current?.contentWindow?.postMessage({ type: 'sml-gravity-outcome', outcome: detail.outcome, region: detail.region }, window.location.origin);
    };
    window.addEventListener(OUTCOME_EVENT, send);
    return () => window.removeEventListener(OUTCOME_EVENT, send);
  }, [optedOut]);

  useEffect(() => {
    if (!user) return;
    // The table is not in the realtime publication. Observe newly saved images;
    // the timestamp excludes old gallery rows and failed/unsaved jobs.
    const since = new Date().toISOString();
    let active = true;
    const poll = async () => {
      const { data, error } = await supabase.from('generated_looks').select('id,image_url,created_at')
        .eq('user_id', user.id).gt('created_at', since).limit(100);
      if (!active || error) return;
      for (const look of data ?? []) {
        if (look.image_url) void reportGravityOutcome('look_generated', look.id, look.created_at);
      }
    };
    const interval = window.setInterval(() => { void poll(); }, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [user?.id]);

  const choose = (accept: boolean) => {
    try { saveChoice(accept, region ?? 'XX', language); setSettings(false); setError(false); }
    catch { setError(true); }
  };
  return <>
    {show && <section role="dialog" aria-label={language === 'ko' ? '광고 측정 동의' : 'Advertising consent'} className="fixed bottom-2 inset-x-2 sm:inset-x-auto sm:bottom-3 sm:right-3 sm:max-w-sm z-[100] rounded-lg border border-border bg-background shadow-lg">
      <div className="space-y-1.5 px-3 py-2 sm:space-y-2 sm:px-4 sm:py-3">
        <h2 className="text-[12px] leading-tight font-semibold flex items-center gap-1.5 sm:text-sm"><Cookie className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />{language === 'ko' ? '광고 측정 동의' : 'Advertising consent'}</h2>
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">{AD_NOTICE[language]}</p>
        {optedOut && <p className="text-[11px] text-muted-foreground sm:text-xs">{language === 'ko' ? '브라우저의 추적 거부 설정이 적용되어 측정이 차단됩니다.' : 'Your browser opt-out blocks advertising measurement.'}</p>}
        {error && <p role="alert" className="text-[11px] text-destructive sm:text-xs">{language === 'ko' ? '선택을 저장할 수 없어 측정이 허용되지 않았습니다.' : 'Your choice could not be saved. Tracking was not enabled.'}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 sm:gap-2">
          {/* Tap targets stay full size on phones even though the rest of the card shrinks. */}
          <Button variant="outline" size="sm" className="min-h-11 min-w-20 sm:min-h-0 sm:min-w-0" onClick={() => choose(false)}>{language === 'ko' ? '거절' : 'Reject'}</Button>
          <Button size="sm" className="min-h-11 min-w-20 sm:min-h-0 sm:min-w-0" disabled={optedOut} onClick={() => choose(true)}>{language === 'ko' ? '수락' : 'Accept'}</Button>
          <Link className="text-[11px] text-primary underline sm:text-xs" to="/privacy">{language === 'ko' ? '개인정보 처리방침' : 'Privacy policy'}</Link>
          {settings && <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setSettings(false)}>{language === 'ko' ? '닫기' : 'Close'}</Button>}
        </div>
      </div>
    </section>}
  </>;
}