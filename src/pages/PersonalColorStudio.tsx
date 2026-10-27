import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Sun, User, Sparkles, Loader2, RefreshCw, Trash2, Save, Wand2, AlertTriangle, ShieldCheck } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import PersonalColorView from '@/components/personal-color/PersonalColorView';
import {
  SEASONS, SEASON_INFO, seasonLabel, buildManualPersonalColor, prepareImage, analyzePersonalColor,
  savePersonalColor, loadPersonalColor, type PersonalColor, type RetakeReason, type Season,
} from '@/lib/personalColor';

const COPY = {
  ko: {
    title: '퍼스널 컬러 스튜디오',
    subtitle: '사진 한 장으로 나에게 어울리는 톤을 추정하고, 그 색으로 코디를 추천받아 보세요.',
    saved: '저장된 내 컬러', none: '아직 저장된 퍼스널 컬러가 없어요.',
    guideTitle: '촬영 가이드',
    guide: ['창가 같은 자연광에서, 정면으로', '필터·보정 없이, 진한 메이크업은 피해서', '얼굴이 한 명만 또렷하게 보이도록', '컬러 조명·강한 그림자는 피하기'],
    consent: '분석을 위해 이 사진을 보내는 데 동의합니다. 쇼미룩은 분석용 사진을 별도 저장하거나 공개하지 않습니다. AI 분석 제공자에게 전송됩니다.',
    upload: '사진 선택하고 분석하기', analyzing: '사진의 색을 살펴보는 중… (최대 1분)',
    disclaimer: '사진 기반 추정이에요. 조명·카메라에 따라 달라질 수 있고, 전문가 대면 진단을 대신하지 않아요.',
    retakeTitle: '이 사진으로는 판단하기 어려워요', retakeHint: '아래 내용을 확인하고 다시 찍어 주세요.',
    retake: {
      no_face: '얼굴이 잘 보이지 않아요', multiple_faces: '여러 명이 함께 나왔어요', strong_color_light: '색이 있는 조명이 강해요',
      filter_or_heavy_makeup: '필터나 진한 메이크업으로 피부색이 가려졌어요', too_dark: '사진이 너무 어두워요', blurry: '흐리거나 해상도가 낮아요', face_covered: '얼굴이 많이 가려졌어요',
    } as Record<RetakeReason, string>,
    errors: {
      timeout: '분석이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.', network: '연결에 문제가 있어요. 다시 시도해 주세요.',
      busy: '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.', daily_limit: '오늘 사진 분석 횟수(5회)를 모두 사용했어요. 내일 다시 하거나 아래에서 직접 선택할 수 있어요.',
      ai_unavailable: '지금은 AI 분석을 사용할 수 없어요. 직접 선택을 이용해 주세요.', analysis_failed: '분석 결과를 만들지 못했어요. 다른 사진으로 다시 시도해 주세요.',
      invalid_image: 'JPG·PNG·WEBP 사진을 선택해 주세요.', image_too_large: '사진이 너무 커요.', auth_required: '로그인이 필요해요.', default: '분석 중 문제가 생겼어요. 다시 시도해 주세요.',
    } as Record<string, string>,
    retry: '다시 시도', newPhoto: '다른 사진 선택',
    resultTitle: 'AI 사진 분석 결과', save: '내 프로필에 저장', discard: '저장하지 않기',
    manualTitle: '직접 선택하기', manualHint: '이미 내 톤을 알고 있다면 고르세요. 직접 선택한 결과는 AI 분석으로 표시되지 않아요.',
    reanalyze: '다시 분석', remove: '삭제', removed: '퍼스널 컬러를 삭제했어요.', savedToast: '내 프로필에 저장했어요.',
    styleCta: '내 컬러로 코디 추천받기', note: '저장한 컬러는 본인 프로필로 추천받을 때만 참고해요(가족 프로필엔 적용되지 않아요). 색상·사이즈가 꼭 맞는다고 보장하진 않아요.',
    login: '로그인하고 시작하기', saveError: '저장하지 못했어요. 다시 시도해 주세요.',
    manualPreviewTitle: '직접 선택한 톤 미리보기', manualPreviewHint: '팔레트와 활용 팁을 확인한 뒤 저장하세요. 저장 전까지 기존 컬러는 그대로예요.', cancel: '취소',
    loadError: '저장된 컬러를 불러오지 못했어요.', loadRetry: '다시 불러오기', loadingSaved: '불러오는 중…', consentNeeded: '다시 시도하려면 위 동의에 체크해 주세요.',
  },
  en: {
    title: 'Personal Color Studio',
    subtitle: 'Estimate the tone that flatters you from one photo, then get outfits in your colors.',
    saved: 'Your saved color', none: 'No personal color saved yet.',
    guideTitle: 'Photo guide',
    guide: ['Natural light (e.g. by a window), facing the camera', 'No filters or retouching; avoid heavy makeup', 'Only one face, clearly visible', 'Avoid colored lights and harsh shadows'],
    consent: 'I agree to send this photo for analysis. Show Me Look does not separately store or publish analysis photos. The photo is sent to an AI analysis provider.',
    upload: 'Choose a photo and analyze', analyzing: 'Looking at the colors in your photo… (up to 1 min)',
    disclaimer: 'This is a photo-based estimate. Lighting and cameras can change it, and it does not replace an in-person consultation.',
    retakeTitle: "We can't judge from this photo", retakeHint: 'Please check the following and try another photo.',
    retake: {
      no_face: "Your face isn't clearly visible", multiple_faces: 'More than one person is in the photo', strong_color_light: 'Strong colored lighting',
      filter_or_heavy_makeup: 'A filter or heavy makeup hides your natural tone', too_dark: 'The photo is too dark', blurry: 'The photo is blurry or low resolution', face_covered: 'Your face is mostly covered',
    } as Record<RetakeReason, string>,
    errors: {
      timeout: 'The analysis is taking too long. Please try again shortly.', network: 'Connection problem. Please try again.',
      busy: 'Lots of requests right now. Please try again shortly.', daily_limit: "You've used today's 5 photo analyses. Try again tomorrow or choose your tone below.",
      ai_unavailable: 'AI analysis is unavailable right now. You can choose your tone below.', analysis_failed: "We couldn't produce a result. Please try a different photo.",
      invalid_image: 'Please choose a JPG, PNG or WEBP photo.', image_too_large: 'The photo is too large.', auth_required: 'Please sign in.', default: 'Something went wrong. Please try again.',
    } as Record<string, string>,
    retry: 'Try again', newPhoto: 'Choose another photo',
    resultTitle: 'AI photo analysis result', save: 'Save to my profile', discard: "Don't save",
    manualTitle: 'Choose it yourself', manualHint: "Already know your tone? Pick it here. Manual picks are never shown as an AI analysis.",
    reanalyze: 'Analyze again', remove: 'Delete', removed: 'Personal color deleted.', savedToast: 'Saved to your profile.',
    styleCta: 'Get outfits in my colors', note: 'Your saved color is used only when you style your own profile (never family profiles). Exact color or size match is not guaranteed.',
    login: 'Sign in to start', saveError: "Couldn't save. Please try again.",
    manualPreviewTitle: 'Preview of your chosen tone', manualPreviewHint: 'Check the palette and tips, then save. Your current color stays until you save.', cancel: 'Cancel',
    loadError: "Couldn't load your saved color.", loadRetry: 'Load again', loadingSaved: 'Loading…', consentNeeded: 'Tick the consent box above to try again.',
  },
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'result'; value: PersonalColor }
  | { kind: 'retake'; reasons: RetakeReason[] }
  | { kind: 'error'; code: string };

const notifyUpdated = () => window.dispatchEvent(new Event('sml:personal-color-updated'));

export default function PersonalColorStudio() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'ko';
  const c = COPY[lang];
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastImage = useRef<string | null>(null);
  const [saved, setSaved] = useState<PersonalColor | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [manualPreview, setManualPreview] = useState<Season | null>(null);
  // In-flight analysis; aborted on sign-out, account switch, consent withdrawal or leaving the page.
  const requestRef = useRef<AbortController | null>(null);
  const userId = user?.id ?? null;

  const cancelAnalysis = () => {
    requestRef.current?.abort();
    requestRef.current = null;
  };

  const reload = useCallback(() => {
    if (!userId) return;
    setLoadState('loading');
    loadPersonalColor(userId)
      .then((v) => { setSaved(v); setLoadState('ok'); })
      .catch(() => setLoadState('error'));
  }, [userId]);

  useEffect(() => {
    cancelAnalysis();
    lastImage.current = null;
    setPhase({ kind: 'idle' });
    setManualPreview(null);
    setSaved(null);
    reload();
  }, [userId, reload]);

  useEffect(() => () => cancelAnalysis(), []);

  const onConsentChange = (v: boolean) => {
    setConsent(v);
    if (!v) {
      cancelAnalysis();
      setPhase((p) => (p.kind === 'analyzing' ? { kind: 'idle' } : p));
    }
  };

  const run = async (image: string) => {
    if (!consent || !userId) return; // latest consent + sign-in checked on every send, including retries
    cancelAnalysis();
    const controller = new AbortController();
    requestRef.current = controller;
    setPhase({ kind: 'analyzing' });
    let res: Awaited<ReturnType<typeof analyzePersonalColor>>;
    try {
      res = await analyzePersonalColor(image, lang, { consent: true, signal: controller.signal });
    } catch {
      res = { status: 'error', code: 'network' };
    }
    if (controller.signal.aborted || requestRef.current !== controller) return; // stale: never show it
    requestRef.current = null;
    if (res.status === 'ok') setPhase({ kind: 'result', value: res.result });
    else if (res.status === 'retake') { lastImage.current = null; setPhase({ kind: 'retake', reasons: res.reasons }); }
    else setPhase({ kind: 'error', code: res.code });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !consent || !userId) return;
    try {
      const image = await prepareImage(file);
      lastImage.current = image;
      await run(image);
    } catch {
      setPhase({ kind: 'error', code: 'invalid_image' });
    }
  };

  const persist = async (value: PersonalColor | null) => {
    if (!userId) return;
    setBusy(true);
    try {
      const stored = await savePersonalColor(userId, value); // throws unless our own row came back updated
      setSaved(stored);
      setLoadState('ok');
      lastImage.current = null;
      setPhase({ kind: 'idle' });
      setManualPreview(null);
      notifyUpdated();
      toast({ title: value ? c.savedToast : c.removed });
    } catch {
      toast({ title: c.saveError, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = () => fileRef.current?.click();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <SEOHead pageKey="personalColor" />
      <MainNavigation showBackButton />
      <main className="pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl space-y-6">
          <header className="rounded-3xl bg-gradient-personal-color border border-border p-6 sm:p-8">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="w-4 h-4" /> Show Me Look</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">{c.title}</h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">{c.subtitle}</p>
          </header>

          {!loading && !user ? (
            <div className="rounded-3xl bg-card border border-border p-6 text-center">
              <Button onClick={() => navigate('/auth')} className="rounded-full">{c.login}</Button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              {/* Left: saved + manual */}
              <div className="space-y-6">
                <section className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-foreground mb-4">{c.saved}</h2>
                  {loadState === 'loading' ? (
                    <p className="text-sm text-muted-foreground">{c.loadingSaved}</p>
                  ) : loadState === 'error' ? (
                    <div role="alert" className="space-y-3">
                      <p className="text-sm text-foreground">{c.loadError}</p>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={reload}><RefreshCw className="w-4 h-4 mr-1" />{c.loadRetry}</Button>
                    </div>
                  ) : saved ? (
                    <>
                      <PersonalColorView value={saved} language={lang} />
                      {saved.source === 'ai_photo' && <p className="mt-4 text-xs text-muted-foreground">{c.disclaimer}</p>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button asChild className="rounded-full bg-gradient-brand text-primary-foreground"><Link to="/style"><Wand2 className="w-4 h-4 mr-1" />{c.styleCta}</Link></Button>
                        <Button variant="outline" className="rounded-full" onClick={() => persist(null)} disabled={busy}><Trash2 className="w-4 h-4 mr-1" />{c.remove}</Button>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{c.note}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{c.none}</p>
                  )}
                </section>

                <section className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-foreground">{c.manualTitle}</h2>
                  <p className="mt-1 mb-4 text-xs text-muted-foreground">{c.manualHint}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SEASONS.map((s: Season) => (
                      <button
                        key={s}
                        disabled={busy}
                        aria-pressed={manualPreview === s}
                        onClick={() => setManualPreview(s)}
                        className={`rounded-2xl border p-3 text-left transition-colors hover:border-primary ${manualPreview === s ? 'border-primary bg-secondary' : 'border-border bg-background'}`}
                      >
                        <span className="font-semibold text-foreground text-sm">{seasonLabel(s, lang)}</span>
                        <span className="mt-2 flex gap-1">
                          {SEASON_INFO[s].palette.slice(0, 5).map((p) => (
                            <span key={p.hex} className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: p.hex }} />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                  {manualPreview && (
                    <div className="mt-5 rounded-2xl border border-primary/40 bg-gradient-personal-color p-4 space-y-4" data-testid="manual-preview">
                      <div>
                        <p className="font-semibold text-foreground">{c.manualPreviewTitle}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.manualPreviewHint}</p>
                      </div>
                      <PersonalColorView value={buildManualPersonalColor(manualPreview, lang)} language={lang} />
                      <div className="flex flex-wrap gap-2">
                        <Button className="rounded-full bg-gradient-brand text-primary-foreground" disabled={busy || loadState === 'loading'} onClick={() => persist(buildManualPersonalColor(manualPreview, lang))}>
                          <Save className="w-4 h-4 mr-1" />{c.save}
                        </Button>
                        <Button variant="outline" className="rounded-full" onClick={() => setManualPreview(null)}>{c.cancel}</Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Right: AI flow */}
              <section className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-sm space-y-5">
                {phase.kind === 'result' ? (
                  <>
                    <h2 className="text-lg font-bold text-foreground">{c.resultTitle}</h2>
                    <PersonalColorView value={phase.value} language={lang} />
                    <p className="text-xs text-muted-foreground flex gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{c.disclaimer}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-full bg-gradient-brand text-primary-foreground" onClick={() => persist(phase.value)} disabled={busy || loadState === 'loading'}><Save className="w-4 h-4 mr-1" />{c.save}</Button>
                      <Button variant="outline" className="rounded-full" onClick={() => setPhase({ kind: 'idle' })}>{c.discard}</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{c.guideTitle}</h2>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {c.guide.map((g, i) => {
                          const Icon = [Sun, Camera, User, Sparkles][i];
                          return (
                            <li key={g} className="flex items-start gap-2 rounded-2xl bg-secondary/60 p-3 text-sm text-foreground">
                              <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />{g}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {phase.kind === 'analyzing' ? (
                      <div className="rounded-2xl bg-gradient-personal-color p-8 flex flex-col items-center gap-3 text-center" role="status">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-foreground">{c.analyzing}</p>
                      </div>
                    ) : (
                      <>
                        {phase.kind === 'retake' && (
                          <div className="rounded-2xl border border-border bg-secondary/60 p-4" role="alert">
                            <p className="font-semibold text-foreground">{c.retakeTitle}</p>
                            <p className="text-xs text-muted-foreground mt-1">{c.retakeHint}</p>
                            <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                              {phase.reasons.map((r) => <li key={r}>{c.retake[r] ?? r}</li>)}
                            </ul>
                          </div>
                        )}
                        {phase.kind === 'error' && (
                          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4" role="alert">
                            <p className="text-sm text-foreground">{c.errors[phase.code] ?? c.errors.default}</p>
                            {lastImage.current && !['daily_limit', 'invalid_image', 'image_too_large', 'ai_unavailable'].includes(phase.code) && (
                              <>
                                <Button size="sm" variant="outline" className="mt-3 rounded-full" disabled={!consent || !user} onClick={() => lastImage.current && run(lastImage.current)}>
                                  <RefreshCw className="w-4 h-4 mr-1" />{c.retry}
                                </Button>
                                {!consent && <p className="mt-2 text-xs text-muted-foreground">{c.consentNeeded}</p>}
                              </>
                            )}
                          </div>
                        )}
                        <label className="flex items-start gap-3 rounded-2xl border border-border p-4 cursor-pointer">
                          <Checkbox checked={consent} onCheckedChange={(v) => onConsentChange(v === true)} className="mt-0.5" aria-label="consent" />
                          <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            <ShieldCheck className="inline w-4 h-4 mr-1 text-primary" />{c.consent}
                          </span>
                        </label>
                        <Button onClick={pickPhoto} disabled={!consent || !user} className="w-full h-12 rounded-full bg-gradient-brand text-primary-foreground">
                          <Camera className="w-5 h-5 mr-2" />{phase.kind === 'idle' ? (saved ? c.reanalyze : c.upload) : c.newPhoto}
                        </Button>
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} data-testid="personal-color-file" />
                        <p className="text-xs text-muted-foreground">{c.disclaimer}</p>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
