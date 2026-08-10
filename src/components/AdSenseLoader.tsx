import { useEffect, useState } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { ADS_CONTENT_READY_EVENT } from "@/hooks/useAdsContentReady";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1397045307383138";
const SCRIPT_ID = "adsense-loader-script";

// Only load AdSense on pages with substantive publisher content.
// `requiresContent`: 페이지가 실제 콘텐츠 렌더를 알린 뒤에만 로드.
const ALLOWED_ROUTES: { path: string; requiresContent: boolean }[] = [
  { path: "/", requiresContent: false },
  { path: "/guide", requiresContent: true },
  { path: "/guide/:slug", requiresContent: true },
  { path: "/community", requiresContent: true },
  { path: "/look/:lookId", requiresContent: true },
  { path: "/gallery/:userId", requiresContent: true },
];

function matchRoute(pathname: string) {
  return ALLOWED_ROUTES.find((route) =>
    matchPath({ path: route.path, end: true }, pathname),
  );
}

const AdSenseLoader = () => {
  const { pathname } = useLocation();
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    setContentReady(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ready: boolean }>).detail;
      setContentReady(Boolean(detail?.ready));
    };
    window.addEventListener(ADS_CONTENT_READY_EVENT, handler);
    return () => window.removeEventListener(ADS_CONTENT_READY_EVENT, handler);
  }, []);

  useEffect(() => {
    const route = matchRoute(pathname);
    const allowed = Boolean(route) && (!route!.requiresContent || contentReady);
    const existing = document.getElementById(SCRIPT_ID);

    if (allowed && !existing) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = ADSENSE_SRC;
      document.head.appendChild(script);
    } else if (!allowed && existing) {
      existing.remove();
    }
  }, [pathname, contentReady]);

  return null;
};

export default AdSenseLoader;
