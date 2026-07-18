import { useEffect } from "react";
import { useLocation, matchPath } from "react-router-dom";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1397045307383138";
const SCRIPT_ID = "adsense-loader-script";

// Only load AdSense on pages with substantive publisher content.
const ALLOWED_PATTERNS = [
  "/",
  "/community",
  "/look/:lookId",
  "/gallery/:userId",
  "/pricing",
  "/pitch",
  "/promo",
  "/install",
  "/privacy",
  "/terms",
];

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) =>
    matchPath({ path: pattern, end: true }, pathname),
  );
}

const AdSenseLoader = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const allowed = isAllowedPath(pathname);
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
  }, [pathname]);

  return null;
};

export default AdSenseLoader;
