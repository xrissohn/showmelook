import { useEffect } from "react";

const EVENT = "adsense:content-ready";

/**
 * 페이지에 실제 게시자 콘텐츠가 렌더된 뒤에만 광고 스크립트를 허용한다.
 * ready 가 false 이면 광고 스크립트는 주입되지 않는다.
 */
export function useAdsContentReady(ready: boolean) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { ready } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent(EVENT, { detail: { ready: false } }),
      );
    };
  }, [ready]);
}

export const ADS_CONTENT_READY_EVENT = EVENT;
