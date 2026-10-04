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
      ko: "등급은 월 구독이 아니라 누적 구매액으로 올라가. 무료는 하루 5회·월 25회 생성에 갤러리 10장이야. 첫 구매만 하면 브론즈로 자동 전환되면서 월 무제한 생성, 워터마크 제거, 고화질 다운로드가 열려. 그 다음부터는 누적 10만원부터 실버(하루 10회·상품 추천 먼저보기), 30만원부터 골드(하루 20회·히스토리 영구), 100만원부터 플래티넘(무제한 생성·모델 프로필 추가·우선 대기열)이야. 표는 /pricing 에 있어.",
      en: "Tiers grow with your total purchase, not a monthly subscription. Free gives you 5 styles a day, 25 a month and 10 gallery saves. Your first purchase moves you to Bronze automatically — unlimited monthly styles, no watermark, HD downloads. Then Silver starts at 100,000 KRW (10 a day, early access to product picks), Gold at 300,000 KRW (20 a day, permanent history) and Platinum at 1,000,000 KRW (unlimited styles, extra model profiles, priority queue). Full table: /pricing.",
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
    ko: [["가이드"], ["체형"], ["퍼스널컬러"], ["퍼스널 컬러"], ["레이어링"], ["사이즈"], ["미니멀"], ["비율", "보정"]],
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
    en: [["birthday"], ["favorite"], ["prefer"], ["where", "live"], ["about", "your"]],
    answer: {
      ko: "내 생일은 9월 21일이고, 서울 성수동을 제일 자주 걸어. 아이스 라떼는 거의 기본값, 바질 파스타랑 피스타치오 젤라또도 좋아. 스타일은 네이비 테일러링에 핑크 새틴, 반반 와이드 브림햇이 시그니처야.",
      en: "My birthday is September 21 and I walk around Seongsu the most. Iced latte is basically a default, and I love basil pasta and pistachio gelato. My signature is navy tailoring with pink satin and a half-and-half wide-brim hat.",
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
