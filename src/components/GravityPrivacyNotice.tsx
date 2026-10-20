import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { AD_NOTICE, LEGACY_AD_NOTICE, NOTICE_VERSION } from '@/lib/gravityConsent';

export default function GravityPrivacyNotice() {
  const { language } = useLanguage();
  return <section className="space-y-4" id="advertising">
    <h2 className="text-xl font-semibold">{language === 'ko' ? '10. ChatGPT 광고 성과 측정 (2026년 10월 20일 추가)' : '10. ChatGPT advertising measurement (added October 20, 2026)'}</h2>
    <p className="text-foreground/80 leading-relaxed">{AD_NOTICE[language]}</p>
    <p className="text-foreground/80 leading-relaxed">{language === 'ko'
      ? '동의가 필요한 지역 및 위치를 확인할 수 없는 경우 수락 전에는 Gravity 픽셀을 불러오지 않습니다. 그 밖의 지역에서는 측정이 기본 허용되지만 명시적 거절과 브라우저의 GPC·추적 거부 설정을 존중합니다. 방문 전용 안내에 동의했던 방문자에게는 확대된 안내로 다시 동의를 받습니다. 회원가입은 서버가 계정 생성을 확인한 때, 룩 생성은 새 이미지 저장이 확인된 때 집계합니다. 외부 구매 완료 측정과 광고 최적화 대상 설정은 아직 완료되지 않았습니다. 고객 정보 매칭은 사용하지 않습니다.'
      : 'In consent-required or unresolved regions, the Gravity pixel is blocked until acceptance. Elsewhere measurement is enabled by default, but explicit refusal and browser GPC/Do Not Track are honored. Visitors who accepted the visit-only notice are asked again for the expanded scope. Signup is measured after the server confirms account creation; look generation after a newly saved image is observed. Confirmed external purchases and campaign optimization setup are not yet connected. Customer identity matching is not used.'}</p>
    <p className="text-foreground/80 leading-relaxed">{language === 'ko'
      ? '광고 설정에서 선택을 변경할 수 있습니다. 이 브라우저에 임의 방문자 식별자, 선택 시각·지역·언어·안내문 버전과 수락·거절 이력을 보관하며, 철회해도 이전 수락 기록은 유지합니다. 브라우저 저장 데이터를 삭제하면 해당 기록도 삭제됩니다. Gravity 방문 쿠키는 최대 180일, 세션 쿠키는 최대 1일 사용됩니다. 위치 확인에는 동일 사이트의 /cdn-cgi/trace를 사용합니다.'
      : 'Change your choice in Advertising settings. This browser stores a random visitor reference, timestamps, region, language, notice version and acceptance/refusal history; withdrawing preserves earlier acceptance evidence. Clearing browser storage deletes this record. Gravity uses visitor cookies for up to 180 days and session cookies for up to one day. Region is determined using this site’s /cdn-cgi/trace.'}</p>
    <p className="text-sm text-muted-foreground">{NOTICE_VERSION} · <a href="https://docs.trygravity.com/advertisers/pixel" className="text-primary underline" target="_blank" rel="noopener noreferrer">Gravity</a></p>
    <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event('sml:advertising-settings'))}>
      {language === 'ko' ? '광고 설정 변경' : 'Change advertising settings'}
    </Button>
    <details><summary className="text-sm text-muted-foreground">{language === 'ko' ? '이전 방문 전용 안내' : 'Previous visit-only notice'}</summary><p className="text-sm">gravity-visits-2026-10-20 · {LEGACY_AD_NOTICE[language]}</p></details>
  </section>;
}