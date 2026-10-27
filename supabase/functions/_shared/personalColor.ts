// Personal color rules shared by analyze-personal-color, style-recommend (Deno) and the web app / Vitest.
// No runtime imports except the pure productColors helpers.
import { parseColorsFromString, resolveItemColors, type ColorProduct } from './productColors.ts';

export const SEASONS = ['spring_warm', 'summer_cool', 'autumn_warm', 'winter_cool'] as const;
export type Season = typeof SEASONS[number];
export type Undertone = 'warm' | 'cool';
export type PersonalColorSource = 'ai_photo' | 'manual';
export type Confidence = 'low' | 'medium' | 'high';

export const RETAKE_REASONS = [
  'no_face', 'multiple_faces', 'strong_color_light', 'filter_or_heavy_makeup', 'too_dark', 'blurry', 'face_covered',
] as const;
export type RetakeReason = typeof RETAKE_REASONS[number];

export interface Swatch { name: string; hex: string }

export interface PersonalColor {
  season: Season;
  undertone: Undertone;
  source: PersonalColorSource;
  palette: Swatch[];
  avoid: Swatch[];
  tips: string[];
  summary?: string;
  confidence?: Confidence; // AI only, qualitative (never a percentage)
  analyzedAt?: string; // AI only
  updatedAt: string;
}

interface SeasonInfo {
  undertone: Undertone;
  ko: string;
  en: string;
  /** Product color names (as returned by resolveItemColors) that suit this tone. */
  good: string[];
  /** Product color names that usually look less flattering near the face. */
  avoid: string[];
  palette: Swatch[];
  avoidSwatches: Swatch[];
  tipsKo: string[];
  tipsEn: string[];
}

export const SEASON_INFO: Record<Season, SeasonInfo> = {
  spring_warm: {
    undertone: 'warm', ko: '봄 웜', en: 'Spring Warm',
    good: ['cream', 'ivory', 'beige', 'coral', 'orange', 'yellow', 'camel', 'mint', 'sand', 'wheat/tan', 'tan', 'gold', 'green'],
    avoid: ['black', 'charcoal', 'silver', 'burgundy'],
    palette: [
      { name: 'Ivory', hex: '#FFF4DC' }, { name: 'Peach', hex: '#FFC3A0' }, { name: 'Coral', hex: '#FF7F66' },
      { name: 'Butter Yellow', hex: '#F9DF7B' }, { name: 'Light Camel', hex: '#D9A86C' }, { name: 'Apple Green', hex: '#9BCB6B' },
    ],
    avoidSwatches: [{ name: 'Jet Black', hex: '#111111' }, { name: 'Cool Gray', hex: '#8A9099' }, { name: 'Burgundy', hex: '#6D1A36' }],
    tipsKo: ['얼굴 가까이엔 아이보리·피치 같은 밝고 따뜻한 색을 두세요.', '블랙 대신 카멜·브라운 계열로 무게감을 주세요.', '액세서리는 골드 톤이 잘 어울려요.'],
    tipsEn: ['Keep bright, warm shades like ivory or peach near your face.', 'Swap black for camel or brown when you want depth.', 'Gold-tone accessories tend to suit you.'],
  },
  summer_cool: {
    undertone: 'cool', ko: '여름 쿨', en: 'Summer Cool',
    good: ['lavender', 'pink', 'mint', 'blue', 'navy', 'gray', 'white', 'silver', 'purple', 'denim blue'],
    avoid: ['orange', 'camel', 'gold', 'khaki', 'mocha brown', 'olive'],
    palette: [
      { name: 'Powder Blue', hex: '#B8D0EB' }, { name: 'Lavender', hex: '#C6B8E3' }, { name: 'Rose Pink', hex: '#E8A7BC' },
      { name: 'Soft White', hex: '#F4F5F8' }, { name: 'Mist Gray', hex: '#A9B0BC' }, { name: 'Dusty Navy', hex: '#4A5A80' },
    ],
    avoidSwatches: [{ name: 'Orange', hex: '#F28C28' }, { name: 'Camel', hex: '#C19A6B' }, { name: 'Olive', hex: '#6B6B2A' }],
    tipsKo: ['채도가 낮고 부드러운 파스텔·그레이 톤이 편안해 보여요.', '강한 오렌지·카키는 하의나 소품으로 멀리 두세요.', '액세서리는 실버 톤을 추천해요.'],
    tipsEn: ['Soft, muted pastels and grays look effortless on you.', 'Keep strong orange or khaki away from your face, e.g. on bottoms.', 'Silver-tone accessories are a safe choice.'],
  },
  autumn_warm: {
    undertone: 'warm', ko: '가을 웜', en: 'Autumn Warm',
    good: ['camel', 'brown', 'mocha brown', 'khaki', 'olive', 'beige', 'oatmeal', 'wine', 'burgundy', 'orange', 'gold', 'cream', 'wheat/tan', 'tan'],
    avoid: ['lavender', 'silver', 'mint', 'pink'],
    palette: [
      { name: 'Camel', hex: '#C19A6B' }, { name: 'Olive', hex: '#6F7339' }, { name: 'Terracotta', hex: '#C46A4A' },
      { name: 'Mocha', hex: '#7B5A44' }, { name: 'Mustard', hex: '#D4A73A' }, { name: 'Oatmeal', hex: '#E4D6BE' },
    ],
    avoidSwatches: [{ name: 'Icy Lavender', hex: '#D9D2F0' }, { name: 'Baby Pink', hex: '#F7C6D9' }, { name: 'Silver', hex: '#C0C4CC' }],
    tipsKo: ['카멜·올리브·브라운처럼 깊고 차분한 색이 잘 받아요.', '톤온톤(같은 계열 진하기 차이) 코디가 세련돼 보여요.', '골드·브론즈 소품으로 마무리해 보세요.'],
    tipsEn: ['Deep, earthy shades like camel, olive and brown suit you.', 'Tone-on-tone outfits in one warm family look polished.', 'Finish with gold or bronze accessories.'],
  },
  winter_cool: {
    undertone: 'cool', ko: '겨울 쿨', en: 'Winter Cool',
    good: ['black', 'white', 'navy', 'charcoal', 'red', 'wine', 'burgundy', 'blue', 'purple', 'silver', 'gray'],
    avoid: ['beige', 'camel', 'orange', 'oatmeal', 'khaki', 'mocha brown', 'cream'],
    palette: [
      { name: 'Pure White', hex: '#FFFFFF' }, { name: 'Black', hex: '#141414' }, { name: 'True Red', hex: '#C8102E' },
      { name: 'Royal Blue', hex: '#2A4BD7' }, { name: 'Fuchsia', hex: '#C2187A' }, { name: 'Charcoal', hex: '#3A3D42' },
    ],
    avoidSwatches: [{ name: 'Beige', hex: '#D8C3A5' }, { name: 'Camel', hex: '#C19A6B' }, { name: 'Muted Orange', hex: '#D98B4E' }],
    tipsKo: ['블랙·화이트처럼 선명한 대비가 또렷해 보여요.', '베이지·카멜은 얼굴에서 먼 하의·신발에 써보세요.', '실버·화이트골드 소품이 잘 어울려요.'],
    tipsEn: ['Crisp contrast like black and white makes you look sharp.', 'Use beige or camel away from your face, on bottoms or shoes.', 'Silver or white-gold accessories suit you.'],
  },
};

export const isSeason = (v: unknown): v is Season => typeof v === 'string' && (SEASONS as readonly string[]).includes(v);

export function seasonLabel(season: Season, lang: 'ko' | 'en'): string {
  return lang === 'en' ? SEASON_INFO[season].en : SEASON_INFO[season].ko;
}

/** Manual pick: reference palette for the chosen tone. Never marked as an AI analysis. */
export function buildManualPersonalColor(season: Season, lang: 'ko' | 'en', now = new Date()): PersonalColor {
  const info = SEASON_INFO[season];
  return {
    season,
    undertone: info.undertone,
    source: 'manual',
    palette: info.palette,
    avoid: info.avoidSwatches,
    tips: lang === 'en' ? info.tipsEn : info.tipsKo,
    updatedAt: now.toISOString(),
  };
}

// ---------- AI result validation ----------

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
// Attributes we never infer or repeat (ethnicity/race/health/age). Sentences containing them are dropped.
const FORBIDDEN_TEXT = /인종|민족|국적|혈통|건강|질환|질병|병색|피부병|나이|연령|ethnic|race|racial|nationality|ancestry|health|disease|illness|medical|age\b|years old/i;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || FORBIDDEN_TEXT.test(t)) return null;
  return t.slice(0, max);
};

const cleanSwatches = (v: unknown, max: number): Swatch[] =>
  (Array.isArray(v) ? v : [])
    .map((s) => ({ name: cleanText((s as Swatch)?.name, 40), hex: typeof (s as Swatch)?.hex === 'string' ? (s as Swatch).hex.trim() : '' }))
    .filter((s): s is Swatch => !!s.name && HEX_RE.test(s.hex))
    .slice(0, max);

export type AnalysisOutcome =
  | { kind: 'result'; result: PersonalColor }
  | { kind: 'retake'; reasons: RetakeReason[] }
  | { kind: 'invalid' };

/** Validates the model's JSON. Anything malformed is "invalid" — we never fill in a made-up result. */
export function validateAnalysis(raw: unknown, now = new Date()): AnalysisOutcome {
  if (!raw || typeof raw !== 'object') return { kind: 'invalid' };
  const r = raw as Record<string, unknown>;
  if (r.status === 'retake') {
    const reasons = (Array.isArray(r.retake_reasons) ? r.retake_reasons : [])
      .filter((x): x is RetakeReason => (RETAKE_REASONS as readonly string[]).includes(x as string));
    return { kind: 'retake', reasons: reasons.length ? [...new Set(reasons)] : ['blurry'] };
  }
  if (r.status !== 'ok' || !isSeason(r.season)) return { kind: 'invalid' };
  const palette = cleanSwatches(r.palette, 8);
  if (palette.length < 4) return { kind: 'invalid' };
  const tips = (Array.isArray(r.tips) ? r.tips : []).map((t) => cleanText(t, 160)).filter((t): t is string => !!t).slice(0, 4);
  if (tips.length === 0) return { kind: 'invalid' };
  const confidence: Confidence = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low';
  const iso = now.toISOString();
  return {
    kind: 'result',
    result: {
      season: r.season,
      undertone: SEASON_INFO[r.season].undertone, // always consistent with the season
      source: 'ai_photo',
      palette,
      avoid: cleanSwatches(r.avoid, 5),
      tips,
      summary: cleanText(r.summary, 280) ?? undefined,
      confidence,
      analyzedAt: iso,
      updatedAt: iso,
    },
  };
}

/** Reads a saved profile value; returns null for anything that does not look like a saved tone. */
export function parseSavedPersonalColor(v: unknown): PersonalColor | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (!isSeason(r.season) || (r.source !== 'ai_photo' && r.source !== 'manual')) return null;
  return {
    season: r.season,
    undertone: SEASON_INFO[r.season].undertone,
    source: r.source,
    palette: cleanSwatches(r.palette, 8),
    avoid: cleanSwatches(r.avoid, 5),
    tips: (Array.isArray(r.tips) ? r.tips : []).filter((t): t is string => typeof t === 'string').slice(0, 4),
    summary: typeof r.summary === 'string' ? r.summary : undefined,
    confidence: r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low' ? r.confidence : undefined,
    analyzedAt: typeof r.analyzedAt === 'string' ? r.analyzedAt : undefined,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date(0).toISOString(),
  };
}

// ---------- Recommendation ----------

export type PersonalColorMode = 'soft' | 'explicit_color' | 'photo_request';

/**
 * Explicit colors in the request and photo-based requests always win: in those cases the tone
 * is not used for scoring and the stylist is told to follow the request.
 */
export function personalColorMode(userRequest: string | null | undefined, hasPhotoAnalysis: boolean): PersonalColorMode {
  if (hasPhotoAnalysis) return 'photo_request';
  if (parseColorsFromString(userRequest).length > 0) return 'explicit_color';
  return 'soft';
}

export const PERSONAL_COLOR_GOOD_BONUS = 0.08;
export const PERSONAL_COLOR_AVOID_PENALTY = -0.05;

/** Soft score from the product's real color metadata only. Unknown colors → 0 (no change). */
export function personalColorBonus(product: ColorProduct, season: Season | null, mode: PersonalColorMode): number {
  if (!season || mode !== 'soft') return 0;
  const colors = resolveItemColors(product);
  if (colors.length === 0) return 0;
  const info = SEASON_INFO[season];
  if (colors.some((c) => info.good.includes(c))) return PERSONAL_COLOR_GOOD_BONUS;
  if (colors.some((c) => info.avoid.includes(c))) return PERSONAL_COLOR_AVOID_PENALTY;
  return 0;
}

export function buildPersonalColorPromptBlock(season: Season, mode: PersonalColorMode): string {
  const info = SEASON_INFO[season];
  if (mode !== 'soft') {
    return `\n[퍼스널 컬러 참고] 사용자 톤: ${info.ko}. 사용자가 색상/사진을 직접 지정했으므로 요청한 색을 그대로 따르고 톤 때문에 바꾸지 마세요.`;
  }
  return `\n[퍼스널 컬러 참고 - 약한 가중치] 사용자 톤: ${info.ko}(${info.undertone === 'warm' ? '웜' : '쿨'}). 얼굴 가까운 상의·아우터는 ${info.good.slice(0, 6).join(', ')} 계열 상품을 우선 고려하되, 스타일·TPO·예산이 먼저입니다. 상품의 실제 색을 바꾸거나 없는 색을 말하지 말고, 적용했다면 이유를 한 문장으로 설명하세요.`;
}
