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
}
