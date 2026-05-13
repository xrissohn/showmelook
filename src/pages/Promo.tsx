import { Helmet } from "react-helmet-async";

const Promo = () => {
  const description =
    "쇼미룩 ShowMeLook AI 가상피팅 서비스의 프로모션 영상입니다. 사진 한 장으로 만드는 나만의 스타일, 영상으로 빠르게 확인해보세요.";

  return (
    <>
      <Helmet>
        <title>쇼미룩 프로모 영상 | ShowMeLook</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://showmelook.com/promo" />
        <meta property="og:title" content="쇼미룩 프로모 영상 | ShowMeLook" />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content="https://showmelook.com/promo" />
        <meta property="og:video" content="https://showmelook.com/showmelook-promo.mp4" />
        <meta property="og:image" content="https://showmelook.com/showmelook-promo-thumbnail.jpg" />
        <meta name="twitter:title" content="쇼미룩 프로모 영상 | ShowMeLook" />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://showmelook.com/showmelook-promo-thumbnail.jpg" />
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
