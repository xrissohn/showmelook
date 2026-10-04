// 쇼미 챗 선답변 레이어.
// 자주 오는 질문은 AI를 부르지 않고 아래 답변으로 바로 답한다(크레딧 0).
// 답변 사실은 knowledge.ts의 홈페이지 정보/등급/FAQ/가이드 절에서 가져왔다.
// 투자·재무 수치는 여기에 넣지 않는다.

export type FaqEntry = {
  id: string;
  // 각 그룹은 "이 단어들이 같이 들어 있으면" 매칭. 그룹 중 하나라도 성립하면 후보.
  ko: string[][];
  en: string[][];
  answer: { ko: string; en: string };
};

const norm = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[\s.,!?~·\-—_/()[\]{}'"“”’]+/g, "");

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "who",
    ko: [["쇼미", "누구"], ["너", "누구"], ["누구야"], ["너", "뭐"], ["프로필"]],
    en: [["who", "you"], ["who"], ["tell", "about", "you"], ["your", "profile"]],
    answer: {
      ko: "난 쇼미야. 성수동에서 옷보다 '그 옷을 고른 이유'가 더 궁금한 패셔니스타이고, 지금은 쇼미룩에서 네 룩을 찾아주는 스타일 큐레이터로 일해. 슬로건은 '유행보다 취향'. 내 말이 궁금하면 /style 에서 룩 하나 뽑아보자!",
      en: "I'm Shomi — a fashionista from Seongsu who's more curious about why you picked an outfit than the outfit itself. Here at ShowMeLook I work as your style curator, and my motto is 'taste over trends'. Want to see it in action? Try /style.",
    },
  },
  {
    id: "tier",
    ko: [["등급"], ["브론즈"], ["실버"], ["골드"], ["플래티넘"]],
    en: [["tier"], ["bronze"], ["silver"], ["gold"], ["platinum"]],
    answer: {
      ko: "등급은 월 구독이 아니라 누적 구매액으로 올라가.\n- 무료: 하루 5회·월 25회 생성, 갤러리 10장, 히스토리 7일, 워터마크 있음\n- 브론즈(첫 구매): 하루 5회·월 무제한, 워터마크 없음, 고화질 다운로드, 갤러리 30장, 히스토리 30일\n- 실버(누적 10만원~): 하루 10회, 상품 추천 먼저보기, 갤러리 50장, 히스토리 90일\n- 골드(누적 30만원~): 하루 20회, 갤러리 100장, 히스토리 영구\n- 플래티넘(누적 100만원~): 무제한 생성, 갤러리 무제한, 모델 프로필 100만원당 +1명, 우선 대기열\n표는 /pricing 에 있어.",
      en: "Tiers grow with your total purchases, not a monthly subscription.\n- Free: 5 styles a day, 25 a month, 10 gallery saves, 7-day history, watermark\n- Bronze (first purchase): 5 a day, unlimited monthly, no watermark, HD downloads, 30 gallery saves, 30-day history\n- Silver (from 100,000 KRW): 10 a day, early access to product picks, 50 gallery saves, 90-day history\n- Gold (from 300,000 KRW): 20 a day, 100 gallery saves, permanent history\n- Platinum (from 1,000,000 KRW): unlimited styles and gallery, +1 model profile per 1,000,000 KRW, priority queue\nFull table: /pricing.",
    },
  },
  {
    id: "price",
    ko: [["무료"], ["얼마"], ["가격"], ["요금"], ["구독"], ["돈"], ["비용"]],
    en: [["free"], ["price"], ["pricing"], ["cost"], ["much"], ["subscription"], ["money"]],
    answer: {
      ko: "쇼미룩은 무료로 시작할 수 있어. 가입하면 하루 5회(월 25회) 생성이 기본이고, 월 구독 없이 구매가 쌓이면 등급이 올라가면서 횟수가 늘어. 무료 사용자는 이미지에 워터마크가 붙는 점만 알아줘. 상세는 /pricing, 바로 만들어보려면 /style.",
      en: "You can start for free. Signing up gives you 5 styles a day (25 a month), and there's no monthly subscription — your tiers rise as your purchases add up. Only thing to know: free images carry a watermark. Details on /pricing, or jump straight into /style.",
    },
  },
  {
    id: "privacy",
    ko: [["공개"], ["비공개"], ["사진", "어떻게"], ["개인정보"], ["삭제"], ["보안"]],
    en: [["public"], ["private"], ["privacy"], ["delete"], ["photo", "safe"], ["data"]],
    answer: {
      ko: "기본은 비공개야. 네가 직접 공개로 바꾼 룩만 스타일 갤러리에 보이고, 언제든 다시 비공개로 되돌릴 수 있어. 공개 룩을 등록하면 크레딧 1회 보너스도 받아(최대 10회). 사진과 데이터 취급은 /privacy 에 정리돼 있어.",
      en: "Everything is private by default. Only looks you switch to public show up in the style gallery, and you can hide them again any time. Publishing a look also earns a bonus credit (up to 10). How photos and data are handled is written up in /privacy.",
    },
  },
  {
    id: "howto",
    ko: [["어떻게", "만들"], ["사용법"], ["어디서"], ["시작"], ["하는법"], ["하는 법"], ["방법"]],
    en: [["how", "does", "it", "work"], ["how", "start"], ["how", "use"], ["how", "make"], ["get", "started"], ["tutorial"]],
    answer: {
      ko: "흐름은 이렇게 돌아가: 가입해서 사진과 체형 정보를 올리고 → AI가 네 전신 착장 룩을 만들고 → 그 룩에 쓰인 상품을 확인하고 → 파트너몰로 구매. 사진이 없어도 체형 정보만으로 시작할 수 있고, /style 에서 바로 해볼 수 있어.",
      en: "Here's the flow: sign up and add your photo and body info → AI builds a full-body look on you → check the products in that look → buy them from the partner store. You can also start with body info alone, no photo. It all happens on /style.",
    },
  },
  {
    id: "outfit",
    ko: [["데이트룩"], ["오피스룩"], ["캐주얼룩"], ["코디"], ["추천"], ["뭐", "입"], ["패션", "조언"]],
    en: [["date", "look"], ["office", "look"], ["casual", "look"], ["outfit"], ["wear"], ["style", "advice"], ["coordi"]],
    answer: {
      ko: "코디는 상황 → 실루엣 → 색 순서로 정하면 쉬워. 데이트룩은 부드러운 소재에 허리선 높은 하의, 오피스룩은 V넥에 스트레이트 팬츠, 캐주얼은 질감 있는 소재 하나를 주력으로 잡는 게 기본이야. 쇼미가 정리한 조합법은 /guide/date-office-casual-look 에 있고, 내 몸에 실제로 맞는지는 /style 에서 확인하는 게 제일 빨라.",
      en: "Decide in this order: occasion → silhouette → colour. For a date, soft fabrics with high-waisted bottoms; for the office, a V-neck with straight trousers; for casual, one textured piece as the anchor. I wrote the combos up at /guide/date-office-casual-look, and /style is the fastest way to see them on your own body.",
    },
  },
  {
    id: "guide",
    ko: [["가이드"], ["가이드", "어디"], ["체형"], ["퍼스널컬러"], ["퍼스널 컬러"], ["레이어링"], ["사이즈"], ["미니멀"], ["비율", "보정"]],
    en: [["guide"], ["body", "type"], ["personal", "color"], ["layering"], ["size"], ["minimal"], ["proportion"]],
    answer: {
      ko: "가이드는 8개야: 체형별 코디 공식, 퍼스널 컬러별 옷 색 고르기, 미니멀 룩 5원칙, 계절별 레이어링, 데이트·오피스·캐주얼 조합법, 비율 보정 코디, AI 가상피팅 200% 활용법, 사이즈 실패하지 않는 법. /guide 에서 모아서 볼 수 있어.",
      en: "There are 8 guides: body-type formulas, dressing by personal colour, 5 minimal-look principles, seasonal layering, date/office/casual combos, proportion styling, getting the most out of AI fitting, and picking the right size. Browse them all at /guide.",
    },
  },
  {
    id: "community",
    ko: [["커뮤니티"], ["갤러리"], ["좋아요"], ["쇼미채널"]],
    en: [["community"], ["gallery"], ["likes"], ["channel"]],
    answer: {
      ko: "/community 에서 공개된 룩을 구경하고 좋아요를 누를 수 있어. 내 룩은 기본 비공개니까, 보여주고 싶으면 마이페이지에서 공개로 바꿔주면 되고 그러면 크레딧 보너스도 챙겨줘.",
      en: "On /community you can browse public looks and leave likes. Your own looks stay private by default — switch one to public from My Page if you want it shown, and you'll get a bonus credit for it.",
    },
  },
  {
    id: "affiliate",
    ko: [["수수료"], ["제휴"], ["어디서", "사"], ["구매", "연결"], ["링크"]],
    en: [["commission"], ["affiliate"], ["where", "buy"], ["buy", "link"], ["partner"]],
    answer: {
      ko: "화면의 구매 링크는 파트너몰로 이어지는 제휴 링크야. 그 링크로 구매가 일어나면 쇼미룩이 수수료를 받을 수 있어. 다만 상품 가격은 파트너몰 표기가 그대로야. 담아둔 상품은 /cart 에서 정리할 수 있어.",
      en: "The buy buttons are affiliate links into partner stores. If a purchase happens through them ShowMeLook may earn a commission, but the product prices stay as the partner store lists them. Things you saved are on /cart.",
    },
  },
  {
    id: "sns",
    ko: [["인스타"], ["유튜브"], ["틱톡"], ["스레드"], ["sns"], ["연락처"], ["contact"]],
    en: [["instagram"], ["youtube"], ["tiktok"], ["threads"], ["sns"], ["contact"], ["email"]],
    answer: {
      ko: "쇼미 SNS는 인스타 @showmi.look, 유튜브 @showmi_tv, 틱톡 @showmi.look, 스레드 @showmi.look 이야. 개인 연락처는 여기서 공유하기 어려워, 계정 관련 문제는 /privacy 나 /terms 쪽 안내를 봐줘.",
      en: "You can find Shomi on Instagram @showmi.look, YouTube @showmi_tv, TikTok @showmi.look and Threads @showmi.look. I can't share personal contact details here — for account issues, /privacy and /terms have the right pointers.",
    },
  },
  {
    id: "watermark",
    ko: [["워터마크"]],
    en: [["watermark"]],
    answer: {
      ko: "무료 사용자는 생성 이미지에 워터마크가 붙어. 첫 구매로 브론즈가 되면 워터마크 없는 이미지와 고화질 다운로드가 열려.",
      en: "Free accounts get a watermark on generated images. Once your first purchase moves you to Bronze, images come clean and HD downloads unlock.",
    },
  },
  {
    id: "install",
    ko: [["앱", "설치"], ["설치"], ["홈", "화면"], ["빠른", "실행"]],
    en: [["install"], ["app"], ["home", "screen"], ["shortcut"]],
    answer: {
      ko: "/install 에 가면 홈 화면에 추가하는 방법이 있어. 앱처럼 바로 열 수 있고, 오프라인 화면은 없이 설치와 빠른 실행만 지원해.",
      en: "/install shows you how to add the site to your home screen. It opens like an app — it's about installing and launching fast, there's no offline mode.",
    },
  },
  {
    id: "bonus",
    ko: [["추천인"], ["친구"], ["초대"], ["보너스"], ["크레딧", "받"], ["크레딧", "충전"], ["크레딧", "추가"]],
    en: [["referral"], ["refer"], ["invite"], ["bonus"], ["credit", "get"], ["extra", "credit"]],
    answer: {
      ko: "크레딧은 두 가지로 늘어나. 친구 추천 코드로 가입하면 보너스가 들어오고, 룩을 공개로 등록하면 1회씩 쌓여(최대 10회). 내 크레딧 내역은 /mypage 에서 볼 수 있어.",
      en: "There are two ways to earn credits: a friend's referral code adds a bonus when they join, and publishing a look adds one each time (up to 10). Your balance and history are on /mypage.",
    },
  },
  {
    id: "persona",
    ko: [["생일"], ["취향"], ["좋아하는"], ["어디", "사"], ["성수동"]],
    en: [["birthday"], ["favorite"], ["prefer"], ["where", "live"], ["about", "your"], ["tell", "about", "your"]],
    answer: {
      ko: "내 생일은 9월 21일이고, 서울 성수동을 제일 자주 걸어. 아이스 라떼는 거의 기본값, 바질 파스타랑 피스타치오 젤라또도 좋아. 스타일은 네이비 테일러링에 핑크 새틴, 반반 와이드 브림햇이 시그니처야.",
      en: "My birthday is September 21 and I walk around Seongsu the most. Iced latte is basically a default, and I love basil pasta and pistachio gelato. My signature is navy tailoring with pink satin and a half-and-half wide-brim hat.",
    },
  },
  {
    id: "login",
    ko: [["로그인"], ["회원가입"], ["가입", "어떻게"], ["가입하"], ["계정"]],
    en: [["login"], ["log", "in"], ["sign", "up"], ["signup"], ["account"], ["register"]],
    answer: {
      ko: "가입은 구글 계정이나 이메일 인증으로 1분이면 끝나. 가입하면 바로 무료 생성 횟수가 생기니까 /auth 에서 시작해서 /style 로 넘어가 봐!",
      en: "Sign-up takes about a minute with Google or email verification, and you get free style credits right away. Start at /auth, then head to /style!",
    },
  },
  {
    id: "accuracy",
    ko: [["실제", "비슷"], ["실제", "똑같"], ["정확"], ["진짜", "같"], ["실물"]],
    en: [["accurate"], ["accuracy"], ["realistic"], ["real", "life"], ["look", "real"]],
    answer: {
      ko: "실루엣이랑 색 조합의 인상을 미리 보는 데는 꽤 쓸모 있어. 다만 실측 사이즈를 대신하진 않으니까, 사기 전엔 상품 페이지의 어깨너비·총장 같은 실측도 꼭 같이 봐줘. 사이즈 고르는 팁은 /guide/size-selection-guide 에 있어.",
      en: "It's great for previewing the silhouette and color mix, but it doesn't replace real measurements. Before buying, check the product's shoulder width and length too. Sizing tips: /guide/size-selection-guide.",
    },
  },
  {
    id: "size",
    ko: [["사이즈"], ["사이즈", "골라"], ["사이즈", "고르"], ["사이즈", "어떻게"], ["치수"], ["실측"], ["핏", "고르"]],
    en: [["size"], ["sizing"], ["measurement"], ["fit", "choose"]],
    answer: {
      ko: "S/M/L보다 실측 수치를 봐. 잘 맞는 내 옷을 눕혀 재고 비교하면 돼 — 어깨 ±1cm, 가슴단면 상의 ±2cm·아우터 ±3cm, 총장 ±2cm 안이면 실패가 거의 없어. 자세한 건 /guide/size-selection-guide!",
      en: "Look at real measurements, not S/M/L. Lay a well-fitting piece of yours flat and compare — within ±1cm on shoulders, ±2cm chest for tops (±3cm outerwear) and ±2cm length, you rarely go wrong. More: /guide/size-selection-guide.",
    },
  },
  {
    id: "buy",
    ko: [["구매"], ["어디서", "사"], ["주문"], ["결제"], ["배송"], ["환불"], ["반품"], ["교환"], ["환불", "어디"], ["배송", "어디"], ["반품", "어디"]],
    en: [["buy"], ["purchase"], ["order"], ["shipping"], ["delivery"], ["refund"], ["return"], ["exchange"]],
    answer: {
      ko: "룩에 나온 상품을 누르면 실제 판매하는 파트너 쇼핑몰로 이동해서 거기서 결제해. 그래서 배송·교환·환불은 그 쇼핑몰 정책을 따라. 참고로 구매 링크는 제휴 링크라 쇼미룩이 수수료를 받을 수 있고, 구매가 쌓이면 네 등급도 올라가(/pricing).",
      en: "Tapping a product in your look takes you to the partner store that sells it, and you pay there — so shipping, exchanges and refunds follow that store's policy. Purchase links are affiliate links (ShowMeLook may earn a commission), and your purchases also raise your tier (/pricing).",
    },
  },
  {
    id: "photo",
    ko: [["사진", "어떤"], ["사진", "잘"], ["얼굴", "사진"], ["사진", "팁"], ["사진", "없"]],
    en: [["photo", "tips"], ["which", "photo"], ["what", "photo"], ["face", "photo"], ["no", "photo"]],
    answer: {
      ko: "얼굴 사진은 정면, 어깨까지 나오게, 그림자 없는 고른 조명이 제일 좋아. 필터·보정은 최소로, 모자랑 선글라스는 빼줘. 사진이 없어도 체형 정보만으로 시작할 수 있어. 더 많은 팁은 /guide/ai-virtual-fitting-tips!",
      en: "Best face photo: front-facing, shoulders visible, even light with no shadows. Keep filters minimal and skip hats and sunglasses. No photo? You can start with body info alone. More tips: /guide/ai-virtual-fitting-tips.",
    },
  },
  {
    id: "prompt",
    ko: [["프롬프트"], ["뭐라고", "입력"], ["어떻게", "입력"], ["검색어"]],
    en: [["prompt"], ["what", "type"], ["what", "write"]],
    answer: {
      ko: "'상황 + 분위기 + 아이템' 순서로 3개 정도만 적어봐. 예를 들면 '주말 브런치, 밝은 톤, 데님 재킷'. '멋있게 아무거나'보다 훨씬 잘 나와. 그리고 한 번에 판단하지 말고 하나씩만 바꿔서 비교해 봐!",
      en: "Write 'situation + mood + item', about three conditions — e.g. 'weekend brunch, bright tones, denim jacket'. Works way better than 'anything cool'. Then change one thing at a time and compare!",
    },
  },
  {
    id: "limit",
    ko: [["횟수", "다"], ["횟수", "초과"], ["더", "만들"], ["생성", "안"], ["한도"], ["다 썼"]],
    en: [["limit"], ["out", "of", "credits"], ["no", "more"], ["ran", "out"], ["used", "up"]],
    answer: {
      ko: "하루 생성 횟수를 다 쓰면 다음 날 다시 채워져. 바로 더 만들고 싶으면 룩을 공개로 등록해서 보너스 크레딧(최대 10회)을 받거나, 친구 추천 코드로 보너스를 받을 수 있어. 첫 구매로 브론즈가 되면 월 제한도 없어져(/pricing).",
      en: "When you use up today's styles, they refill the next day. Want more now? Publish a look for a bonus credit (up to 10) or share your referral code. A first purchase gets you Bronze with no monthly cap (/pricing).",
    },
  },
  {
    id: "withdraw",
    ko: [["탈퇴"], ["계정", "삭제"], ["회원", "삭제"]],
    en: [["delete", "account"], ["close", "account"], ["deactivate"]],
    answer: {
      ko: "계정과 내 정보 관리는 /mypage 에서 할 수 있고, 개인정보 처리와 삭제 기준은 /privacy 에 정리돼 있어.",
      en: "You can manage your account and info on /mypage, and how personal data is handled and deleted is explained in /privacy.",
    },
  },
  {
    id: "language",
    ko: [["영어"], ["언어"]],
    en: [["english"], ["korean"], ["language"]],
    answer: {
      ko: "쇼미룩은 한국어와 영어를 지원해. 화면 위쪽 언어 버튼으로 바꿀 수 있고, 나도 영어로 대답할 수 있어!",
      en: "ShowMeLook supports Korean and English — switch with the language button at the top. I can chat in English too!",
    },
  },
];

// 개인 체형 정보가 들어간 질문은 선답변으로 처리하지 않고 AI에게 넘긴다.
const PERSONAL = /(\d\s*(kg|cm|세|살|개월)|키\s*\d|몸무게|체중|height|weight|\bage\b)/i;

export function matchFaq(text: string, language: string): FaqEntry | null {
  const q = norm(text);
  if (!q) return null;
  if (q.length > 70) return null;
  if (PERSONAL.test(text)) return null;

  const korean = /[\u3131-\uD79D]/.test(text);
  const useKo = korean || language !== "en";

  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of FAQ_ENTRIES) {
    const groups = useKo ? entry.ko : entry.en;
    let score = 0;
    for (const group of groups) {
      if (group.every((k) => q.includes(norm(k)))) {
        const s = group.reduce((a, k) => a + norm(k).length, 0);
        if (s > score) score = s;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

export function faqAnswer(entry: FaqEntry, text: string, language: string): string {
  const korean = /[\u3131-\uD79D]/.test(text);
  return korean || language !== "en" ? entry.answer.ko : entry.answer.en;
}
