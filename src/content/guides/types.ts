export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface GuideArticle {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  keywords: string;
  category: string;
  readingMinutes: number;
  updated: string; // YYYY-MM-DD
  intro: string;
  sections: GuideSection[];
  checklist: string[];
  outro: string;
  hashtags: string[];
  /** 쇼미가 제안하는 룩 프롬프트 (스타일 만들기에 자동 입력) */
  lookPrompts?: { label: string; prompt: string }[];
}
