import { useEffect } from 'react';

interface UseImagePreloaderOptions {
  urls: (string | null | undefined)[];
  enabled?: boolean;
}

/**
 * 이미지 URL들을 미리 로드하여 캐시에 저장
 * 다음 화면에 표시될 이미지들을 미리 로드할 때 사용
 */
export function useImagePreloader({ urls, enabled = true }: UseImagePreloaderOptions) {
  useEffect(() => {
    if (!enabled) return;

    const validUrls = urls.filter((url): url is string => 
      !!url && (url.startsWith('http') || url.startsWith('data:'))
    );

    if (validUrls.length === 0) return;

    // 이미지 프리로드
    const imageElements: HTMLImageElement[] = [];

    validUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      imageElements.push(img);
    });

    // Cleanup: 컴포넌트 언마운트 시 참조 해제
    return () => {
      imageElements.forEach((img) => {
        img.src = '';
      });
    };
  }, [urls.join(','), enabled]);
}

/**
 * 단일 이미지 프리로드 함수 (비동기)
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 여러 이미지 프리로드 함수 (병렬)
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(urls.map(preloadImage));
}
