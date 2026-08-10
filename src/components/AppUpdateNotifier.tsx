import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Detects a new deployment (updated service worker or new index.html build)
 * and asks the user to switch to the latest content.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const showUpdateToast = (onConfirm: () => void) => {
  toast("새로운 버전이 준비되었어요", {
    id: "app-update",
    description: "최신 콘텐츠로 새로고침할까요?",
    duration: Infinity,
    action: {
      label: "업데이트",
      onClick: onConfirm,
    },
  });
};

const readBuildSignature = (html: string) => {
  const matches = html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g);
  return matches ? matches.sort().join("|") : null;
};

const AppUpdateNotifier = () => {
  const notified = useRef(false);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const reload = () => {
      notified.current = true;
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => undefined)
          .finally(() => window.location.reload());
      } else {
        location.reload();
      }
    };

    const notify = () => {
      if (notified.current) return;
      notified.current = true;
      showUpdateToast(reload);
    };

    // Build signature polling works without a service worker.
    const checkBuild = async () => {
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const signature = readBuildSignature(await res.text());
        if (!signature) return;
        if (baseline.current === null) {
          baseline.current = signature;
          return;
        }
        if (signature !== baseline.current) notify();
      } catch {
        /* offline or blocked — ignore */
      }
    };

    checkBuild();
    const interval = window.setInterval(checkBuild, CHECK_INTERVAL_MS);
    const onFocus = () => checkBuild();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
};

export default AppUpdateNotifier;
