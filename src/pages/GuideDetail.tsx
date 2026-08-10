import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Check, Clock, Sparkles, Wand2 } from "lucide-react";
import MainNavigation from "@/components/MainNavigation";
import { getGuideBySlug, getRelatedGuides } from "@/content/guides";
import ShomiTagFooter from "@/components/guide/ShomiTagFooter";
import { useAdsContentReady } from "@/hooks/useAdsContentReady";
import { Button } from "@/components/ui/button";
import shomiProfile from "@/assets/shomi-face-profile.png.asset.json";

const BASE_URL = "https://showmelook.com";

const GuideDetail = () => {
  const { slug } = useParams();
  const guide = getGuideBySlug(slug);
  useAdsContentReady(Boolean(guide));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (!guide) return <Navigate to="/guide" replace />;

  const url = `${BASE_URL}/guide/${guide.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    author: { "@type": "Organization", name: "쇼미룩 ShowMeLook" },
    publisher: { "@type": "Organization", name: "쇼미룩 ShowMeLook" },
    dateModified: guide.updated,
    mainEntityOfPage: url,
    inLanguage: "ko-KR",
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "스타일 가이드", item: `${BASE_URL}/guide` },
      { "@type": "ListItem", position: 3, name: guide.title, item: url },
    ],
  };

  const related = getRelatedGuides(guide.slug);

  return (
    <>
      <Helmet>
        <title>{guide.seoTitle}</title>
        <meta name="description" content={guide.description} />
        <meta name="keywords" content={guide.keywords} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={guide.seoTitle} />
        <meta property="og:description" content={guide.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <MainNavigation />
      <main className="min-h-screen bg-background text-foreground pt-16 sm:pt-20">
        <article className="mx-auto max-w-3xl px-5 py-8 md:py-12">
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> 스타일 가이드
            </Link>
          </nav>

          <header className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">{guide.category}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {guide.readingMinutes}분 읽기
              </span>
              <span>· {guide.updated} 업데이트</span>
            </div>
            <h1 className="text-2xl font-bold leading-snug tracking-tight md:text-4xl break-keep">
              {guide.title}
            </h1>
          </header>

          <section className="mt-6 flex gap-4 rounded-2xl border border-border bg-muted/40 p-5">
          <img
            src={shomiProfile.url}
            alt="쇼미룩 AI 모델 쇼미"
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
            <p className="text-sm leading-relaxed text-foreground break-keep">
              {guide.intro}
            </p>
          </section>

          <nav className="mt-8 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">목차</p>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              {guide.sections.map((s, i) => (
                <li key={s.heading}>
                  <a href={`#section-${i}`} className="hover:text-foreground break-keep">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 space-y-10">
            {guide.sections.map((section, i) => (
              <section key={section.heading} id={`section-${i}`} className="scroll-mt-20">
                <h2 className="text-xl font-semibold break-keep">{section.heading}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p} className="mt-3 leading-relaxed text-muted-foreground break-keep">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-4 space-y-2">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-sm text-foreground break-keep">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <section className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" /> 쇼미의 체크리스트
            </h2>
            <ul className="mt-4 space-y-2">
              {guide.checklist.map((item) => (
                <li key={item} className="flex gap-2 text-sm break-keep">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground break-keep">
              {guide.outro}
            </p>
            {guide.lookPrompts?.length ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm font-semibold break-keep">
                  쇼미가 제안하는 룩 — 누르면 프롬프트가 자동 입력돼요
                </p>
                <div className="grid gap-2">
                  {guide.lookPrompts.map((lp) => (
                    <Link
                      key={lp.prompt}
                      to={`/style?prompt=${encodeURIComponent(lp.prompt)}`}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50"
                    >
                      <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium break-keep">
                          {lp.label}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground break-keep">
                          {lp.prompt}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Button asChild className="mt-5">
                <Link to="/style">쇼미룩에서 이 룩 만들어보기</Link>
              </Button>
            )}
          </section>

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-semibold">함께 읽으면 좋은 글</h2>
              <ul className="mt-4 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={`/guide/${r.slug}`}
                      className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
                    >
                      <p className="font-medium break-keep">{r.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground break-keep">
                        {r.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ShomiTagFooter hashtags={guide.hashtags} />
        </article>
      </main>
    </>
  );
};

export default GuideDetail;
