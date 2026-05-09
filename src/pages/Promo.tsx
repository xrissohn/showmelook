import { Helmet } from "react-helmet-async";

const Promo = () => {
  return (
    <>
      <Helmet>
        <title>쇼미룩 프로모 영상 | ShowMeLook</title>
        <meta name="description" content="쇼미룩 ShowMeLook AI 가상피팅 프로모션 영상" />
        <meta property="og:title" content="쇼미룩 프로모 영상" />
        <meta property="og:type" content="video.other" />
        <meta property="og:video" content="https://showmelook.com/showmelook-promo.mp4" />
        <meta property="og:image" content="https://showmelook.com/showmelook-promo-thumbnail.jpg" />
        <link rel="canonical" href="https://showmelook.com/promo" />
      </Helmet>
      <main className="min-h-screen bg-black flex items-center justify-center p-0 md:p-6">
        <div className="w-full max-w-5xl">
          <h1 className="sr-only">쇼미룩 프로모 영상</h1>
          <video
            className="w-full h-auto md:rounded-2xl shadow-2xl bg-black"
            src="/showmelook-promo.mp4"
            poster="/showmelook-promo-thumbnail.jpg"
            controls
            autoPlay
            playsInline
            preload="metadata"
          >
            <source src="/showmelook-promo.mp4" type="video/mp4" />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>
        </div>
      </main>
    </>
  );
};

export default Promo;
