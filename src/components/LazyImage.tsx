import { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';
import { thumbUrl } from '@/lib/imageUrl';

interface LazyImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  placeholderClassName?: string;
  /** 카드처럼 작게 보이는 곳에서 서버가 줄여 주는 썸네일 너비(px). 줄이기에 실패하면 원본으로 되돌아간다. */
  width?: number;
  /** 첫 화면에 보이는 이미지: 스크롤을 기다리지 않고 바로 불러온다. */
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const MAX_RETRIES = 2;

export function LazyImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  placeholderClassName = '',
  width,
  priority = false,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  // 0: 썸네일(있을 때) → 원본 → 원본 다시 시도(최대 MAX_RETRIES번)
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLDivElement>(null);
  const thumb = width ? thumbUrl(src, width) : src;
  const hasThumb = !!thumb && thumb !== src;

  // 주소가 바뀌면 처음부터
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setAttempt(0);
  }, [src, width]);

  useEffect(() => {
    if (isInView) return;
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '300px', // 화면에 닿기 전에 미리 불러오기 시작
        threshold: 0.01,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isInView, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    const sources = hasThumb ? 1 : 0; // 썸네일 시도 횟수
    if (attempt < sources + MAX_RETRIES) {
      // 썸네일이 안 되면 곧바로 원본, 원본이 일시적으로 실패하면 잠깐 쉬었다가 다시
      const next = attempt + 1;
      const delay = next <= sources ? 0 : 700 * (next - sources);
      window.setTimeout(() => setAttempt(next), delay);
      return;
    }
    setHasError(true);
    onError?.();
  };

  if (!src || hasError) {
    return (
      <div
        ref={imgRef}
        className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground/50" />
      </div>
    );
  }

  const current = hasThumb && attempt === 0 ? (thumb as string) : src;

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* 스켈레톤 플레이스홀더 */}
      {!isLoaded && (
        <Skeleton className={`absolute inset-0 ${placeholderClassName}`} />
      )}

      {/* 실제 이미지 - InView일 때만 로드 */}
      {isInView && (
        <img
          key={attempt}
          src={current}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
          decoding="async"
          {...({ fetchpriority: priority ? 'high' : undefined } as Record<string, string | undefined>)}
        />
      )}
    </div>
  );
}

// 갤러리용 최적화된 레이지 이미지 (그리드에서 사용)
export function LazyGalleryImage({
  src,
  alt,
  className = '',
  aspectRatio = 'square',
  onClick,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape';
  onClick?: () => void;
}) {
  const aspectClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]',
  };

  return (
    <div 
      className={`${aspectClasses[aspectRatio]} overflow-hidden rounded-lg bg-muted cursor-pointer ${className}`}
      onClick={onClick}
    >
      <LazyImage
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        fallbackClassName="w-full h-full"
      />
    </div>
  );
}
