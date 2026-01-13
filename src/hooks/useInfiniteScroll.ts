import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
  items: T[];
  initialCount?: number;
  increment?: number;
  preloadCount?: number;
}

interface UseInfiniteScrollReturn<T> {
  visibleItems: T[];
  loadMoreRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  preloadItems: T[]; // 다음에 로드될 아이템들 (프리로딩용)
}

export function useInfiniteScroll<T>({
  items,
  initialCount = 12,
  increment = 8,
  preloadCount = 4,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [displayCount, setDisplayCount] = useState(initialCount);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const visibleItems = items.slice(0, displayCount);
  const hasMore = displayCount < items.length;
  
  // 프리로딩할 아이템들 (현재 표시된 것 다음 preloadCount개)
  const preloadItems = items.slice(displayCount, displayCount + preloadCount);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + increment, items.length));
  }, [increment, items.length]);

  const reset = useCallback(() => {
    setDisplayCount(initialCount);
  }, [initialCount]);

  // items가 변경되면 초기화 (새 데이터 로드 시)
  useEffect(() => {
    // items 배열이 완전히 새로 로드된 경우에만 리셋
    // 길이가 현재 displayCount보다 작으면 리셋
    if (items.length < displayCount) {
      setDisplayCount(Math.min(initialCount, items.length));
    }
  }, [items.length, initialCount]);

  // Intersection Observer로 자동 로드
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin: '200px', // 200px 전에 미리 로드 시작
        threshold: 0.1,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasMore, loadMore]);

  return {
    visibleItems,
    loadMoreRef,
    hasMore,
    loadMore,
    reset,
    preloadItems,
  };
}
