import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import MainNavigation from "@/components/MainNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SERVICE_POLICY,
  TIER_IDS,
  TIER_FACTS,
  activePromotions,
  tierFeaturesKo,
} from "../../supabase/functions/_shared/serviceFacts";

// Everything here is read from serviceFacts.ts, so tier/price/promo changes show up automatically.
const Policy = () => {
  const { language } = useLanguage();
  const en = language === "en";
  const promos = activePromotions();
  const amount = (n: number) => (en ? `${n.toLocaleString("en-US")} KRW` : `${n.toLocaleString()}원`);
  const limit = (n: number, unit: string) => (n === -1 ? (en ? "Unlimited" : "무제한") : `${n}${unit}`);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{en ? "Service Policy | ShowMeLook" : "서비스 규정 | 쇼미룩"}</title>
        <link rel="canonical" href="https://showmelook.com/policy" />
      </Helmet>
      <MainNavigation showBackButton />
      <main className="container max-w-3xl mx-auto px-4 py-12 font-korean">
        <h1 className="text-3xl font-bold mb-3">{en ? "ShowMeLook Service Policy" : "쇼미룩 서비스 규정"}</h1>
        <p className="text-muted-foreground mb-10 break-keep">
          {en
            ? "These are the rules Shomi and the site always follow. Tiers and perks update automatically when pricing changes."
            : "쇼미와 사이트가 항상 따르는 기준이에요. 요금제가 바뀌면 이 페이지도 자동으로 함께 바뀝니다."}
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{en ? "Core rules" : "기본 규정"}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-foreground/80 break-keep">
            {SERVICE_POLICY.map((p) => <li key={p.ko}>{en ? p.en : p.ko}</li>)}
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{en ? "Membership tiers" : "등급별 혜택"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TIER_IDS.map((id) => {
              const t = TIER_FACTS[id];
              return (
                <article key={id} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{en ? t.nameEn : t.nameKo}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {id === "free" ? (en ? "On sign-up" : "가입 시") : id === "bronze" ? (en ? "First purchase" : "첫 구매") : `${en ? "From" : "누적"} ${amount(t.minAmount)}`}
                  </p>
                  {en ? (
                    <ul className="text-sm text-foreground/80 space-y-1">
                      <li>Daily: {limit(t.dailyLimit, "")}</li>
                      <li>{t.hasWatermark ? "Watermark" : "No watermark"}</li>
                    </ul>
                  ) : (
                    <ul className="text-sm text-foreground/80 space-y-1">
                      {tierFeaturesKo(id).map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
          <Link to="/pricing" className="mt-4 inline-block text-sm font-medium text-primary">
            {en ? "See pricing →" : "요금제 자세히 보기 →"}
          </Link>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{en ? "Current promotions" : "진행 중인 혜택"}</h2>
          <ul className="list-disc pl-6 space-y-2 text-foreground/80 break-keep">
            {promos.length
              ? promos.map((p) => <li key={p.id}>{en ? p.en : p.ko}</li>)
              : <li>{en ? "No promotions right now." : "현재 진행 중인 프로모션이 없어요."}</li>}
          </ul>
        </section>

        <p className="text-sm text-muted-foreground">
          {en ? "Questions? " : "궁금한 점은 "}
          <Link to="/policy?shomi=open" className="text-primary font-medium">{en ? "Ask Shomi" : "쇼미에게 물어보세요"}</Link>
          {" · "}
          <Link to="/terms" className="text-primary">{en ? "Terms" : "이용약관"}</Link>
        </p>
      </main>
    </div>
  );
};

export default Policy;
