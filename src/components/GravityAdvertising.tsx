import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { AD_NOTICE, CONSENT_KEY, getVisitRegion, needsConsent, readChoice, saveChoice, trackingAllowed } from '@/lib/gravityConsent';
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
  const show = settings || (region !== null && needsConsent(region) && !choice && !optedOut);

  useEffect(() => {
    let active = true;
    getVisitRegion().then(country => { if (active) setRegion(country); });
    const update = () => setRevision(value => value + 1);
    const storage = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) update(); };
    window.addEventListener('storage', storage);
    window.addEventListener('sml:advertising-choice', update);
    return () => { active = false; window.removeEventListener('storage', storage); window.removeEventListener('sml:advertising-choice', update); };
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
    // Only new, successfully saved images, never old gallery loads or failed jobs.
    const channel = supabase.channel(`gravity-completed-looks-${user.id}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'generated_looks', filter: `user_id=eq.${user.id}`,
    }, ({ new: look }) => {
      if (typeof look.id === 'string' && typeof look.image_url === 'string' && look.image_url) {
        void reportGravityOutcome('look_generated', look.id);
      }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const choose = (accept: boolean) => {
    try { saveChoice(accept, region ?? 'XX', language); setSettings(false); setError(false); }
    catch { setError(true); }
  };
  return <>
    <Button variant="outline" size="sm" className="fixed bottom-2 left-2 z-40 shadow-sm" onClick={() => setSettings(true)}>
      <Cookie aria-hidden="true" />{language === 'ko' ? '광고 설정' : 'Advertising settings'}
    </Button>
    {show && <section role="dialog" aria-label={language === 'ko' ? '광고 측정 동의' : 'Advertising consent'} className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-background shadow-lg">
      <div className="mx-auto max-w-4xl space-y-3 px-5 py-5">
        <h2 className="text-lg font-semibold">{language === 'ko' ? '광고 측정 동의' : 'Advertising consent'}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{AD_NOTICE[language]}</p>
        {optedOut && <p className="text-sm text-muted-foreground">{language === 'ko' ? '브라우저의 추적 거부 설정이 적용되어 측정이 차단됩니다.' : 'Your browser opt-out blocks advertising measurement.'}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{language === 'ko' ? '선택을 저장할 수 없어 측정이 허용되지 않았습니다.' : 'Your choice could not be saved. Tracking was not enabled.'}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => choose(false)}>{language === 'ko' ? '거절' : 'Reject'}</Button>
          <Button variant="outline" disabled={optedOut} onClick={() => choose(true)}>{language === 'ko' ? '수락' : 'Accept'}</Button>
          <Link className="text-sm text-primary underline" to="/privacy">{language === 'ko' ? '개인정보 처리방침' : 'Privacy policy'}</Link>
          {settings && <Button variant="ghost" onClick={() => setSettings(false)}>{language === 'ko' ? '닫기' : 'Close'}</Button>}
        </div>
      </div>
    </section>}
  </>;
}