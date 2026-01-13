import { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';

interface LazyImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  placeholderClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  placeholderClassName = '',
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin: '100px', // 100px 전에 미리 로드 시작
        threshold: 0.01,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
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

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* 스켈레톤 플레이스홀더 */}
      {!isLoaded && (
        <Skeleton className={`absolute inset-0 ${placeholderClassName}`} />
      )}
      
      {/* 실제 이미지 - InView일 때만 로드 */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
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
