/**
 * SEOHead Component
 * Reusable component for setting page-specific meta tags using react-helmet-async
 */

import { Helmet } from 'react-helmet-async';
import { PageSEO, getPageSEO } from '@/lib/seoConfig';

interface SEOHeadProps {
  pageKey?: string;
  custom?: Partial<PageSEO>;
  /** Optional JSON-LD structured data injected into <head> */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SEOHead = ({ pageKey, custom, jsonLd }: SEOHeadProps) => {
  const baseSEO = pageKey ? getPageSEO(pageKey) : {};
  const seo = { ...baseSEO, ...custom };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seo.title}</title>
      {seo.description && <meta name="description" content={seo.description} />}
      {seo.keywords && <meta name="keywords" content={seo.keywords} />}
      {seo.canonical && <link rel="canonical" href={seo.canonical} />}
      {seo.noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook / KakaoTalk */}
      {seo.title && <meta property="og:title" content={seo.title} />}
      {seo.description && <meta property="og:description" content={seo.description} />}
      {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
      {seo.canonical && <meta property="og:url" content={seo.canonical} />}

      {/* Twitter */}
      {seo.title && <meta name="twitter:title" content={seo.title} />}
      {seo.description && <meta name="twitter:description" content={seo.description} />}
      {seo.ogImage && <meta name="twitter:image" content={seo.ogImage} />}
    </Helmet>
  );
};
