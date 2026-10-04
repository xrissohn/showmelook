import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, BookOpen, Camera, Crown, MessageCircle, ShoppingBag, Sparkles, UserRound } from "lucide-react";
import MainNavigation from "@/components/MainNavigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { TIER_CONFIG, TIER_ORDER, formatAmount } from "@/lib/tierConfig";
import { GUIDES } from "@/content/guides";
import { GUIDE_TITLES_EN } from "@/components/landing/LandingContentSections";
import { SERVICE_COPY } from "../../supabase/functions/_shared/serviceFacts";
import shomiFace from "@/assets/shomi-face-profile.png.asset.json";

const BASE_URL = "https://showmelook.com";

const COPY = {
  ko: {
    metaTitle: "쇼미룩 소개 | 스타일리스트 쇼미와 AI 가상피팅",
    eyebrow: "쇼미룩 소개",
    title: "\"이 옷, 나한테 어울릴까?\"\n그 망설임을 줄여주는 곳",
    lead: SERVICE_COPY.description,
    start: "무료로 룩 만들기",
    how: "이렇게 사용해요",
    steps: [
      { icon: UserRound, t: "가입하고 정보 입력", d: "구글 또는 이메일로 1분 가입, 키·체형 정보를 입력해요." },
      { icon: Camera, t: "얼굴 사진 등록", d: "정면·균일한 조명의 사진 한 장이면 충분해요." },
      { icon: Sparkles, t: "AI 전신 룩 생성", d: "상황과 분위기를 적으면 나에게 입혀진 룩이 만들어져요." },
      { icon: ShoppingBag, t: "실제 상품으로 연결", d: "룩에 쓰인 상품을 파트너 쇼핑몰에서 바로 확인해요." },
    ],
    shomiTitle: "스타일리스트 쇼미에게 물어보세요",
    shomiBody: "쇼미는 쇼미룩의 패셔니스타 캐릭터예요. 코디 고민, 사이즈, 등급과 요금까지 친구처럼 바로 답해줘요. 슬로건은 \"유행보다 취향.\"",
    shomiOpen: "쇼미와 채팅하기",
    shomiShare: "공유 링크",
    pricingTitle: "구독 없이, 구매가 쌓이면 등급이 올라가요",
    pricingMore: "요금제 자세히 보기",
    unlimited: "무제한",
    perDay: "하루",
    times: "회",
    firstPurchase: "첫 구매",
    from: "누적",
    freeLabel: "가입 즉시",
    guideTitle: "쇼미가 정리한 스타일 가이드",
    guideMore: "가이드 전체 보기",
    ctaTitle: "오늘은 어떤 모습이고 싶어?",
    ctaBody: "사진 한 장으로 나만의 룩북을 시작해 보세요.",
  },
  en: {
    metaTitle: "About ShowMeLook | Stylist Shomi & AI Virtual Fitting",
    eyebrow: "About ShowMeLook",
    title: "\"Will this look good on me?\"\nWe make that question easier",
    lead: "Stylist Shomi suggests fashion styles that fit you. Try trendy looks with a single photo and build your own lookbook. Start for free!",
    start: "Create a look for free",
    how: "How it works",
    steps: [
      { icon: UserRound, t: "Sign up", d: "Join in a minute with Google or email, then add your height and body type." },
      { icon: Camera, t: "Add a face photo", d: "One front-facing photo in even light is all it takes." },
      { icon: Sparkles, t: "Get a full-body look", d: "Describe the occasion and mood, and AI dresses you in a look." },
      { icon: ShoppingBag, t: "Shop the real items", d: "Every item in the look links to a partner store." },
    ],
    shomiTitle: "Ask stylist Shomi",
    shomiBody: "Shomi is ShowMeLook's fashionista character. Outfit ideas, sizing, tiers and pricing — she answers right away, like a friend. Her motto: \"Taste over trends.\"",
    shomiOpen: "Chat with Shomi",
    shomiShare: "Share link",
    pricingTitle: "No subscription — your tier rises as you shop",
    pricingMore: "See full pricing",
    unlimited: "Unlimited",
    perDay: "",
    times: " a day",
    firstPurchase: "First purchase",
    from: "From",
    freeLabel: "On sign-up",
    guideTitle: "Style guides by Shomi",
    guideMore: "See all guides",
    ctaTitle: "How do you want to look today?",
    ctaBody: "Start your own lookbook with a single photo.",
  },
};

const About = () => {
  const { language } = useLanguage();
  const c = COPY[language === "en" ? "en" : "ko"];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const tierCondition = (id: (typeof TIER_ORDER)[number]) => {
    const t = TIER_CONFIG[id];
    if (id === "free") return c.freeLabel;
    if (id === "bronze") return c.firstPurchase;
    return `${c.from} ${formatAmount(t.minAmount, language)}~`;
  };
  const tierLimit = (id: (typeof TIER_ORDER)[number]) => {
    const d = TIER_CONFIG[id].dailyLimit;
    return d === -1 ? c.unlimited : language === "en" ? `${d}${c.times}` : `${c.perDay} ${d}${c.times}`;
  };

  return (
    <>
      <Helmet>
        <title>{c.metaTitle}</title>
        <meta name="description" content={SERVICE_COPY.description} />
        <link rel="canonical" href={`${BASE_URL}/about`} />
        <meta property="og:title" content={c.metaTitle} />
        <meta property="og:description" content={SERVICE_COPY.description} />
      </Helmet>
      <MainNavigation />

      <main className="min-h-screen bg-background pt-20 pb-24">
        {/* Intro */}
        <section className="container max-w-4xl mx-auto px-4 py-12 md:py-20 text-center">
          <p className="text-sm font-medium text-primary mb-4">{c.eyebrow}</p>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground whitespace-pre-line leading-tight">{c.title}</h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">{c.lead}</p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/style">
              {c.start} <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </section>

        {/* How it works */}
        <section className="container max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">{c.how}</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.steps.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-primary mb-3">
                  <s.icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-foreground">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Shomi */}
        <section className="container max-w-5xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-border bg-muted/40 p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <img src={shomiFace.url} alt="" className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover object-center border-4 border-background shadow-lg" />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-foreground">{c.shomiTitle}</h2>
              <p className="mt-3 text-muted-foreground">{c.shomiBody}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <Button asChild>
                  <Link to="/about?shomi=open">
                    <MessageCircle className="w-4 h-4 mr-1" /> {c.shomiOpen}
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">
                  {c.shomiShare}:{" "}
                  <Link to="/shomi" className="text-primary underline underline-offset-4">showmelook.com/shomi</Link>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing summary */}
        <section className="container max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" /> {c.pricingTitle}
            </h2>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {TIER_ORDER.map((id) => (
              <div key={id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{tierCondition(id)}</p>
                <p className="mt-1 font-bold text-foreground">{language === "en" ? TIER_CONFIG[id].name : TIER_CONFIG[id].nameKo}</p>
                <p className="mt-2 text-sm text-primary font-medium">{tierLimit(id)}</p>
              </div>
            ))}
          </div>
          <Link to="/pricing" className="mt-5 inline-flex items-center text-sm font-medium text-primary hover:underline">
            {c.pricingMore} <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </section>

        {/* Guides */}
        <section className="container max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
            <BookOpen className="w-6 h-6 text-primary" /> {c.guideTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GUIDES.slice(0, 4).map((g) => (
              <li key={g.slug}>
                <Link to={`/guide/${g.slug}`} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-primary transition-colors">
                  <span className="font-medium text-foreground">{language === "en" ? GUIDE_TITLES_EN[g.slug] || g.title : g.title}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/guide" className="mt-5 inline-flex items-center text-sm font-medium text-primary hover:underline">
            {c.guideMore} <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </section>

        {/* CTA */}
        <section className="container max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{c.ctaTitle}</h2>
          <p className="mt-3 text-muted-foreground">{c.ctaBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/style">{c.start}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/about?shomi=open">{c.shomiOpen}</Link>
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default About;
