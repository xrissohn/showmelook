import type { GuideArticle } from "./types";
import { bodyTypeGuide } from "./body-type-coordination";
import { personalColorGuide } from "./personal-color-outfit";
import { minimalLookGuide } from "./minimal-look-principles";
import { layeringGuide } from "./seasonal-layering";
import { tpoGuide } from "./date-office-casual-look";
import { proportionGuide } from "./proportion-styling";
import { virtualFittingGuide } from "./ai-virtual-fitting-tips";
import { sizeGuide } from "./size-selection-guide";

export type { GuideArticle, GuideSection } from "./types";

export const GUIDES: GuideArticle[] = [
  bodyTypeGuide,
  personalColorGuide,
  minimalLookGuide,
  layeringGuide,
  tpoGuide,
  proportionGuide,
  virtualFittingGuide,
  sizeGuide,
];

export const getGuideBySlug = (slug?: string): GuideArticle | undefined =>
  GUIDES.find((g) => g.slug === slug);

export const getRelatedGuides = (slug: string, count = 3): GuideArticle[] =>
  GUIDES.filter((g) => g.slug !== slug).slice(0, count);
