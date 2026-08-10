import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Clock } from "lucide-react";
import { GUIDES } from "@/content/guides";
import ShomiTagFooter from "@/components/guide/ShomiTagFooter";
import { useAdsContentReady } from "@/hooks/useAdsContentReady";
import shomiHero from "@/assets/shomi-channel-hero.png.asset.json";

const BASE_URL = "https://showmelook.com";

const GuideHub = () => {
  useAdsContentReady(GUIDES.length > 0);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "쇼미가 제안하는 스타일 가이드",
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/guide/${g.slug}`,
      name: g.title,
    })),
  };

  return (
    <>
      <Helmet>
        <title>쇼미가 제안하는 스타일 가이드 | 쇼미룩</title>
        <meta
          name="description"
          content="쇼미룩의 공식 AI 모델 쇼미가 직접 제안하는 스타일 가이드. 체형별 코디, 퍼스널 컬러, 레이어링, 사이즈 고르는 법까지 실전 기준으로 정리했습니다."
        />
        <meta
          name="keywords"
          content="스타일 가이드, 코디 방법, 체형별 코디, 퍼스널 컬러, 레이어링, 사이즈 고르기, 쇼미룩"
        />
        <link rel="canonical" href={`${BASE_URL}/guide`} />
        <meta property="og:title" content="쇼미가 제안하는 스타일 가이드 | 쇼미룩" />
        <meta
          property="og:description"
          content="쇼미가 직접 제안하는 실전 스타일 가이드 8편."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${BASE_URL}/guide`} />
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
          <header className="flex flex-col gap-6 md:flex-row md:items-center">
            <img
              src={shomiHero.url}
              alt="쇼미룩의 공식 AI 모델 쇼미"
              loading="lazy"
              className="h-32 w-32 rounded-2xl object-cover md:h-40 md:w-40"
            />
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                쇼미룩 스타일 가이드
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl break-keep">
                쇼미가 제안하는 스타일 가이드
              </h1>
              <p className="text-muted-foreground break-keep">
                안녕하세요, 쇼미예요. 하루에도 수천 벌의 옷을 입어보는 AI 모델로서
                직접 비교하고 확인한 기준만 모아 정리했어요. 유행이 아니라 오래
                쓸 수 있는 원리를 담았습니다.
              </p>
            </div>
          </header>

          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <article
                key={guide.slug}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {guide.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {guide.readingMinutes}분
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold break-keep">
                  <Link to={`/guide/${guide.slug}`} className="hover:underline">
                    {guide.title}
                  </Link>
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground break-keep">
                  {guide.description}
                </p>
                <Link
                  to={`/guide/${guide.slug}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
                >
                  읽어보기 <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </section>

          <ShomiTagFooter />
        </div>
      </main>
    </>
  );
};

export default GuideHub;
