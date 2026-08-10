import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GUIDES } from "@/content/guides";

const HOW_TO_STEPS = [
  {
    title: "1. 얼굴 사진 한 장 등록",
    body: "정면을 보고 그림자 없이 찍은 사진이면 충분합니다. 등록한 사진은 내 룩을 만들 때만 사용돼요.",
  },
  {
    title: "2. 키·몸무게·취향 입력",
    body: "체형 정보를 실제 수치 그대로 입력하면 상의 기장과 팬츠 밑단 위치가 훨씬 정확하게 반영됩니다.",
  },
  {
    title: "3. 상황을 담아 스타일 요청",
    body: "‘가을 저녁 데이트, 차분한 톤, 니트와 슬랙스’처럼 상황·분위기·아이템 순으로 적으면 결과가 좋아집니다.",
  },
  {
    title: "4. 결과 비교 후 상품 확인",
    body: "마음에 든 룩은 저장하고, 룩에 사용된 카테고리로 실제 판매 상품을 이어서 확인할 수 있어요.",
  },
];

const FAQ_ITEMS = [
  {
    q: "AI 스타일링이란 정확히 무엇인가요?",
    a: "입력한 체형 정보와 취향, 상황을 바탕으로 AI가 어울리는 옷 조합을 구성하고, 그 조합을 실제 착장 이미지로 만들어 보여주는 방식입니다. 쇼미룩은 여기에 실제 판매 상품 데이터를 연결해, 화면 속 룩을 그대로 구매까지 이어갈 수 있게 합니다.",
  },
  {
    q: "쇼미룩은 무료로 쓸 수 있나요?",
    a: "네. 가입하면 무료 생성 횟수가 제공되고, 추천 상품을 구매해 등급이 올라가면 더 많은 스타일을 생성할 수 있습니다. 별도의 월 구독을 하지 않아도 기본 기능은 계속 이용할 수 있어요.",
  },
  {
    q: "등록한 사진과 생성한 룩은 공개되나요?",
    a: "기본값은 비공개입니다. 내가 직접 공개로 전환한 룩만 스타일 갤러리에 노출되며, 언제든 다시 비공개로 되돌릴 수 있습니다.",
  },
  {
    q: "결과가 실제 착용 모습과 얼마나 비슷한가요?",
    a: "실루엣과 색 조합의 인상을 확인하는 데는 매우 유용하지만, 실측 사이즈를 대체하지는 않습니다. 구매 전에는 상품 페이지의 어깨너비·총장 등 실측 수치를 함께 확인하시길 권합니다.",
  },
  {
    q: "어떤 옷을 골라야 할지 모르겠어요.",
    a: "쇼미가 정리한 스타일 가이드를 먼저 읽어보세요. 체형별 코디 공식, 퍼스널 컬러, 레이어링, 사이즈 고르는 법까지 실전 기준으로 정리되어 있습니다.",
  },
];

const LandingContentSections = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="mx-auto max-w-4xl">
        <h2 className="font-korean text-2xl font-bold sm:text-3xl break-keep">
          쇼미룩 사용법
        </h2>
        <p className="mt-3 font-korean text-muted-foreground break-keep">
          처음 오셨다면 네 단계만 따라오시면 됩니다. 옷을 고르는 시간을 줄이고,
          실패하는 구매를 줄이는 것이 쇼미룩의 목표예요.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {HOW_TO_STEPS.map((step) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <h3 className="font-korean font-semibold break-keep">{step.title}</h3>
              <p className="mt-2 font-korean text-sm text-muted-foreground break-keep">
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <h2 className="mt-14 font-korean text-2xl font-bold sm:text-3xl break-keep">
          쇼미가 제안하는 스타일 가이드
        </h2>
        <p className="mt-3 font-korean text-muted-foreground break-keep">
          쇼미룩의 공식 AI 모델 쇼미가 직접 비교하고 확인한 기준을 글로 정리했어요.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {GUIDES.slice(0, 6).map((guide) => (
            <li key={guide.slug}>
              <Link
                to={`/guide/${guide.slug}`}
                className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
              >
                <span className="font-korean text-sm font-medium break-keep">
                  {guide.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          to="/guide"
          className="mt-4 inline-block font-korean text-sm font-medium text-primary"
        >
          스타일 가이드 전체 보기 →
        </Link>

        <h2 className="mt-14 font-korean text-2xl font-bold sm:text-3xl break-keep">
          자주 묻는 질문
        </h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left font-korean break-keep">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="font-korean text-muted-foreground break-keep">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default LandingContentSections;
