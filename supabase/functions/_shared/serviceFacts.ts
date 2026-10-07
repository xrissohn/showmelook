// Single source of truth for ShowMeLook membership tiers, service copy and promotions.
// Imported by the website (src/lib/tierConfig.ts, About page) AND by the Shomi chat
// edge function, so changing a number here updates the pricing page and Shomi together.
// Keep this file dependency-free (plain TS) so both Vite and Deno can import it.

export type TierId = "free" | "bronze" | "silver" | "gold" | "platinum";

export interface TierFacts {
  nameKo: string;
  nameEn: string;
  minAmount: number; // 누적 구매 금액(원)
  dailyLimit: number; // -1 = 무제한
  // 요금제는 구독이 아니라 누적 구매 금액 기준 등급제다.
  // 아래 4개(monthlyLimit·galleryLimit·hdDownload·historyDays)는 아직 실제로 적용되지 않는다.
  // 지켜지지 않는 혜택을 약속하지 않도록 화면·쇼미 문구에는 쓰지 않는다(적용을 구현하면 그때 다시 노출).
  monthlyLimit: number; // -1 = 무제한 (미적용)
  galleryLimit: number; // -1 = 무제한 (미적용)
  hasWatermark: boolean;
  hdDownload: boolean; // (미적용)
  historyDays: number; // -1 = 영구 (미적용)
  canPreviewRecommendations: boolean;
  extraProfiles: boolean; // 100만원당 모델 프로필 +1
  priorityQueue: boolean;
}

export const TIER_IDS: TierId[] = ["free", "bronze", "silver", "gold", "platinum"];

export const TIER_FACTS: Record<TierId, TierFacts> = {
  free: { nameKo: "무료", nameEn: "Free", minAmount: 0, dailyLimit: 5, monthlyLimit: 25, galleryLimit: 10, hasWatermark: true, hdDownload: false, historyDays: 7, canPreviewRecommendations: false, extraProfiles: false, priorityQueue: false },
  bronze: { nameKo: "브론즈", nameEn: "Bronze", minAmount: 1, dailyLimit: 5, monthlyLimit: -1, galleryLimit: 30, hasWatermark: false, hdDownload: true, historyDays: 30, canPreviewRecommendations: false, extraProfiles: false, priorityQueue: false },
  silver: { nameKo: "실버", nameEn: "Silver", minAmount: 100000, dailyLimit: 10, monthlyLimit: -1, galleryLimit: 50, hasWatermark: false, hdDownload: true, historyDays: 90, canPreviewRecommendations: true, extraProfiles: false, priorityQueue: false },
  gold: { nameKo: "골드", nameEn: "Gold", minAmount: 300000, dailyLimit: 20, monthlyLimit: -1, galleryLimit: 100, hasWatermark: false, hdDownload: true, historyDays: -1, canPreviewRecommendations: true, extraProfiles: false, priorityQueue: false },
  platinum: { nameKo: "플래티넘", nameEn: "Platinum", minAmount: 1000000, dailyLimit: -1, monthlyLimit: -1, galleryLimit: -1, hasWatermark: false, hdDownload: true, historyDays: -1, canPreviewRecommendations: true, extraProfiles: true, priorityQueue: true },
};

// Ongoing credit benefits shown by Shomi and the About page.
export const BONUS = {
  galleryCreditMax: 10, // 공개 룩 1개당 1크레딧, 최대 횟수
  referralMaxUses: 10,
};

// Time-limited promotions. Add an entry here (with optional start/end dates, ISO
// yyyy-mm-dd, KST) and Shomi starts/stops mentioning it automatically.
export interface Promotion {
  id: string;
  ko: string;
  en: string;
  link?: string;
  startsAt?: string;
  endsAt?: string;
}
export const PROMOTIONS: Promotion[] = [
  { id: "gallery-credit", ko: `내 룩을 공개로 등록하면 1크레딧 보너스(최대 ${BONUS.galleryCreditMax}회)`, en: `Publish a look to earn 1 bonus credit (up to ${BONUS.galleryCreditMax} times)`, link: "/mypage" },
  { id: "referral", ko: "친구가 내 추천 코드로 가입하면 보너스 크레딧", en: "Bonus credits when a friend signs up with your referral code", link: "/mypage" },
];

const kstDay = (now: Date) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
export const activePromotions = (now = new Date()): Promotion[] => {
  const d = kstDay(now);
  return PROMOTIONS.filter((p) => (!p.startsAt || p.startsAt <= d) && (!p.endsAt || d <= p.endsAt));
};

// Official service copy (verbatim from the site's title/description).
export const SERVICE_COPY = {
  title: "쇼미룩 - AI 패션 스타일링 서비스 | ShowMeLook",
  description: "스타일리스트 쇼미가 당신에게 딱 맞는 패션 스타일을 제안합니다. 사진 한 장으로 트렌디한 스타일을 경험하고, 나만의 룩북을 완성하세요. 무료로 시작하기!",
  descriptionEn: "Stylist Shomi suggests the fashion style that fits you best. Try trendy looks with a single photo and build your own lookbook. Start for free!",
  slogan: "유행보다 취향.",
  sloganEn: "Taste over trends.",
};

// Official service policy. Shomi must never contradict these, whatever other notes say.
export const SERVICE_POLICY: { ko: string; en: string }[] = [
  { ko: "가입·시작은 무료이고 월 구독은 없다. 등급은 누적 구매액으로만 오른다.", en: "Signing up is free and there is no monthly subscription. Tiers rise only with total purchases." },
  { ko: "상품 결제·배송·교환·환불은 각 제휴 쇼핑몰에서 이뤄지고 그 쇼핑몰 정책을 따른다. 쇼미룩이 직접 환불해주지 않는다.", en: "Payment, shipping, exchanges and refunds happen at each partner store under its own policy; ShowMeLook does not refund directly." },
  { ko: "가상 피팅 이미지는 실루엣·색감 참고용이며 실제 착용감이나 정확한 사이즈를 보장하지 않는다.", en: "Virtual try-on images are a guide to silhouette and color, not a guarantee of fit or exact size." },
  { ko: "의류·신발은 사이즈·옵션·재고가 확인된 상품만 추천한다. 액세서리는 구매 가능하면 추천할 수 있다.", en: "Clothing and shoes are recommended only when size, options and stock are confirmed; accessories may be recommended when purchasable." },
  { ko: "업로드한 사진과 생성한 룩은 기본 비공개이며, 사용자가 직접 공개를 선택해야 커뮤니티에 보인다.", en: "Uploaded photos and generated looks are private by default and appear in the community only if the user chooses to publish them." },
  { ko: "무료 등급 이미지에는 워터마크가 표시된다.", en: "Free-tier images show a watermark." },
  { ko: "가격·혜택·횟수는 이 문구와 /pricing 기준으로만 안내하고, 없는 할인·보상·일정을 약속하지 않는다.", en: "Prices, perks and limits are stated only from this copy and /pricing; never promise discounts, compensation or dates that are not listed." },
];

export const serviceIntro = (lang: "ko" | "en"): string =>
  lang === "ko"
    ? `${SERVICE_COPY.description} 슬로건은 '${SERVICE_COPY.slogan}' 더 자세한 소개는 /about, 바로 시작은 /style 에서!`
    : `${SERVICE_COPY.descriptionEn} Our motto: '${SERVICE_COPY.sloganEn}' More at /about, or jump in at /style.`;

const won = (n: number) => (n >= 10000 ? `${n / 10000}만원` : `${n.toLocaleString()}원`);
const krw = (n: number) => `${n.toLocaleString("en-US")} KRW`;

/** Korean perk list, used on the pricing cards and in Shomi's knowledge. */
export const tierFeaturesKo = (id: TierId): string[] => {
  const t = TIER_FACTS[id];
  const f: string[] = [];
  f.push(t.dailyLimit === -1 ? "무제한 스타일 생성" : `일일 스타일 생성 ${t.dailyLimit}회`);
  if (t.canPreviewRecommendations) f.push("상품 추천만 먼저보기 ✨");
  f.push(t.hasWatermark ? "이미지에 워터마크 표시" : "워터마크 없는 이미지");
  if (t.extraProfiles) f.push("모델 프로필 추가 (100만원당 +1명)");
  if (t.priorityQueue) f.push("우선 생성 대기열");
  return f;
};

const tierLine = (id: TierId, lang: "ko" | "en"): string => {
  const t = TIER_FACTS[id];
  if (lang === "ko") {
    const when = id === "free" ? "" : id === "bronze" ? "(첫 구매)" : `(누적 ${won(t.minAmount)}~)`;
    const p = [
      t.dailyLimit === -1 ? "무제한 생성" : `하루 ${t.dailyLimit}회`,
      t.canPreviewRecommendations ? "상품 추천 먼저보기" : "",
      t.hasWatermark ? "워터마크 있음" : "워터마크 없음",
      t.extraProfiles ? "모델 프로필 100만원당 +1명" : "",
      t.priorityQueue ? "우선 대기열" : "",
    ].filter(Boolean);
    return `- ${t.nameKo}${when}: ${p.join(", ")}`;
  }
  const when = id === "free" ? "" : id === "bronze" ? " (first purchase)" : ` (from ${krw(t.minAmount)})`;
  const p = [
    t.dailyLimit === -1 ? "unlimited styles" : `${t.dailyLimit} a day`,
    t.canPreviewRecommendations ? "early access to product picks" : "",
    t.hasWatermark ? "watermark" : "no watermark",
    t.extraProfiles ? "+1 model profile per 1,000,000 KRW" : "",
    t.priorityQueue ? "priority queue" : "",
  ].filter(Boolean);
  return `- ${t.nameEn}${when}: ${p.join(", ")}`;
};

export const tierFaqAnswer = (lang: "ko" | "en"): string =>
  lang === "ko"
    ? `등급은 월 구독이 아니라 누적 구매액으로 올라가.\n${TIER_IDS.map((id) => tierLine(id, "ko")).join("\n")}\n표는 /pricing 에 있어.`
    : `Tiers grow with your total purchases, not a monthly subscription.\n${TIER_IDS.map((id) => tierLine(id, "en")).join("\n")}\nFull table: /pricing.`;

/** Knowledge block for Shomi (Korean). Changes only when facts or active promotions change. */
export const serviceKnowledgeKo = (now = new Date()): string => {
  const promos = activePromotions(now);
  return [
    "## 공식 서비스 문구",
    `- 사이트 제목: ${SERVICE_COPY.title}`,
    `- 소개: ${SERVICE_COPY.description}`,
    `- 슬로건: ${SERVICE_COPY.slogan}`,
    "- 소개 페이지 /about, 서비스 규정 /policy, 쇼미 채팅 공유 링크 showmelook.com/shomi",
    "",
    "## 서비스 정책 (최우선 — 다른 자료와 충돌하면 이것을 따름)",
    ...SERVICE_POLICY.map((p) => `- ${p.ko}`),
    "",
    "## 등급 (누적 구매액 기준, /pricing)",
    ...TIER_IDS.map((id) => tierLine(id, "ko")),
    "",
    "## 진행 중인 혜택·프로모션",
    ...(promos.length ? promos.map((p) => `- ${p.ko}${p.link ? ` (${p.link})` : ""}`) : ["- 현재 진행 중인 프로모션 없음"]),
  ].join("\n");
};
