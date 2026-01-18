import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useGenerationLimit } from '@/hooks/useGenerationLimit';
import { useFeedback } from '@/hooks/useFeedback';
import { ShoppingBag, Heart, LogOut, ChevronRight, Loader2, User, Camera, Check, Zap, Crown, Settings, Sparkles, ExternalLink, Plus, ChevronLeft, Tag, RefreshCw, X, ImageOff, Download, Share2, Trash2, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import showmelookLogo from '@/assets/showmelook-logo.png';
import showmelookWatermarkFull from '@/assets/showmelook-watermark-full.png';
import MainNavigation from '@/components/MainNavigation';
import useEmblaCarousel from 'embla-carousel-react';
import { LazyImage } from '@/components/LazyImage';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
interface StyleTrend {
  id: string;
  name: string;
  name_ko: string;
  description: string | null;
  image_url: string | null;
  tags: string[] | null;
}

interface Product {
  id: string;
  name: string;
  name_ko: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  brand: string | null;
  external_url: string | null;
  tags: string[] | null;
}

// 캐시된 상품 (products_cache 테이블에서 가져온 상품)
interface CachedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  original_price?: number | null;
  image_url: string | null;
  product_url: string;
  category: string;
  style_tags: string[] | null;
  affiliate_url?: string;
  isAutoSelected?: boolean;
}

interface GeneratedLook {
  id: string;
  image_url: string;
  is_favorite: boolean;
  created_at: string;
  memo?: string | null;
  tags?: string[] | null;
  prompt_used?: string | null;
  style_trend_id?: string | null;
  product_ids?: string[] | null;
}

interface UserProfile {
  height: number | null;
  weight: number | null;
  body_type: string | null;
  style_preferences: string[] | null;
  avatar_url: string | null;
  full_name: string | null;
  gender: string | null;
}

const styleOptions = [
  { id: 'minimal', label: '미니멀', emoji: '🤍' },
  { id: 'street', label: '스트릿', emoji: '🔥' },
  { id: 'classic', label: '클래식', emoji: '👔' },
  { id: 'casual', label: '캐주얼', emoji: '👕' },
  { id: 'sporty', label: '스포티', emoji: '⚡' },
  { id: 'bohemian', label: '보헤미안', emoji: '🌸' },
];

const bodyTypes = [
  { id: 'slim', label: '마른 체형' },
  { id: 'average', label: '보통 체형' },
  { id: 'muscular', label: '근육질' },
  { id: 'curvy', label: '볼륨 체형' },
];

// 이미지 스켈레톤 로딩 컴포넌트 with Progressive Loading (블러 -> 선명)
const ProductImage = ({ src, alt, className, rounded }: { src: string; alt: string; className?: string; rounded?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative w-full h-full overflow-hidden ${rounded || ''}`}>
      {/* 스켈레톤 로딩 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary overflow-hidden z-10">
          <div className="absolute inset-0 animate-shimmer" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted-foreground/10 animate-pulse" />
            <div className="space-y-2 w-2/3">
              <div className="h-3 bg-muted-foreground/10 rounded-full animate-pulse" />
              <div className="h-3 bg-muted-foreground/10 rounded-full w-1/2 mx-auto animate-pulse" />
            </div>
          </div>
        </div>
      )}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-muted">
          <ImageOff className="w-12 h-12 text-muted-foreground/30 mb-2" />
          <span className="text-xs text-muted-foreground">이미지를 불러올 수 없습니다</span>
        </div>
      ) : (
        <img 
          src={src} 
          alt={alt}
          className={`${className} transition-all duration-700 ease-out ${
            isLoading 
              ? 'blur-xl scale-110 opacity-0' 
              : 'blur-0 scale-100 opacity-100'
          }`}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}
    </div>
  );
};

// 프로필/갤러리용 이미지 컴포넌트 (원형 지원)
const ProgressiveImage = ({ 
  src, 
  alt, 
  className,
  fallback
}: { 
  src: string; 
  alt: string; 
  className?: string;
  fallback?: React.ReactNode;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative w-full h-full">
      {/* 스켈레톤 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary overflow-hidden z-10">
          <div className="absolute inset-0 animate-shimmer" />
        </div>
      )}
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
          <ImageOff className="w-8 h-8 text-muted-foreground/30" />
        </div>
      ) : (
        <img 
          src={src} 
          alt={alt}
          className={`${className} transition-all duration-700 ease-out ${
            isLoading 
              ? 'blur-lg scale-105 opacity-0' 
              : 'blur-0 scale-100 opacity-100'
          }`}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}
    </div>
  );
};

// 파티클 컴포넌트
const CelebrationParticles = ({ show }: { show: boolean }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; delay: number }>>([]);
  
  useEffect(() => {
    if (show) {
      const colors = ['#f472b6', '#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444'];
      const newParticles = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
      
      // 파티클 제거
      const timer = setTimeout(() => setParticles([]), 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

// 이미지에 워터마크 추가 함수 (중앙, 통합 로고 + URL만)
const addWatermarkToImage = async (imageUrl: string, logoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 원본 이미지 그리기
      ctx.drawImage(img, 0, 0);
      
      // 새 통합 워터마크 로고 로드
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      
      logo.onload = () => {
        // 워터마크 크기 계산 (이미지 너비의 45% - 1.5배 증가)
        const watermarkWidth = img.width * 0.45;
        const watermarkHeight = (logo.height / logo.width) * watermarkWidth;
        
        // URL 폰트 크기 (크게)
        const urlFontSize = Math.max(20, img.width * 0.035);
        
        // 로고 중앙보다 위에 위치 (10% 위로)
        const logoStartY = (img.height - watermarkHeight) / 2 - img.height * 0.10;
        const logoX = (img.width - watermarkWidth) / 2;
        
        // 메인 로고 그리기 (투명도 0.5)
        ctx.globalAlpha = 0.5;
        ctx.drawImage(logo, logoX, logoStartY, watermarkWidth, watermarkHeight);
        ctx.globalAlpha = 1.0;
        
        // URL 추가 (사진 맨 아래)
        ctx.font = `bold ${urlFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('showmelook.com', img.width / 2, img.height - 20);
        
        // Blob으로 변환
        canvas.toBlob((blob) => {
          if (blob) {
            const watermarkedUrl = URL.createObjectURL(blob);
            resolve(watermarkedUrl);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/png', 1.0);
      };
      
      logo.onerror = () => {
        // 로고 로드 실패 시 텍스트 워터마크만 추가 (중앙, 더 크고 여리게)
        const fontSize = Math.max(24, img.width * 0.05);
        const urlFontSize = Math.max(14, img.width * 0.025);
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        // 텍스트 배경 (중앙)
        const text = 'ShowMeLook';
        const urlText = 'showmelook.com';
        const textWidth = ctx.measureText(text).width;
        const padding = 20;
        const totalHeight = fontSize + urlFontSize + padding * 2 + 8;
        const rectX = (img.width - textWidth - padding * 2) / 2;
        const rectY = (img.height - totalHeight) / 2;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, textWidth + padding * 2, totalHeight, 12);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, img.width / 2, img.height / 2 - urlFontSize / 2);
        
        // URL 추가
        ctx.font = `${urlFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillText(urlText, img.width / 2, img.height / 2 + fontSize / 2 + 4);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const watermarkedUrl = URL.createObjectURL(blob);
            resolve(watermarkedUrl);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/png', 1.0);
      };
      
      logo.src = logoUrl;
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

// 이미지 저장 함수
const downloadImage = async (
  imageUrl: string, 
  fileName: string = 'showmelook-style.png',
  addWatermark: boolean = false,
  logoUrl?: string
) => {
  try {
    let urlToDownload = imageUrl;
    
    // 워터마크 추가 (비프리미엄 사용자)
    if (addWatermark && logoUrl) {
      try {
        urlToDownload = await addWatermarkToImage(imageUrl, logoUrl);
      } catch (error) {
        console.error('Watermark failed, downloading original:', error);
        // 워터마크 실패 시 원본 다운로드
      }
    }
    
    const response = await fetch(urlToDownload);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // 워터마크 URL 정리
    if (addWatermark && urlToDownload !== imageUrl) {
      URL.revokeObjectURL(urlToDownload);
    }
    
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
};

// SNS 공유 함수
const shareToSNS = async (
  imageUrl: string, 
  platform: 'instagram' | 'twitter' | 'facebook' | 'kakao' | 'copy',
  addWatermark: boolean = false,
  logoUrl?: string
) => {
  const shareText = '👗 ShowMeLook AI가 만든 나만의 스타일을 확인해보세요! #ShowMeLook #AI패션 #스타일추천';
  const shareUrl = window.location.origin;

  switch (platform) {
    case 'instagram':
      // Instagram은 직접 공유가 불가능하므로 이미지 저장 후 안내
      const downloaded = await downloadImage(
        imageUrl, 
        'showmelook-style-instagram.png',
        addWatermark,
        logoUrl
      );
      if (downloaded) {
        // 모바일 확인
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.open('instagram://library?AssetPath=', '_blank');
        }
        return { success: true, message: '이미지가 저장되었습니다. Instagram 앱에서 업로드해주세요.' };
      }
      return { success: false, message: '이미지 저장에 실패했습니다.' };

    case 'twitter':
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
        '_blank',
        'width=600,height=400'
      );
      return { success: true };

    case 'facebook':
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
        '_blank',
        'width=600,height=400'
      );
      return { success: true };

    case 'kakao':
      // 카카오톡 공유 (SDK 없이 기본 링크 공유)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'ShowMeLook AI 스타일',
            text: shareText,
            url: shareUrl,
          });
          return { success: true };
        } catch (err) {
          // 사용자가 취소한 경우
          return { success: false };
        }
      }
      // 카카오톡 링크로 이동
      window.open(`https://story.kakao.com/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
      return { success: true };

    case 'copy':
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        return { success: true, message: '링크가 복사되었습니다!' };
      } catch (err) {
        return { success: false, message: '복사에 실패했습니다.' };
      }

    default:
      return { success: false };
  }
};

// 공유 버튼 컴포넌트
const ShareButtons = ({ 
  imageUrl, 
  onShare, 
  className = '',
  compact = false,
  isPremium = false,
  logoUrl
}: { 
  imageUrl: string; 
  onShare?: (platform: string, result: { success: boolean; message?: string }) => void;
  className?: string;
  compact?: boolean;
  isPremium?: boolean;
  logoUrl?: string;
}) => {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 비프리미엄 사용자는 워터마크 추가
  const shouldAddWatermark = !isPremium;

  const handleDownload = async () => {
    setIsDownloading(true);
    const success = await downloadImage(
      imageUrl, 
      `showmelook-style-${Date.now()}.png`,
      shouldAddWatermark,
      logoUrl
    );
    setIsDownloading(false);
    const message = success 
      ? isPremium 
        ? '이미지가 저장되었습니다!' 
        : '이미지가 저장되었습니다! (워터마크 포함)'
      : '저장에 실패했습니다.';
    onShare?.('download', { success, message });
  };

  const handleShare = async (platform: 'instagram' | 'twitter' | 'facebook' | 'kakao' | 'copy') => {
    const result = await shareToSNS(imageUrl, platform, shouldAddWatermark, logoUrl);
    setIsShareOpen(false);
    onShare?.(platform, result);
  };

  if (compact) {
    return (
      <div className={`flex gap-2 ${className}`}>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
          title={isPremium ? '이미지 저장' : '이미지 저장 (워터마크 포함)'}
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin text-foreground" />
          ) : (
            <Download className="w-5 h-5 text-foreground" />
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => setIsShareOpen(!isShareOpen)}
            className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
            title="공유하기"
          >
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
          {isShareOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsShareOpen(false)} />
              <div className="absolute right-0 top-12 z-50 bg-background rounded-xl border border-border shadow-xl p-2 min-w-[160px] animate-in slide-in-from-top-2 fade-in duration-200">
                {!isPremium && (
                  <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                    <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      프리미엄 회원은 워터마크 없이 저장
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleShare('instagram')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <span className="text-lg">📸</span>
                  <span className="text-sm font-korean text-foreground">Instagram</span>
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <span className="text-lg">🐦</span>
                  <span className="text-sm font-korean text-foreground">Twitter</span>
                </button>
                <button
                  onClick={() => handleShare('facebook')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <span className="text-lg">📘</span>
                  <span className="text-sm font-korean text-foreground">Facebook</span>
                </button>
                <button
                  onClick={() => handleShare('kakao')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <span className="text-lg">💬</span>
                  <span className="text-sm font-korean text-foreground">카카오톡</span>
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => handleShare('copy')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <span className="text-lg">🔗</span>
                  <span className="text-sm font-korean text-foreground">링크 복사</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        className="font-korean"
        title={isPremium ? '이미지 저장' : '이미지 저장 (워터마크 포함)'}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <Download className="w-4 h-4 mr-1.5" />
        )}
        저장{!isPremium && ' 🏷️'}
      </Button>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsShareOpen(!isShareOpen)}
          className="font-korean"
        >
          <Share2 className="w-4 h-4 mr-1.5" />
          공유
        </Button>
        {isShareOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsShareOpen(false)} />
            <div className="absolute right-0 top-10 z-50 bg-background rounded-xl border border-border shadow-xl p-2 min-w-[160px] animate-in slide-in-from-top-2 fade-in duration-200">
              {!isPremium && (
                <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    프리미엄 회원은 워터마크 없이 저장
                  </p>
                </div>
              )}
              <button
                onClick={() => handleShare('instagram')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className="text-lg">📸</span>
                <span className="text-sm font-korean text-foreground">Instagram</span>
              </button>
              <button
                onClick={() => handleShare('twitter')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className="text-lg">🐦</span>
                <span className="text-sm font-korean text-foreground">Twitter</span>
              </button>
              <button
                onClick={() => handleShare('facebook')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className="text-lg">📘</span>
                <span className="text-sm font-korean text-foreground">Facebook</span>
              </button>
              <button
                onClick={() => handleShare('kakao')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className="text-lg">💬</span>
                <span className="text-sm font-korean text-foreground">카카오톡</span>
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => handleShare('copy')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className="text-lg">🔗</span>
                <span className="text-sm font-korean text-foreground">링크 복사</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 메인 생성 이미지용 컴포넌트 (로고 워터마크 + 퍼센트 로딩 + 파티클)
const GeneratedStyleImage = ({ 
  src, 
  alt,
  logoSrc,
  onShare,
  isPremium = false
}: { 
  src: string; 
  alt: string;
  logoSrc: string;
  onShare?: (platform: string, result: { success: boolean; message?: string }) => void;
  isPremium?: boolean;
}) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!src) return;
    
    setIsLoading(true);
    setLoadingProgress(0);
    setHasError(false);
    setShowCelebration(false);
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'blob';
    
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setLoadingProgress(percent);
      } else {
        // 진행률을 알 수 없는 경우 시뮬레이션
        setLoadingProgress((prev) => Math.min(prev + 5, 90));
      }
    };
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setLoadingProgress(100);
        
        // 이미지 완전 로드 후 파티클 효과
        setTimeout(() => {
          setIsLoading(false);
          setShowCelebration(true);
        }, 300);
      } else {
        setHasError(true);
        setIsLoading(false);
      }
    };
    
    xhr.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    
    xhr.send();
    
    return () => {
      xhr.abort();
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [src]);

  return (
    <div className="relative w-full h-full overflow-hidden group">
      {/* 축하 파티클 */}
      <CelebrationParticles show={showCelebration} />
      
      {/* 로딩 중 브랜드 표시 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-muted overflow-hidden z-10 flex flex-col items-center justify-center">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 animate-shimmer" />
          </div>
          
          {/* 로고 및 진행률 */}
          <div className="relative z-20 flex flex-col items-center gap-5">
            {/* 로고 with 원형 프로그레스 */}
            <div className="relative">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - loadingProgress / 100)}`}
                  className="transition-all duration-300 ease-out"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(10 85% 65%)" />
                    <stop offset="50%" stopColor="hsl(280 70% 55%)" />
                    <stop offset="100%" stopColor="hsl(200 85% 55%)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-white/90 dark:bg-black/60 backdrop-blur-sm shadow-xl flex items-center justify-center">
                  <img 
                    src={logoSrc} 
                    alt="ShowMeLook" 
                    className="w-12 h-12 object-contain"
                  />
                </div>
              </div>
            </div>
            
            {/* 퍼센트 표시 */}
            <div className="text-center">
              <p className="text-3xl font-bold bg-gradient-to-r from-accent via-primary to-sky-500 bg-clip-text text-transparent">
                {loadingProgress}%
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-korean">스타일 이미지 로딩 중...</p>
            </div>
            
            {/* 하단 로딩 바 */}
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent via-primary to-sky-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-muted">
          <ImageOff className="w-16 h-16 text-muted-foreground/30 mb-3" />
          <span className="text-sm text-muted-foreground font-korean">이미지를 불러올 수 없습니다</span>
        </div>
      ) : imageUrl && (
        <>
          <img 
            src={imageUrl} 
            alt={alt}
            className={`w-full h-full object-cover transition-all duration-1000 ease-out ${
              isLoading 
                ? 'blur-2xl scale-110 opacity-0' 
                : 'blur-0 scale-100 opacity-100'
            }`}
          />
          {/* 저장/공유 버튼 오버레이 */}
          {!isLoading && (
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <ShareButtons imageUrl={src} onShare={onShare} compact isPremium={isPremium} logoUrl={logoSrc} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// 내 룩 갤러리 컴포넌트 (무한 스크롤 + 이미지 프리로딩)
interface MyLooksGalleryProps {
  myLooks: GeneratedLook[];
  setMyLooks: React.Dispatch<React.SetStateAction<GeneratedLook[]>>;
  setActiveTab: (tab: 'generate' | 'mylooks' | 'mypage') => void;
  toast: ReturnType<typeof useToast>['toast'];
  isPremium: boolean;
}

const MyLooksGallery = ({ myLooks, setMyLooks, setActiveTab, toast, isPremium }: MyLooksGalleryProps) => {
  // 필터 상태
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // 상세 보기 모달 상태
  const [selectedLook, setSelectedLook] = useState<GeneratedLook | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 삭제 확인 모달 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 다중 선택 모드 상태
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // 메모/태그 편집 상태
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [editMemo, setEditMemo] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  
  // 스와이프 제스처 상태
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;
  
  // 사전 정의된 태그 옵션
  const tagOptions = ['데일리', '특별한 날', '데이트', '출근룩', '주말', '파티', '여행', '계절감'];
  
  // 필터링된 아이템
  const filteredLooks = showFavoritesOnly 
    ? myLooks.filter(look => look.is_favorite) 
    : myLooks;
  
  const favoriteCount = myLooks.filter(look => look.is_favorite).length;
  
  // 무한 스크롤 훅 (처음 12개, 스크롤 시 8개씩 추가)
  const {
    visibleItems,
    loadMoreRef,
    hasMore,
    preloadItems,
  } = useInfiniteScroll({
    items: filteredLooks,
    initialCount: 12,
    increment: 8,
    preloadCount: 4,
  });

  // 다음에 로드될 이미지들 프리로딩
  useImagePreloader({
    urls: preloadItems.map(look => look.image_url),
    enabled: preloadItems.length > 0,
  });
  
  // 다중 선택 토글
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLooks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLooks.map(l => l.id)));
    }
  };
  
  // 선택 모드 종료
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };
  
  // 다중 삭제 핸들러
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const looksToDelete = myLooks.filter(l => selectedIds.has(l.id));
      
      // 스토리지에서 이미지 삭제
      const pathsToDelete = looksToDelete
        .filter(l => l.image_url && !l.image_url.startsWith('http') && !l.image_url.startsWith('data:'))
        .map(l => l.image_url);
      
      if (pathsToDelete.length > 0) {
        await supabase.storage.from('generated-looks').remove(pathsToDelete);
      }
      
      // DB에서 삭제
      const { error } = await supabase
        .from('generated_looks')
        .delete()
        .in('id', idsToDelete);
      
      if (error) throw error;
      
      // 로컬 상태 업데이트
      setMyLooks(prev => prev.filter(l => !selectedIds.has(l.id)));
      
      toast({
        title: '삭제 완료',
        description: `${idsToDelete.length}개의 룩이 삭제되었습니다.`,
      });
      
      setShowBulkDeleteConfirm(false);
      exitSelectMode();
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast({
        title: '삭제 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 메모/태그 편집 시작
  const startEditingMemo = () => {
    if (!selectedLook) return;
    setEditMemo(selectedLook.memo || '');
    setEditTags(selectedLook.tags || []);
    setIsEditingMemo(true);
  };
  
  // 태그 추가
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !editTags.includes(trimmedTag)) {
      setEditTags([...editTags, trimmedTag]);
    }
    setNewTag('');
  };
  
  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };
  
  // 메모/태그 저장
  const saveMemoAndTags = async () => {
    if (!selectedLook) return;
    
    setIsSavingMemo(true);
    try {
      const { error } = await supabase
        .from('generated_looks')
        .update({ 
          memo: editMemo.trim() || null, 
          tags: editTags.length > 0 ? editTags : null 
        })
        .eq('id', selectedLook.id);
      
      if (error) throw error;
      
      // 로컬 상태 업데이트
      const updatedLook = { ...selectedLook, memo: editMemo.trim() || null, tags: editTags.length > 0 ? editTags : null };
      setMyLooks(prev => prev.map(l => l.id === selectedLook.id ? updatedLook : l));
      setSelectedLook(updatedLook);
      
      toast({
        title: '저장 완료',
        description: '메모와 태그가 저장되었습니다.',
      });
      
      setIsEditingMemo(false);
    } catch (error: any) {
      console.error('Save memo error:', error);
      toast({
        title: '저장 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingMemo(false);
    }
  };
  
  // 모달에서 이전/다음 이동
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedLook(filteredLooks[currentIndex - 1]);
      setIsEditingMemo(false);
    }
  }, [currentIndex, filteredLooks]);
  
  const goToNext = useCallback(() => {
    if (currentIndex < filteredLooks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedLook(filteredLooks[currentIndex + 1]);
      setIsEditingMemo(false);
    }
  }, [currentIndex, filteredLooks]);
  
  // 터치 이벤트 핸들러
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  // 키보드 네비게이션
  useEffect(() => {
    if (!selectedLook) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingMemo) return; // 편집 중일 때는 키보드 네비게이션 비활성화
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') {
        if (isEditingMemo) {
          setIsEditingMemo(false);
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          setSelectedLook(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLook, currentIndex, filteredLooks.length, showDeleteConfirm, isEditingMemo, goToPrevious, goToNext]);
  
  // 룩 클릭 핸들러
  const handleLookClick = (look: GeneratedLook, index: number) => {
    if (isSelectMode) {
      toggleSelect(look.id);
    } else {
      setSelectedLook(look);
      setCurrentIndex(index);
      setIsEditingMemo(false);
    }
  };
  
  // 룩 삭제 핸들러
  const handleDeleteLook = async () => {
    if (!selectedLook) return;
    
    setIsDeleting(true);
    try {
      // 스토리지에서 이미지 삭제 (파일 경로인 경우)
      if (selectedLook.image_url && !selectedLook.image_url.startsWith('http') && !selectedLook.image_url.startsWith('data:')) {
        await supabase.storage.from('generated-looks').remove([selectedLook.image_url]);
      }
      
      // DB에서 삭제
      const { error } = await supabase
        .from('generated_looks')
        .delete()
        .eq('id', selectedLook.id);
      
      if (error) throw error;
      
      // 로컬 상태 업데이트
      setMyLooks(prev => prev.filter(l => l.id !== selectedLook.id));
      
      toast({
        title: '삭제 완료',
        description: '룩이 삭제되었습니다.',
      });
      
      // 모달 닫기
      setShowDeleteConfirm(false);
      setSelectedLook(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: '삭제 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 즐겨찾기 토글
  const toggleFavorite = async (look: GeneratedLook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newFavorite = !look.is_favorite;
    const { error } = await supabase
      .from('generated_looks')
      .update({ is_favorite: newFavorite })
      .eq('id', look.id);
    
    if (!error) {
      setMyLooks(prev => prev.map(l => 
        l.id === look.id ? { ...l, is_favorite: newFavorite } : l
      ));
      // 모달에서도 업데이트
      if (selectedLook?.id === look.id) {
        setSelectedLook({ ...look, is_favorite: newFavorite });
      }
      toast({
        title: newFavorite ? '즐겨찾기 추가' : '즐겨찾기 해제',
        description: newFavorite ? '룩이 즐겨찾기에 추가되었습니다.' : '즐겨찾기가 해제되었습니다.',
      });
    }
  };

  if (myLooks.length === 0) {
    return (
      <div className="text-center py-20">
        <img src={showmelookLogo} alt="" className="w-16 h-16 mx-auto opacity-50 mb-4" />
        <p className="text-lg text-muted-foreground font-korean">아직 생성된 룩이 없습니다</p>
        <Button
          variant="hero"
          className="mt-4 font-korean"
          onClick={() => setActiveTab('generate')}
        >
          첫 스타일 만들기
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* 필터 및 다중 선택 모드 */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground font-korean">
            {isSelectMode ? `${selectedIds.size}개 선택됨` : `${visibleItems.length} / ${filteredLooks.length}개`}
            {showFavoritesOnly && !isSelectMode && ` (즐겨찾기)`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 다중 선택 모드 */}
          {isSelectMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="font-korean text-xs"
              >
                {selectedIds.size === filteredLooks.length ? '전체 해제' : '전체 선택'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="font-korean text-xs"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {selectedIds.size}개 삭제
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exitSelectMode}
                className="font-korean text-xs"
              >
                취소
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectMode(true)}
                className="font-korean text-xs"
              >
                <Check className="w-4 h-4 mr-1" />
                선택
              </Button>
              {/* 필터 버튼 */}
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="flex items-center gap-1"
              >
                <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                <span className="font-korean hidden sm:inline">즐겨찾기</span>
                {favoriteCount > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    showFavoritesOnly 
                      ? 'bg-primary-foreground/20 text-primary-foreground' 
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {favoriteCount}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* 필터 결과 없음 */}
      {filteredLooks.length === 0 && showFavoritesOnly && (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 mx-auto opacity-30 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground font-korean">즐겨찾기한 룩이 없습니다</p>
          <Button
            variant="outline"
            className="mt-4 font-korean"
            onClick={() => setShowFavoritesOnly(false)}
          >
            전체 보기
          </Button>
        </div>
      )}
      
      {/* 갤러리 그리드 */}
      {filteredLooks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleItems.map((look, index) => (
            <div
              key={look.id}
              className={`aspect-[3/4] rounded-2xl overflow-hidden bg-secondary relative group cursor-pointer transition-all duration-200 ${
                isSelectMode && selectedIds.has(look.id) ? 'ring-4 ring-accent ring-offset-2 ring-offset-background' : ''
              }`}
              onClick={() => handleLookClick(look, index)}
            >
              <LazyImage
                src={look.image_url}
                alt="Generated look"
                className="w-full h-full object-cover"
                fallbackClassName="w-full h-full"
              />
              
              {/* 다중 선택 체크박스 */}
              {isSelectMode && (
                <div className="absolute top-3 right-3 z-10">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(look.id) 
                      ? 'bg-accent border-accent' 
                      : 'bg-background/80 border-border'
                  }`}>
                    {selectedIds.has(look.id) && <Check className="w-4 h-4 text-accent-foreground" />}
                  </div>
                </div>
              )}
              
              {/* 즐겨찾기 표시 (항상 보임) */}
              {look.is_favorite && !isSelectMode && (
                <div className="absolute top-3 left-3">
                  <Heart className="w-5 h-5 fill-accent text-accent drop-shadow-md" />
                </div>
              )}
              
              {/* 태그 표시 */}
              {look.tags && look.tags.length > 0 && !isSelectMode && (
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1">
                  {look.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                  {look.tags.length > 2 && (
                    <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                      +{look.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
              
              {/* 호버시 오버레이 - 선택 모드가 아닐 때만 */}
              {!isSelectMode && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  
                  {/* 하단 날짜 */}
                  <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <p className="text-sm text-white/90 font-korean">
                      {new Date(look.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  
                  {/* 상단 버튼들 */}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {/* 저장/공유 버튼 */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <ShareButtons 
                        imageUrl={look.image_url} 
                        onShare={(platform, result) => {
                          if (result.message) {
                            toast({
                              title: result.success ? '성공' : '알림',
                              description: result.message,
                              variant: result.success ? 'default' : 'destructive',
                            });
                          }
                        }}
                        compact
                        isPremium={isPremium}
                        logoUrl={showmelookWatermarkFull}
                      />
                    </div>
                    {/* 좋아요 버튼 */}
                    <button 
                      onClick={(e) => toggleFavorite(look, e)}
                      className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
                    >
                      <Heart className={`w-5 h-5 ${look.is_favorite ? 'fill-accent text-accent' : 'text-foreground'}`} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 무한 스크롤 트리거 */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className="flex justify-center py-8"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-korean">더 불러오는 중...</span>
          </div>
        </div>
      )}
      
      {/* 모두 로드 완료 */}
      {!hasMore && filteredLooks.length > 12 && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground font-korean">
            모든 룩을 불러왔습니다 ✨
          </p>
        </div>
      )}
      
      {/* 상세 보기 모달 */}
      {selectedLook && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => !showDeleteConfirm && setSelectedLook(null)}
        >
          {/* 닫기 버튼 */}
          <button 
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => setSelectedLook(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          {/* 삭제 버튼 */}
          <button 
            className="absolute top-4 left-4 z-10 w-12 h-12 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/40 transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
          
          {/* 이전 버튼 - 데스크톱만 */}
          {currentIndex > 0 && (
            <button 
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          
          {/* 다음 버튼 - 데스크톱만 */}
          {currentIndex < filteredLooks.length - 1 && (
            <button 
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm items-center justify-center hover:bg-white/20 transition-colors hidden sm:flex"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
          
          {/* 이미지 컨테이너 - 터치 제스처 지원 */}
          <div 
            className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center touch-pan-y"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img 
              src={selectedLook.image_url} 
              alt="Generated look" 
              className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-2xl select-none"
              draggable={false}
            />
            
            {/* 스와이프 힌트 - 모바일만 */}
            <div className="sm:hidden text-center mt-2">
              <p className="text-white/40 text-xs font-korean">← 스와이프하여 탐색 →</p>
            </div>
            
            {/* 메모/태그 영역 */}
            {isEditingMemo ? (
              <div className="mt-4 w-full max-w-md bg-card rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground font-korean mb-2 block">메모</label>
                  <Textarea
                    value={editMemo}
                    onChange={(e) => setEditMemo(e.target.value)}
                    placeholder="이 룩에 대한 메모를 입력하세요..."
                    className="resize-none h-20 font-korean"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{editMemo.length}/200</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground font-korean mb-2 block">태그</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editTags.map((tag, i) => (
                      <span 
                        key={i} 
                        className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(newTag))}
                      placeholder="태그 입력..."
                      className="flex-1 h-8 text-sm"
                      maxLength={20}
                    />
                    <Button size="sm" variant="outline" onClick={() => addTag(newTag)} disabled={!newTag.trim()}>
                      추가
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tagOptions.filter(t => !editTags.includes(t)).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors font-korean"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 font-korean" 
                    onClick={() => setIsEditingMemo(false)}
                  >
                    취소
                  </Button>
                  <Button 
                    className="flex-1 font-korean" 
                    onClick={saveMemoAndTags}
                    disabled={isSavingMemo}
                  >
                    {isSavingMemo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 태그/메모 표시 */}
                {(selectedLook.tags?.length || selectedLook.memo) && (
                  <div className="mt-3 text-center max-w-md">
                    {selectedLook.tags && selectedLook.tags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1 mb-2">
                        {selectedLook.tags.map((tag, i) => (
                          <span key={i} className="text-xs bg-accent/80 text-accent-foreground px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedLook.memo && (
                      <p className="text-white/70 text-sm font-korean line-clamp-2">"{selectedLook.memo}"</p>
                    )}
                  </div>
                )}
                
                {/* 하단 정보 및 액션 */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4">
                  <p className="text-white/80 text-sm font-korean">
                    {new Date(selectedLook.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  
                  <span className="text-white/40">•</span>
                  
                  <p className="text-white/60 text-sm">
                    {currentIndex + 1} / {filteredLooks.length}
                  </p>
                  
                  <span className="text-white/40 hidden sm:inline">•</span>
                  
                  {/* 메모/태그 편집 버튼 */}
                  <button 
                    onClick={startEditingMemo}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Tag className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-korean hidden sm:inline">
                      {selectedLook.memo || selectedLook.tags?.length ? '편집' : '메모/태그'}
                    </span>
                  </button>
                  
                  {/* 즐겨찾기 버튼 */}
                  <button 
                    onClick={() => toggleFavorite(selectedLook)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Heart className={`w-4 h-4 ${selectedLook.is_favorite ? 'fill-accent text-accent' : 'text-white'}`} />
                    <span className="text-white text-sm font-korean hidden sm:inline">
                      {selectedLook.is_favorite ? '즐겨찾기됨' : '즐겨찾기'}
                    </span>
                  </button>
                  
                  {/* 공유 버튼 */}
                  <ShareButtons 
                    imageUrl={selectedLook.image_url} 
                    onShare={(platform, result) => {
                      if (result.message) {
                        toast({
                          title: result.success ? '성공' : '알림',
                          description: result.message,
                          variant: result.success ? 'default' : 'destructive',
                        });
                      }
                    }}
                    isPremium={isPremium}
                    logoUrl={showmelookWatermarkFull}
                    compact
                  />
                </div>
              </>
            )}
          </div>
          
          {/* 삭제 확인 모달 */}
          {showDeleteConfirm && (
            <div 
              className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4"
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
            >
              <div 
                className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-center font-korean mb-2">룩 삭제</h3>
                <p className="text-sm text-muted-foreground text-center font-korean mb-6">
                  이 룩을 삭제하시겠습니까?<br/>삭제된 룩은 복구할 수 없습니다.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 font-korean"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 font-korean"
                    onClick={handleDeleteLook}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        삭제 중...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 다중 삭제 확인 모달 */}
      {showBulkDeleteConfirm && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div 
            className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-center font-korean mb-2">
              {selectedIds.size}개 룩 삭제
            </h3>
            <p className="text-sm text-muted-foreground text-center font-korean mb-6">
              선택한 {selectedIds.size}개의 룩을 삭제하시겠습니까?<br/>
              삭제된 룩은 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 font-korean"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1 font-korean"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {selectedIds.size}개 삭제
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StyleGenerator = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { 
    isPremium, 
    remainingCount, 
    canGenerate, 
    isLoading: limitLoading, 
    updateAfterGeneration,
    refetch: refetchLimit 
  } = useGenerationLimit(user?.id);

  const [trends, setTrends] = useState<StyleTrend[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<StyleTrend | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [myLooks, setMyLooks] = useState<GeneratedLook[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'mylooks' | 'mypage'>('generate');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    height: '',
    weight: '',
    body_type: '',
    style_preferences: [] as string[],
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [useFaceComposite, setUseFaceComposite] = useState(true);
  
  // 트렌드 기반 실시간 검색된 상품들
  const [trendProducts, setTrendProducts] = useState<CachedProduct[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [selectedTrendProducts, setSelectedTrendProducts] = useState<CachedProduct[]>([]);
  
  // 필터 상태
  const [priceFilter, setPriceFilter] = useState<'all' | 'under50k' | 'under100k' | 'under200k' | 'over200k'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  
  // 주관식 스타일 입력 모드 상태
  const [inputMode, setInputMode] = useState<'trend' | 'custom'>('custom'); // 기본값을 custom으로 변경
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [customGender, setCustomGender] = useState<'female' | 'male' | 'unisex' | 'kids'>('female');
  const [customAge, setCustomAge] = useState<number | undefined>(undefined);
  const [customBudget, setCustomBudget] = useState([200000]);
  const [isCustomSearching, setIsCustomSearching] = useState(false);
  const [customResult, setCustomResult] = useState<{
    items: CachedProduct[];
    styleConcept: string;
    styleReasoning: string;
    totalPrice: number;
    autoSelectedTotal?: number;
    autoSelectedCount?: number;
    budget?: number;
  } | null>(null);

  // 구매 버튼 로딩 상태
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);

  // 좋아요 상태
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set());

  // 대체 상품 모달 상태
  const [alternativeModalOpen, setAlternativeModalOpen] = useState(false);
  const [alternativeCategory, setAlternativeCategory] = useState<string>('');
  const [alternativeProducts, setAlternativeProducts] = useState<CachedProduct[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

  // 동적 트렌드 키워드 상태 (인기도 추가)
  const [trendKeywords, setTrendKeywords] = useState<{ emoji: string; text: string; desc: string; popularity: number }[]>([
    { emoji: '☕', text: '편안한 카페 데이트룩', desc: '여유로운 분위기의 데이트에 어울리는 편안한 코디', popularity: 98 },
    { emoji: '💼', text: '캐주얼 오피스룩', desc: '격식과 편안함을 동시에 잡는 스마트 캐주얼', popularity: 85 },
    { emoji: '🌸', text: '봄나들이 페미닌 코디', desc: '화사하고 로맨틱한 봄 시즌 스타일', popularity: 92 },
    { emoji: '🖤', text: '모던 시크 룩', desc: '세련되고 도시적인 올블랙 베이스 스타일', popularity: 76 },
    { emoji: '🏃', text: '스포티 캐주얼', desc: '활동적이면서도 스타일리시한 애슬레저 룩', popularity: 88 },
    { emoji: '✨', text: '파티 글램 룩', desc: '특별한 날을 위한 화려하고 섹시한 스타일', popularity: 71 },
  ]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  
  // 피드백 상태
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [lastRecommendationId, setLastRecommendationId] = useState<string | null>(null);
  
  // 티커 애니메이션 상태 (부드러운 스크롤)
  const tickerRef = useRef<HTMLDivElement>(null);
  const tickerAnimationRef = useRef<number | null>(null);
  const tickerPositionRef = useRef(0);
  const [isTickerPaused, setIsTickerPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartPositionRef = useRef(0);
  const lastDragXRef = useRef(0);
  const velocityRef = useRef(0);
  
  // 티커 애니메이션 효과
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    
    const speed = 0.5; // 픽셀/프레임
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      if (!isTickerPaused && !isDragging) {
        // 자연스러운 감속 후 자동 스크롤
        if (Math.abs(velocityRef.current) > 0.1) {
          velocityRef.current *= 0.95; // 감속
          tickerPositionRef.current -= velocityRef.current;
        } else {
          velocityRef.current = 0;
          tickerPositionRef.current -= speed * (deltaTime / 16); // 60fps 기준
        }
        
        // 루프 처리
        const halfWidth = ticker.scrollWidth / 2;
        if (tickerPositionRef.current <= -halfWidth) {
          tickerPositionRef.current += halfWidth;
        } else if (tickerPositionRef.current > 0) {
          tickerPositionRef.current -= halfWidth;
        }
        
        ticker.style.transform = `translateX(${tickerPositionRef.current}px)`;
      } else if (isDragging) {
        ticker.style.transform = `translateX(${tickerPositionRef.current}px)`;
      } else if (isTickerPaused && Math.abs(velocityRef.current) > 0.1) {
        // 멈췄을 때 관성 처리
        velocityRef.current *= 0.92;
        tickerPositionRef.current -= velocityRef.current;
        ticker.style.transform = `translateX(${tickerPositionRef.current}px)`;
      }
      
      tickerAnimationRef.current = requestAnimationFrame(animate);
    };
    
    tickerAnimationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (tickerAnimationRef.current) {
        cancelAnimationFrame(tickerAnimationRef.current);
      }
    };
  }, [isTickerPaused, isDragging]);
  
  // 티커 드래그 핸들러
  const handleTickerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartPositionRef.current = tickerPositionRef.current;
    lastDragXRef.current = e.clientX;
    velocityRef.current = 0;
  };
  
  const handleTickerMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - dragStartXRef.current;
    tickerPositionRef.current = dragStartPositionRef.current + delta;
    velocityRef.current = e.clientX - lastDragXRef.current;
    lastDragXRef.current = e.clientX;
  };
  
  const handleTickerMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleTickerMouseLeave = () => {
    setIsTickerPaused(false);
    setIsDragging(false);
  };
  
  // 피드백 훅
  const { trackClick, trackLike, trackCart, trackViews } = useFeedback();
  // Embla Carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'start',
    containScroll: 'trimSnaps'
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  // 좋아요 토글 - DB 연동
  const toggleLike = async (product: CachedProduct) => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        description: '좋아요 기능을 사용하려면 로그인해주세요.',
        variant: 'destructive',
      });
      return;
    }

    const productId = product.id;
    const isLiked = likedProducts.has(productId);

    try {
      if (isLiked) {
        // 좋아요 취소 - DB에서 삭제
        const { error } = await supabase
          .from('liked_products')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;

        setLikedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast({
          title: '좋아요 취소',
          description: '관심 상품에서 제거되었습니다.',
        });
      } else {
        // 좋아요 - DB에 저장
        // 좋아요 피드백 수집
        const feedbackContext = {
          gender: customGender === 'male' ? '남성' : customGender === 'female' ? '여성' : customGender,
          occasion: customStylePrompt,
          budget: customBudget[0],
        };
        trackLike(productId, feedbackContext, lastRecommendationId || undefined);
        
        const { error } = await supabase
          .from('liked_products')
          .insert({
            user_id: user.id,
            product_id: productId,
            product_name: product.name,
            product_brand: product.brand,
            product_price: product.price,
            product_image_url: product.image_url,
            product_url: product.product_url,
            product_category: product.category,
            style_tags: product.style_tags,
          });

        if (error) throw error;

        setLikedProducts(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        toast({
          title: '💕 좋아요!',
          description: '관심 상품에 저장되었습니다.',
        });
      }
    } catch (error: any) {
      console.error('Like toggle error:', error);
      toast({
        title: '오류 발생',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  // 장바구니에 추가 - CachedProduct용
  const addCachedProductToCart = async (product: CachedProduct) => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 장바구니 피드백 수집
      const feedbackContext = {
        gender: customGender === 'male' ? '남성' : customGender === 'female' ? '여성' : customGender,
        occasion: customStylePrompt,
        budget: customBudget[0],
      };
      trackCart(product.id, feedbackContext, lastRecommendationId || undefined);
      
      const { error } = await supabase.from('cart_items').upsert({
        user_id: user.id,
        product_id: product.id,
        quantity: 1,
        product_source: 'cache',
        product_name: product.name,
        product_brand: product.brand,
        product_price: product.price,
        product_image_url: product.image_url,
        product_url: product.product_url,
      }, {
        onConflict: 'user_id,product_id'
      });

      if (error) throw error;

      toast({
        title: '장바구니에 추가됨',
        description: `${product.name}이(가) 장바구니에 추가되었습니다.`,
      });
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast({
        title: '오류 발생',
        description: error.message || '장바구니 추가에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 선택된 상품 모두 장바구니에 추가
  const addAllToCart = async () => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        variant: 'destructive',
      });
      return;
    }

    try {
      const insertPromises = selectedTrendProducts.map(product =>
        supabase.from('cart_items').upsert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
          product_source: 'cache',
          product_name: product.name,
          product_brand: product.brand,
          product_price: product.price,
          product_image_url: product.image_url,
          product_url: product.product_url,
        }, {
          onConflict: 'user_id,product_id'
        })
      );

      await Promise.all(insertPromises);

      toast({
        title: '장바구니에 추가됨',
        description: `${selectedTrendProducts.length}개 상품이 장바구니에 추가되었습니다.`,
      });
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast({
        title: '오류 발생',
        description: error.message || '장바구니 추가에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 좋아요 상품 불러오기
  useEffect(() => {
    const fetchLikedProducts = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('liked_products')
          .select('product_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const likedIds = new Set(data?.map(item => item.product_id) || []);
        setLikedProducts(likedIds);
      } catch (error) {
        console.error('Error fetching liked products:', error);
      }
    };

    fetchLikedProducts();
  }, [user]);

  // 스타일 태그 색상 매핑
  const getTagColor = (tag: string): string => {
    const colorMap: Record<string, string> = {
      '캐주얼': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      '미니멀': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      '스트릿': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      '클래식': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      '스포티': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      '페미닌': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      '모던': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      '빈티지': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      '럭셔리': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      '데일리': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    };
    return colorMap[tag] || 'bg-secondary text-muted-foreground';
  };

  // 카테고리를 priority category로 매핑하는 함수
  const mapToPriorityCategory = (category: string): string => {
    const cat = category.toLowerCase();
    
    // 상의
    if (['상의', 'top', 'tops', '블라우스', '셔츠', '니트', '티셔츠', 't-shirt', 'shirt', 'blouse', 'knit', 'shirts', 'polo shirts'].some(v => cat.includes(v.toLowerCase()))) {
      return '상의';
    }
    
    // 하의 (원피스 포함)
    if (['하의', 'bottom', 'bottoms', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress', 'dresses', '드레스'].some(v => cat.includes(v.toLowerCase()))) {
      return '하의';
    }
    
    // 아우터
    if (['아우터', 'outerwear', 'outer', 'jacket', '자켓', '코트', 'coat', '점퍼', 'jumper', 'cardigan', '가디건', 'jackets', 'coats', '패딩', '다운'].some(v => cat.includes(v.toLowerCase()))) {
      return '아우터';
    }
    
    // 신발
    if (['신발', 'shoes', 'footwear', '구두', '스니커즈', 'sneakers', '부츠', 'boots', 'sandals', '샌들', 'trainers', 'loafers'].some(v => cat.includes(v.toLowerCase()))) {
      return '신발';
    }
    
    // 가방
    if (['가방', 'bag', 'bags', '백', '클러치', 'clutch', 'tote', '토트백', 'holdalls', 'backpacks'].some(v => cat.includes(v.toLowerCase()))) {
      return '가방';
    }
    
    // 액세서리
    if (['액세서리', 'accessory', 'accessories', '스카프', 'scarf', '모자', 'hat', '벨트', 'belt', 'ties', 'scarves', 'hats', 'gloves', '목걸이', '반지', '귀걸이', '팔찌', '시계', 'watch', 'jewelry'].some(v => cat.includes(v.toLowerCase()))) {
      return '액세서리';
    }
    
    return '액세서리';
  };

  // 현재 선택된 상품과의 유사도 계산 (style_tags 기반)
  const calculateSimilarity = (product: CachedProduct, currentProduct: CachedProduct): number => {
    const currentTags = currentProduct.style_tags || [];
    const productTags = product.style_tags || [];
    
    if (currentTags.length === 0 || productTags.length === 0) return 0;
    
    const commonTags = currentTags.filter(tag => productTags.includes(tag));
    return commonTags.length / Math.max(currentTags.length, productTags.length);
  };

  // 대체 상품 조회 함수 (개선됨)
  const handleShowAlternatives = async (category: string, currentProductId: string) => {
    setAlternativeCategory(category);
    setAlternativeModalOpen(true);
    setIsLoadingAlternatives(true);
    setAlternativeProducts([]);

    try {
      // 현재 상품 정보 가져오기
      const currentProduct = customResult?.items.find(item => item.id === currentProductId);
      const priorityCategory = mapToPriorityCategory(category);
      
      // 성별 매핑 (유니섹스 지원)
      const genderKo = customGender === 'male' ? '남성' : customGender === 'female' ? '여성' : customGender === 'unisex' ? '유니섹스' : null;
      const genderEn = customGender === 'male' ? 'male' : customGender === 'female' ? 'female' : customGender === 'unisex' ? 'unisex' : null;
      
      console.log(`[Alternatives] Category: ${category} -> Priority: ${priorityCategory}, Gender: ${genderKo}/${genderEn}`);
      
      // priority category에 해당하는 모든 카테고리 키워드
      const categoryKeywords: Record<string, string[]> = {
        '상의': ['상의', 'top', '블라우스', '셔츠', '니트', '티셔츠', '후디', '맨투맨'],
        '하의': ['하의', 'bottom', 'pants', '팬츠', '바지', '청바지', 'jeans', 'skirt', '스커트', 'trousers', '원피스', 'dress'],
        '아우터': ['아우터', 'outerwear', 'jacket', '자켓', '코트', 'coat', '점퍼', '패딩', '다운', '가디건'],
        '신발': ['신발', 'shoes', '스니커즈', '부츠', 'boots', 'trainers', 'loafers', '로퍼'],
        '가방': ['가방', 'bag', '백', '클러치', 'tote', '토트백'],
        '액세서리': ['액세서리', 'accessory', '스카프', '모자', '벨트', '시계', '목걸이', '팔찌'],
      };
      
      const keywords = categoryKeywords[priorityCategory] || [category];
      
      // OR 조건으로 모든 키워드에 해당하는 상품 조회
      const orFilters = keywords.map(kw => `category.ilike.%${kw}%`).join(',');
      
      let query = supabase
        .from('products_cache')
        .select('id, name, brand, price, image_url, product_url, category, style_tags, gender')
        .eq('is_active', true)
        .eq('is_in_stock', true)
        .not('image_url', 'is', null)
        .neq('id', currentProductId)
        .or(orFilters);
      
      const { data, error } = await query.order('price', { ascending: true }).limit(50);

      if (error) throw error;

      // 성별 필터링 (클라이언트 측) - 반대 성별 명시적 제외
      let filteredData = (data || []).filter(item => {
        if (!genderKo && !genderEn) return true;
        if (genderKo === '유니섹스' || genderEn === 'unisex') return true; // 유니섹스는 모든 상품 포함
        if (!item.gender) return true; // 성별 정보 없으면 포함
        
        // 반대 성별 명시적 제외
        const oppositeGenderEn = genderEn === 'male' ? 'female' : 'male';
        const oppositeGenderKo = genderKo === '남성' ? '여성' : '남성';
        if (item.gender === oppositeGenderEn || item.gender === oppositeGenderKo) {
          return false; // 반대 성별 제외
        }
        
        return true;
      });

      let products: CachedProduct[] = filteredData.map(item => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        price: item.price,
        image_url: item.image_url,
        product_url: item.product_url,
        category: item.category,
        style_tags: item.style_tags,
      }));

      // 현재 상품과의 유사도순 정렬 (style_tags 기반)
      if (currentProduct) {
        products = products.sort((a, b) => {
          const simA = calculateSimilarity(a, currentProduct);
          const simB = calculateSimilarity(b, currentProduct);
          return simB - simA; // 유사도 높은 순
        });
      }

      console.log(`[Alternatives] Found ${products.length} products for ${priorityCategory}`);
      setAlternativeProducts(products);
    } catch (error) {
      console.error('Error fetching alternatives:', error);
      toast({
        title: '대체 상품 조회 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  // 대체 상품 선택하여 교체
  const handleSelectAlternative = (newProduct: CachedProduct) => {
    // 기존 같은 카테고리 상품 제거 후 새 상품 추가
    setSelectedTrendProducts(prev => {
      const filtered = prev.filter(p => p.category !== newProduct.category);
      return [...filtered, newProduct];
    });

    // customResult의 items도 업데이트
    if (customResult) {
      setCustomResult(prev => {
        if (!prev) return prev;
        const updatedItems = prev.items.map(item => 
          item.category === newProduct.category ? newProduct : item
        );
        return { ...prev, items: updatedItems };
      });
    }

    setAlternativeModalOpen(false);
    toast({
      title: '상품 교체됨',
      description: `${newProduct.name}(으)로 변경되었습니다.`,
    });
  };
  // 딥링크 변환 후 구매 페이지로 이동하는 함수
  const handlePurchase = async (product: CachedProduct) => {
    // 클릭 피드백 수집
    const feedbackContext = {
      gender: customGender === 'male' ? '남성' : customGender === 'female' ? '여성' : customGender,
      occasion: customStylePrompt,
      budget: customBudget[0],
    };
    trackClick(product.id, feedbackContext, lastRecommendationId || undefined);
    
    // affiliate_url이 이미 있으면 바로 이동
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
      return;
    }

    // product_url이 없으면 에러
    if (!product.product_url) {
      toast({
        title: '구매 링크 없음',
        description: '이 상품의 구매 링크가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setPurchasingProductId(product.id);

    try {
      // deeplink 함수 호출하여 제휴 링크 변환
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: product.product_url }
      });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        // 변환된 제휴 링크로 이동
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
        toast({
          title: '구매 페이지 이동',
          description: `${product.name} 구매 페이지로 이동합니다.`,
        });
      } else {
        // 딥링크 실패 시 원본 URL로 이동
        window.open(product.product_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Deeplink error:', error);
      // 에러 시에도 원본 URL로 이동
      window.open(product.product_url, '_blank', 'noopener,noreferrer');
    } finally {
      setPurchasingProductId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, [user]);

  // 캐시 참조 (재로딩 방지)
  const dataFetchedRef = useRef(false);
  const staticDataLoadedRef = useRef(false);

  const fetchData = async () => {
    // 정적 데이터는 한 번만 로드 (trends, products)
    const shouldFetchStaticData = !staticDataLoadedRef.current;
    
    // 병렬 로딩으로 속도 최적화
    const staticPromises: Promise<any>[] = [];
    const userPromises: Promise<any>[] = [];
    
    // 1. 정적 데이터 (trends, products) - 앱 시작 시 1회만
    if (shouldFetchStaticData) {
      staticPromises.push(
        Promise.resolve(supabase.from('style_trends').select('*').eq('is_active', true)),
        Promise.resolve(supabase.from('products').select('*').eq('is_active', true))
      );
    }
    
    // 2. 사용자 데이터 (looks, profile) - 로그인 시
    if (user) {
      userPromises.push(
        Promise.resolve(
          supabase
            .from('generated_looks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
        ),
        Promise.resolve(
          supabase
            .from('profiles')
            .select('height, weight, body_type, style_preferences, avatar_url, full_name, gender')
            .eq('user_id', user.id)
            .single()
        )
      );
    }
    
    // 병렬 실행
    const [staticResults, userResults] = await Promise.all([
      Promise.all(staticPromises),
      Promise.all(userPromises)
    ]);
    
    // 정적 데이터 처리
    if (shouldFetchStaticData && staticResults.length >= 2) {
      const trendsResult = staticResults[0];
      const productsResult = staticResults[1];
      
      if (trendsResult.data) setTrends(trendsResult.data);
      if (productsResult.data) setProducts(productsResult.data);
      
      staticDataLoadedRef.current = true;
      
      // AI 트렌드 키워드 (백그라운드, 비동기)
      fetchTrendKeywords();
    }
    
    // 사용자 데이터 처리
    if (user && userResults.length >= 2) {
      const looksResult = userResults[0];
      const profileResult = userResults[1];
      
      // Looks 처리 - Signed URL 배치 생성 (핵심 최적화!)
      if (looksResult.data && looksResult.data.length > 0) {
        const looksData = looksResult.data;
        
        // 파일 경로만 필터링 (http로 시작하지 않는 것들)
        const pathsNeedingSigning = looksData
          .map((look: any, index: number) => ({ index, path: look.image_url }))
          .filter((item: any) => item.path && !item.path.startsWith('http') && !item.path.startsWith('data:'));
        
        let signedUrlMap: Record<number, string> = {};
        
        if (pathsNeedingSigning.length > 0) {
          // 🚀 배치 처리: N번의 API 호출 -> 1번으로 감소!
          const paths = pathsNeedingSigning.map((item: any) => item.path);
          const { data: signedData } = await supabase.storage
            .from('generated-looks')
            .createSignedUrls(paths, 3600);
          
          if (signedData) {
            pathsNeedingSigning.forEach((item: any, i: number) => {
              if (signedData[i]?.signedUrl) {
                signedUrlMap[item.index] = signedData[i].signedUrl;
              }
            });
          }
        }
        
        // Signed URL 적용
        const looksWithUrls = looksData.map((look: any, index: number) => ({
          ...look,
          image_url: signedUrlMap[index] || look.image_url,
        }));
        
        setMyLooks(looksWithUrls);
      } else {
        setMyLooks([]);
      }
      
      // Profile 처리
      if (profileResult.data) {
        const profileData = profileResult.data;
        
        // Avatar Signed URL (단일이라 개별 처리)
        let avatarDisplayUrl = profileData.avatar_url;
        if (profileData.avatar_url && !profileData.avatar_url.startsWith('http') && !profileData.avatar_url.startsWith('data:')) {
          const { data: signedData } = await supabase.storage
            .from('avatars')
            .createSignedUrl(profileData.avatar_url, 3600);
          avatarDisplayUrl = signedData?.signedUrl || profileData.avatar_url;
        }
        
        setUserProfile({ ...profileData, avatar_url: avatarDisplayUrl });
        setEditForm({
          height: profileData.height?.toString() || '',
          weight: profileData.weight?.toString() || '',
          body_type: profileData.body_type || '',
          style_preferences: profileData.style_preferences || [],
        });
        
        // 프로필의 성별 정보로 초기 성별 설정
        if (profileData.gender) {
          const genderMap: Record<string, 'female' | 'male' | 'kids'> = {
            'female': 'female',
            'male': 'male',
            '여성': 'female',
            '남성': 'male',
            'kids': 'kids',
            '키즈': 'kids',
          };
          const mappedGender = genderMap[profileData.gender.toLowerCase()] || 'female';
          setCustomGender(mappedGender);
        }
      }
    }
    
    dataFetchedRef.current = true;
  };
  
  // 룩 목록만 새로고침 (전체 재로딩 없이)
  const refreshLooksOnly = async () => {
    if (!user) return;
    
    const { data: looksData } = await supabase
      .from('generated_looks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (looksData && looksData.length > 0) {
      const pathsNeedingSigning = looksData
        .map((look, index) => ({ index, path: look.image_url }))
        .filter(item => item.path && !item.path.startsWith('http') && !item.path.startsWith('data:'));
      
      let signedUrlMap: Record<number, string> = {};
      
      if (pathsNeedingSigning.length > 0) {
        const paths = pathsNeedingSigning.map(item => item.path);
        const { data: signedData } = await supabase.storage
          .from('generated-looks')
          .createSignedUrls(paths, 3600);
        
        if (signedData) {
          pathsNeedingSigning.forEach((item, i) => {
            if (signedData[i]?.signedUrl) {
              signedUrlMap[item.index] = signedData[i].signedUrl;
            }
          });
        }
      }
      
      const looksWithUrls = looksData.map((look, index) => ({
        ...look,
        image_url: signedUrlMap[index] || look.image_url,
      }));
      
      setMyLooks(looksWithUrls);
    } else {
      setMyLooks([]);
    }
  };

  // 트렌드 키워드 AI 분석 불러오기
  const fetchTrendKeywords = async () => {
    setIsLoadingKeywords(true);
    try {
      const response = await supabase.functions.invoke('analyze-trends');
      
      if (response.error) {
        console.error('Trend keywords fetch error:', response.error);
        return;
      }

      const data = response.data;
      if (data?.keywords && Array.isArray(data.keywords) && data.keywords.length > 0) {
        setTrendKeywords(data.keywords);
        console.log('Loaded', data.keywords.length, 'trend keywords from AI analysis');
      }
    } catch (error) {
      console.error('Error fetching trend keywords:', error);
      // 에러 시 기본 키워드 유지
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  const toggleStylePreference = (styleId: string) => {
    setEditForm(prev => ({
      ...prev,
      style_preferences: prev.style_preferences.includes(styleId)
        ? prev.style_preferences.filter(s => s !== styleId)
        : [...prev.style_preferences, styleId]
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path instead of public URL (bucket is now private)
      const storagePath = filePath;

      await supabase
        .from('profiles')
        .update({ avatar_url: storagePath })
        .eq('user_id', user.id);

      // Generate signed URL for display (valid for 1 hour)
      const { data: signedData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 3600);

      setUserProfile(prev => prev ? { ...prev, avatar_url: signedData?.signedUrl || storagePath } : null);
      
      toast({
        title: '프로필 사진 변경됨',
        description: '새 프로필 사진이 저장되었습니다.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: '업로드 실패',
        description: '프로필 사진 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          height: editForm.height ? parseInt(editForm.height) : null,
          weight: editForm.weight ? parseInt(editForm.weight) : null,
          body_type: editForm.body_type || null,
          style_preferences: editForm.style_preferences,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setUserProfile(prev => prev ? {
        ...prev,
        height: editForm.height ? parseInt(editForm.height) : null,
        weight: editForm.weight ? parseInt(editForm.weight) : null,
        body_type: editForm.body_type || null,
        style_preferences: editForm.style_preferences,
      } : null);
      
      setIsEditingProfile(false);
      toast({
        title: '프로필 저장됨',
        description: '프로필 정보가 업데이트되었습니다.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: '저장 실패',
        description: '프로필 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleProduct = (product: Product) => {
    setSelectedProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  const toggleTrendProduct = (product: CachedProduct) => {
    setSelectedTrendProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  // 트렌드 선택 시 실시간 상품 검색
  const handleTrendSelect = async (trend: StyleTrend) => {
    setSelectedTrend(trend);
    setTrendProducts([]);
    setSelectedTrendProducts([]);
    
    if (!trend) return;
    
    setIsSearchingProducts(true);
    
    try {
      const gender = userProfile?.gender === 'female' ? '여성' : '남성';
      const userRequest = `${trend.name_ko} 스타일 코디`;
      
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest,
          gender,
          budget: 300000,
          forceRefresh: false
        }
      });
      
      if (error) throw error;
      
      if (data.success && data.look?.items) {
        // 검색된 상품들 추출 (product가 있는 아이템만)
        const foundProducts: CachedProduct[] = data.look.items
          .filter((item: any) => item.product !== null)
          .map((item: any) => ({
            id: item.product.id,
            name: item.product.name,
            brand: item.product.brand,
            price: item.product.price,
            image_url: item.product.image_url,
            product_url: item.product.product_url,
            category: item.category,
            style_tags: item.product.style_tags,
            affiliate_url: item.affiliateUrl
          }));
        
        setTrendProducts(foundProducts);
        
        // 캐시 히트 시 알림
        if (data.cacheHit) {
          toast({
            title: '캐시된 스타일 불러옴!',
            description: `${foundProducts.length}개 아이템 (API 비용 절약 🎉)`,
          });
        } else {
          toast({
            title: '상품 검색 완료!',
            description: `${foundProducts.length}개의 ${trend.name_ko} 스타일 아이템을 찾았어요.`,
          });
        }
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast({
        title: '검색 실패',
        description: '상품 검색 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingProducts(false);
    }
  };

  // 주관식 스타일 추천 핸들러
  const handleCustomStyleSearch = async () => {
    if (!customStylePrompt.trim()) {
      toast({
        title: '스타일 프롬프트를 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    setIsCustomSearching(true);
    setCustomResult(null);
    setSelectedTrendProducts([]);

    try {
      // 성별 매핑
      const genderMapping: Record<string, string> = {
        'female': '여성',
        'male': '남성',
        'unisex': '유니섹스',
        'kids': '여성' // 키즈는 기본 여성으로 처리하고 age로 구분
      };
      const genderKo = genderMapping[customGender] || '여성';
      
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest: customStylePrompt,
          gender: genderKo,
          budget: customBudget[0],
          forceRefresh: false,
          age: customGender === 'kids' ? (customAge || 10) : customAge
        }
      });

      if (error) throw error;

      if (data.success && data.look) {
        const transformedItems: CachedProduct[] = data.look.items
          .filter((item: any) => item.product !== null)
          .map((item: any) => ({
            id: item.product.id,
            name: item.product.name,
            brand: item.product.brand,
            price: item.product.price,
            image_url: item.product.image_url,
            product_url: item.product.product_url,
            category: item.category,
            style_tags: item.product.style_tags,
            affiliate_url: item.affiliateUrl,
            isAutoSelected: item.isAutoSelected // 예산 내 자동 선택 여부
          }));

        setCustomResult({
          items: transformedItems,
          styleConcept: data.look.styleConcept || data.look.name || '스타일 추천',
          styleReasoning: data.look.styleReasoning || data.look.stylingTips || '',
          totalPrice: data.look.totalPrice || 0,
          autoSelectedTotal: data.look.autoSelectedTotal || 0,
          autoSelectedCount: data.look.autoSelectedCount || 0,
          budget: data.look.budget || customBudget[0]
        });

        // 모든 추천 아이템을 기본 선택 상태로 (예산 무관)
        setSelectedTrendProducts(transformedItems);

        toast({
          title: '스타일 추천 완료!',
          description: `${transformedItems.length}개의 아이템을 추천해드렸어요.`,
        });

        // 히스토리 저장 및 피드백용 ID 설정
        if (user) {
          try {
            const { data: historyData } = await supabase.from('recommendation_history').insert({
              user_id: user.id,
              prompt: customStylePrompt,
              gender: customGender === 'kids' ? '키즈' : customGender === 'unisex' ? '유니섹스' : (customGender === 'female' ? '여성' : '남성'),
              budget: customBudget[0],
              style_concept: data.look.name || '',
              style_reasoning: data.look.stylingTips || '',
              items: transformedItems as any,
              total_price: data.look.totalPrice || 0
            }).select('id').single();
            
            // 피드백용 추천 ID 설정
            if (historyData) {
              setLastRecommendationId(historyData.id);
              setFeedbackGiven(null); // 새 추천 시 피드백 초기화
            }
            
            // 상품 조회 피드백 수집
            const productIds = transformedItems.map((item: CachedProduct) => item.id);
            const feedbackContext = {
              gender: customGender === 'male' ? '남성' : customGender === 'female' ? '여성' : customGender,
              occasion: customStylePrompt,
              budget: customBudget[0],
            };
            trackViews(productIds, feedbackContext, historyData?.id || undefined);
          } catch (saveError) {
            console.error('Failed to save to history:', saveError);
          }
        }
      } else {
        throw new Error(data.error || '추천 실패');
      }
    } catch (error: any) {
      console.error('Custom style recommendation error:', error);
      toast({
        title: '추천 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsCustomSearching(false);
    }
  };

  const generateStyle = async () => {
    if (!user) return;

    // Check limit before generating
    if (!canGenerate) {
      toast({
        title: '일일 생성 횟수 초과',
        description: '프리미엄으로 업그레이드하면 무제한 생성이 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    // 트렌드 상품 또는 일반 상품 사용
    const useTrendProducts = selectedTrendProducts.length > 0;
    const productsToUse = useTrendProducts ? selectedTrendProducts : selectedProducts;
    
    if (productsToUse.length === 0 && !selectedTrend && !customResult) {
      toast({
        title: '상품을 선택해주세요',
        description: '스타일 생성을 위해 최소 1개의 상품을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    
    // 생성 시작 시 결과 영역으로 스크롤
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    try {
      const styleDescription = selectedTrend?.name_ko || customResult?.styleConcept || '트렌디한';
      
      // 상품 정보를 상세하게 구성 (이름, 브랜드, 카테고리 포함)
      const productsWithDetails = useTrendProducts 
        ? selectedTrendProducts.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
          }))
        : selectedProducts.map(p => ({
            id: p.id,
            name: p.name_ko,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
          }));

      const productsDescription = productsWithDetails.map(p => {
        const brandPart = p.brand ? `${p.brand} ` : '';
        return `${brandPart}${p.name}`;
      }).join(', ') || '기본 아이템';

      // 상품 이미지 URL 목록 (AI가 참고할 수 있도록)
      const productImageUrls = productsWithDetails
        .filter(p => p.image_url)
        .map(p => p.image_url);

      // Call AI generation edge function with face composite option
      const { data, error } = await supabase.functions.invoke('generate-style', {
        body: {
          style: styleDescription,
          products: productsDescription,
          productDetails: productsWithDetails, // 상세 상품 정보 전달
          productImageUrls: productImageUrls, // 상품 이미지 URL 전달
          userProfile: userProfile,
          useFaceComposite: useFaceComposite && !!userProfile?.avatar_url,
          userAvatarUrl: userProfile?.avatar_url,
          styleTrendId: selectedTrend?.id || null,
          productIds: productsWithDetails.map(p => p.id),
        },
      });

      if (error) throw error;

      // Handle limit exceeded error
      if (data?.limitExceeded) {
        toast({
          title: '일일 생성 횟수 초과',
          description: '프리미엄으로 업그레이드하면 무제한 생성이 가능합니다.',
          variant: 'destructive',
        });
        refetchLimit();
        return;
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        
        // 생성 완료 시 결과 영역으로 스크롤
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // Update local limit state
        if (typeof data.remainingCount === 'number') {
          updateAfterGeneration(data.isPremium, data.remainingCount);
        }

        // Show appropriate toast
        toast({
          title: '스타일 생성 완료!',
          description: useFaceComposite && userProfile?.avatar_url 
            ? '당신의 얼굴이 합성된 룩이 완성되었습니다.' 
            : '당신만의 룩이 완성되었습니다.',
        });

        // Save to database (only if not cached - edge function handles caching)
        if (!data.cached) {
          await supabase.from('generated_looks').insert({
            user_id: user.id,
            image_url: data.imagePath || data.imageUrl,
            prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
            style_trend_id: selectedTrend?.id || null,
            product_ids: productsWithDetails.map(p => p.id),
          });
        }

        fetchData(); // Refresh my looks
      }
    } catch (error: any) {
      console.error('Error generating style:', error);
      
      const errorMessage = error?.message || '스타일 생성 중 문제가 발생했습니다.';
      toast({
        title: '생성 실패',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const addToCart = async (product: Product) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('cart_items').upsert({
        user_id: user.id,
        product_id: product.id,
        quantity: 1,
      });

      if (error) throw error;

      toast({
        title: '장바구니에 추가됨',
        description: `${product.name_ko}이(가) 장바구니에 추가되었습니다.`,
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const categoryLabels: Record<string, string> = {
    top: '상의',
    bottom: '하의',
    outerwear: '아우터',
    shoes: '신발',
    accessory: '액세서리',
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - using shared MainNavigation */}
      <MainNavigation 
        rightContent={
          <div className="flex items-center gap-1 sm:gap-2">
            {/* 내 룩 버튼 with Badge */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setActiveTab('mylooks')} 
              className={`p-2 relative ${activeTab === 'mylooks' ? 'text-accent bg-accent/10' : ''}`}
            >
              <Heart className={`w-5 h-5 ${activeTab === 'mylooks' ? 'fill-accent' : ''}`} />
              {myLooks.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {myLooks.length > 99 ? '99+' : myLooks.length}
                </span>
              )}
            </Button>
            {/* 마이페이지 버튼 */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setActiveTab('mypage')} 
              className={`p-2 ${activeTab === 'mypage' ? 'text-accent bg-accent/10' : ''}`}
            >
              <User className={`w-5 h-5 ${activeTab === 'mypage' ? 'fill-accent' : ''}`} />
            </Button>
            {/* 장바구니 */}
            <Button variant="ghost" size="sm" onClick={() => navigate('/cart')} className="p-2">
              <ShoppingBag className="w-5 h-5" />
            </Button>
            {/* 로그아웃 */}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="p-2">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        }
      />

      <div className="w-full max-w-full overflow-x-hidden px-4 sm:px-6 pt-16 sm:pt-20 pb-24 lg:pb-8 mx-auto" style={{ maxWidth: '100vw' }}>
        {activeTab === 'generate' ? (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-8 w-full max-w-7xl mx-auto">
            {/* Left: Selection - order-2 on mobile, order-1 on desktop */}
            <div className="space-y-4 sm:space-y-6 order-2 lg:order-1 w-full min-w-0 self-start">
              {/* 스타일 입력 - 모바일에서 접을 수 있는 아코디언 */}
              <Collapsible defaultOpen={true} className="lg:block">
                <CollapsibleTrigger className="w-full lg:hidden group">
                  <div className="p-4 rounded-2xl border-2 border-border bg-secondary/30 flex items-center justify-between transition-all duration-200 hover:bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-accent" />
                      <span className="font-korean text-base font-medium text-foreground">스타일 설정</span>
                      {customStylePrompt && (
                        <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">입력됨</span>
                      )}
                    </div>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-3 lg:mt-0 overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up w-full">
                  <div className="p-3 sm:p-5 rounded-2xl border-2 border-border bg-secondary/30 w-full overflow-hidden">
                    <div className="hidden lg:flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-accent" />
                      <h2 className="font-korean text-lg font-medium text-foreground">원하는 스타일 설명</h2>
                    </div>
                    
                    <div className="space-y-4">
                      {/* 스타일 프롬프트 */}
                      <div className="space-y-2">
                        <Label className="font-korean text-sm">스타일 프롬프트</Label>
                        <Textarea
                          placeholder="예: 봄 데이트룩, 화사하고 로맨틱한 느낌으로 원피스나 블라우스 위주로 추천해줘"
                          value={customStylePrompt}
                          onChange={(e) => setCustomStylePrompt(e.target.value)}
                          className="min-h-[80px] sm:min-h-[100px] resize-none font-korean text-sm sm:text-base"
                          disabled={isCustomSearching}
                        />
                        
                        {/* AI 분석 기반 추천 키워드 - 티커 스타일 */}
                        <div 
                          className="relative w-full overflow-hidden h-8 group select-none"
                          onMouseEnter={() => setIsTickerPaused(true)}
                          onMouseLeave={handleTickerMouseLeave}
                          onMouseDown={handleTickerMouseDown}
                          onMouseMove={handleTickerMouseMove}
                          onMouseUp={handleTickerMouseUp}
                          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        >
                          {isLoadingKeywords ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground h-full">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>인기 키워드 분석 중...</span>
                            </div>
                          ) : (
                            <div 
                              ref={tickerRef}
                              className="flex items-center gap-2 absolute whitespace-nowrap h-full will-change-transform"
                            >
                              {/* 키워드 2번 반복 (무한 루프 효과) */}
                              {[...Array(2)].map((_, repeatIdx) => (
                                <div key={repeatIdx} className="flex items-center gap-2">
                                  {trendKeywords.map((keyword, index) => (
                                    <button
                                      key={`trend-${repeatIdx}-${index}-${keyword.text}`}
                                      onClick={() => {
                                        if (!isDragging) {
                                          setCustomStylePrompt(`${keyword.text} - ${keyword.desc}`);
                                        }
                                      }}
                                      disabled={isCustomSearching}
                                      className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-secondary/50 hover:bg-secondary rounded-full text-xs font-korean transition-colors disabled:opacity-50 shrink-0 relative"
                                    >
                                      <span>{keyword.emoji}</span>
                                      <span>{keyword.text}</span>
                                      {/* 인기도 배지 */}
                                      {keyword.popularity >= 90 && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-500/20 text-rose-500 rounded-full text-[10px] font-medium">
                                          🔥 HOT
                                        </span>
                                      )}
                                      {keyword.popularity >= 80 && keyword.popularity < 90 && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 rounded-full text-[10px] font-medium">
                                          ⬆️ {keyword.popularity}
                                        </span>
                                      )}
                                      {keyword.popularity >= 70 && keyword.popularity < 80 && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/20 text-blue-500 rounded-full text-[10px] font-medium">
                                          {keyword.popularity}
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                  {trends.map((trend, trendIdx) => {
                                    const trendEmojis: Record<string, string> = {
                                      'Minimalist': '🤍',
                                      'Street Style': '🔥',
                                      'Classic Elegance': '👔',
                                      'Athleisure': '⚡',
                                      'Bohemian': '🌺',
                                    };
                                    // DB 트렌드에는 랜덤 인기도 부여 (50-99)
                                    const trendPopularity = 50 + ((trendIdx * 17) % 50);
                                    return (
                                      <button
                                        key={`db-${repeatIdx}-${trend.id}`}
                                        onClick={() => {
                                          if (!isDragging) {
                                            setCustomStylePrompt(`${trend.name_ko} - ${trend.description || ''}`);
                                            setSelectedTrend(trend);
                                          }
                                        }}
                                        disabled={isCustomSearching}
                                        className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-secondary/50 hover:bg-secondary rounded-full text-xs font-korean transition-colors disabled:opacity-50 shrink-0"
                                      >
                                        <span>{trendEmojis[trend.name] || '🎨'}</span>
                                        <span>{trend.name_ko}</span>
                                        {trendPopularity >= 80 && (
                                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 rounded-full text-[10px] font-medium">
                                            ⬆️ {trendPopularity}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 성별 선택 (키즈 포함) */}
                      <div className="space-y-2 w-full">
                        <Label className="font-korean text-sm">누구를 위한 스타일인가요?</Label>
                        <RadioGroup
                          value={customGender}
                          onValueChange={(value) => {
                            setCustomGender(value as 'female' | 'male' | 'unisex' | 'kids');
                            if (value === 'kids' && !customAge) {
                              setCustomAge(10);
                            }
                          }}
                          className="grid grid-cols-2 gap-2 w-full"
                          disabled={isCustomSearching}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <RadioGroupItem value="female" id="custom-female" className="shrink-0" />
                            <Label htmlFor="custom-female" className="cursor-pointer font-korean text-xs sm:text-sm truncate">여성</Label>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <RadioGroupItem value="male" id="custom-male" className="shrink-0" />
                            <Label htmlFor="custom-male" className="cursor-pointer font-korean text-xs sm:text-sm truncate">남성</Label>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <RadioGroupItem value="unisex" id="custom-unisex" className="shrink-0" />
                            <Label htmlFor="custom-unisex" className="cursor-pointer font-korean text-xs sm:text-sm truncate">🌈 유니섹스</Label>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <RadioGroupItem value="kids" id="custom-kids" className="shrink-0" />
                            <Label htmlFor="custom-kids" className="cursor-pointer font-korean text-xs sm:text-sm truncate">👶 키즈</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* 나이 입력 (키즈 선택 시 표시) */}
                      {customGender === 'kids' && (
                        <div className="space-y-2">
                          <Label className="font-korean text-sm">아이 나이</Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              value={customAge || ''}
                              onChange={(e) => setCustomAge(parseInt(e.target.value) || undefined)}
                              placeholder="예: 8"
                              className="w-20 font-korean"
                              disabled={isCustomSearching}
                            />
                            <span className="text-sm text-muted-foreground font-korean">세</span>
                          </div>
                        </div>
                      )}

                      {/* 예산 섹션 제거됨 - AI가 스타일에만 집중 */}

                      {/* 추천 버튼 */}
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full font-korean text-sm sm:text-base"
                        onClick={handleCustomStyleSearch}
                        disabled={isCustomSearching || !customStylePrompt.trim()}
                      >
                        {isCustomSearching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            AI가 스타일을 분석중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            스타일 추천받기
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 주관식 추천 결과 */}
              {customResult && (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                  {/* 스타일 컨셉 헤더 - 글래스모피즘 효과 */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/80 via-white/60 to-white/40 dark:from-card/80 dark:via-card/60 dark:to-card/40 backdrop-blur-xl border border-white/50 dark:border-white/10 p-4 sm:p-6 shadow-xl shadow-accent/5">
                    {/* 배경 장식 */}
                    <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-gradient-to-br from-accent/20 to-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-tr from-primary/15 to-accent/15 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative">
                      {/* 라벨 */}
                      <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-accent/15 to-primary/15 border border-accent/20 mb-3 sm:mb-4">
                        <div className="w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <Sparkles className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-white" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-accent tracking-wide">AI 스타일리스트 추천</span>
                      </div>
                      
                      {/* 타이틀 */}
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4 leading-tight tracking-tight">
                        {customResult.styleConcept}
                      </h3>
                      
                      {/* 설명 - 카드 스타일 */}
                      <div className="relative pl-3 sm:pl-4 border-l-2 border-accent/30">
                        <p className="text-xs sm:text-sm text-muted-foreground font-korean leading-relaxed">
                          {customResult.styleReasoning}
                        </p>
                      </div>
                      
                      {/* 피드백 버튼 */}
                      <div className="mt-4 sm:mt-5 pt-4 border-t border-border/30">
                        <p className="text-xs sm:text-sm text-muted-foreground font-korean mb-2 sm:mb-3">
                          이 추천이 마음에 드시나요?
                        </p>
                        <div className="flex gap-2 sm:gap-3">
                          <button
                            onClick={() => {
                              setFeedbackGiven('positive');
                              toast({
                                title: '감사합니다! 💕',
                                description: '피드백이 더 나은 추천에 반영됩니다.',
                              });
                            }}
                            disabled={feedbackGiven !== null}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-korean text-xs sm:text-sm font-medium transition-all duration-300 ${
                              feedbackGiven === 'positive'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : feedbackGiven === 'negative'
                                ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-500 hover:text-white hover:shadow-lg hover:shadow-green-500/20'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            {feedbackGiven === 'positive' ? '감사해요!' : '좋아요'}
                          </button>
                          <button
                            onClick={() => {
                              setFeedbackGiven('negative');
                              toast({
                                title: '피드백 감사합니다',
                                description: '다음에는 더 나은 추천을 드릴게요.',
                              });
                            }}
                            disabled={feedbackGiven !== null}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-korean text-xs sm:text-sm font-medium transition-all duration-300 ${
                              feedbackGiven === 'negative'
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                : feedbackGiven === 'positive'
                                ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:shadow-orange-500/20'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            {feedbackGiven === 'negative' ? '개선할게요' : '아쉬워요'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 추천 아이템 섹션 - 스와이프 캐러셀 */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                          <ShoppingBag className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-korean text-sm sm:text-base font-semibold text-foreground">
                            추천 아이템
                          </h4>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">스와이프하여 둘러보세요</p>
                        </div>
                      </div>
                      {/* 캐러셀 네비게이션 */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:flex gap-1.5">
                          {customResult.items.map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === currentSlide ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/20'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={scrollPrev}
                            disabled={!canScrollPrev}
                            className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg sm:rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={scrollNext}
                            disabled={!canScrollNext}
                            className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg sm:rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 스와이프 캐러셀 */}
                    <div className="overflow-hidden rounded-xl sm:rounded-2xl" ref={emblaRef}>
                      <div className="flex gap-3 sm:gap-4 -ml-3 sm:-ml-4">
                        {customResult.items.map((product, index) => (
                          <div
                            key={product.id}
                            className="flex-none w-[80%] sm:w-[48%] lg:w-[45%] pl-3 sm:pl-4 first:pl-3 sm:first:pl-4"
                          >
                            <div
                              className={`group relative rounded-2xl sm:rounded-3xl transition-all duration-500 overflow-hidden ${
                                selectedTrendProducts.find(p => p.id === product.id)
                                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-background shadow-2xl shadow-accent/25 scale-[1.02]'
                                  : 'shadow-lg hover:shadow-xl hover:scale-[1.01]'
                              }`}
                            >
                              {/* 이미지 영역 */}
                              <div className="relative aspect-[3/4] bg-gradient-to-br from-secondary via-secondary/80 to-muted overflow-hidden">
                                {product.image_url ? (
                                  <ProductImage 
                                    src={product.image_url} 
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                                    <ShoppingBag className="w-12 sm:w-16 h-12 sm:h-16 text-muted-foreground/20" />
                                  </div>
                                )}
                                
                                {/* 오버레이 그라데이션 */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                
                                {/* 상단 배지들 */}
                                <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between items-start">
                                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-full text-foreground shadow-lg">
                                    {product.category}
                                  </span>
                                  {/* 좋아요 버튼 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLike(product);
                                    }}
                                    className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                                      likedProducts.has(product.id)
                                        ? 'bg-red-500 text-white scale-110'
                                        : 'bg-white/95 dark:bg-black/80 backdrop-blur-md text-muted-foreground hover:text-red-500 hover:scale-110'
                                    }`}
                                  >
                                    <Heart 
                                      className={`w-4 sm:w-5 h-4 sm:h-5 transition-transform ${
                                        likedProducts.has(product.id) ? 'fill-current' : ''
                                      }`} 
                                    />
                                  </button>
                                </div>

                                {/* 선택 체크 아이콘 */}
                                {selectedTrendProducts.find(p => p.id === product.id) && (
                                  <div className="absolute top-12 sm:top-16 right-3 sm:right-4">
                                    <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-xl animate-scale-in">
                                      <Check className="w-3.5 sm:w-4.5 h-3.5 sm:h-4.5 text-white" strokeWidth={3} />
                                    </div>
                                  </div>
                                )}

                                {/* 하단 정보 오버레이 */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
                                  <div className="space-y-1 sm:space-y-2">
                                    {product.brand && (
                                      <span className="inline-block px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur-sm rounded-full text-white/90">
                                        {product.brand}
                                      </span>
                                    )}
                                    <p className="font-semibold text-base sm:text-lg leading-tight line-clamp-2 text-white font-korean drop-shadow-lg">
                                      {product.name}
                                    </p>
                                    <p className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
                                      ₩{product.price.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* 스타일 태그 & 액션 영역 */}
                              <div className="p-3 sm:p-4 bg-card/95 backdrop-blur-sm space-y-3 sm:space-y-4">
                                {/* 스타일 태그 배지들 */}
                                {product.style_tags && product.style_tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                                    {product.style_tags.slice(0, 3).map((tag, tagIdx) => (
                                      <span
                                        key={tagIdx}
                                        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-semibold ${getTagColor(tag)}`}
                                      >
                                        <Tag className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                                        {tag}
                                      </span>
                                    ))}
                                    {product.style_tags.length > 3 && (
                                      <span className="px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-semibold bg-muted text-muted-foreground">
                                        +{product.style_tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* 액션 버튼들 */}
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => toggleTrendProduct(product)}
                                      className={`flex-1 text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 font-korean flex items-center justify-center gap-1.5 sm:gap-2 ${
                                        selectedTrendProducts.find(p => p.id === product.id)
                                          ? 'bg-gradient-to-r from-accent to-primary text-white shadow-lg shadow-accent/30 scale-[1.02]'
                                          : 'bg-secondary hover:bg-secondary/80 text-foreground hover:shadow-md'
                                      }`}
                                    >
                                      {selectedTrendProducts.find(p => p.id === product.id) ? (
                                        <>
                                          <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={2.5} />
                                          선택됨
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={2.5} />
                                          담기
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handlePurchase(product)}
                                      disabled={purchasingProductId === product.id}
                                      className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-secondary hover:bg-accent hover:text-white text-foreground transition-all duration-300 disabled:opacity-50 hover:shadow-md"
                                      title="구매하기"
                                    >
                                      {purchasingProductId === product.id ? (
                                        <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                                      ) : (
                                        <ExternalLink className="w-4 sm:w-5 h-4 sm:h-5" />
                                      )}
                                    </button>
                                  </div>
                                  {/* 다른 상품 보기 버튼 */}
                                  <button
                                    onClick={() => handleShowAlternatives(product.category, product.id)}
                                    className="w-full text-[10px] sm:text-xs py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-300 font-korean flex items-center justify-center gap-1.5 sm:gap-2 group"
                                  >
                                    <RefreshCw className="w-3 sm:w-3.5 h-3 sm:h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                                    다른 {product.category} 보기
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 좋아요한 아이템 표시 */}
                    {likedProducts.size > 0 && (
                      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 rounded-xl sm:rounded-2xl border border-red-100 dark:border-red-900/30">
                        <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                          <Heart className="w-3 sm:w-4 h-3 sm:h-4 text-red-500 fill-red-500" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium font-korean text-red-600 dark:text-red-400">
                          {likedProducts.size}개 상품을 좋아요 했어요!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 총 금액 카드 - 프리미엄 스타일 */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-card via-card to-secondary/50 border border-border/50 p-4 sm:p-5 shadow-lg">
                    {/* 배경 장식 */}
                    <div className="absolute top-0 right-0 w-20 sm:w-24 h-20 sm:h-24 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-tr from-primary/10 to-accent/10 rounded-full blur-2xl" />
                    
                    <div className="relative flex justify-between items-center">
                      {/* 선택 현황 */}
                      <div className="space-y-0.5 sm:space-y-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-korean">선택한 아이템</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl font-bold text-foreground">{selectedTrendProducts.length}</span>
                          <span className="text-xs sm:text-sm text-muted-foreground">/ {customResult.items.length}개</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-korean">총 금액</span>
                        <p className="font-display font-bold text-2xl sm:text-3xl bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                          ₩{selectedTrendProducts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
                        </p>
                        {/* 할인/절약 금액 표시 */}
                        {(() => {
                          const totalPrice = selectedTrendProducts.reduce((sum, p) => sum + p.price, 0);
                          const originalPrice = selectedTrendProducts.reduce((sum, p) => sum + (p.original_price || p.price), 0);
                          const savings = originalPrice - totalPrice;
                          const discountRate = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
                          
                          if (savings > 0) {
                            return (
                              <div className="flex items-center justify-end gap-1.5 mt-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                                  ₩{originalPrice.toLocaleString()}
                                </span>
                                <span className="text-[10px] sm:text-xs font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                  {discountRate}% 절약
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {/* Face Composite Option */}
              {userProfile?.avatar_url && (
                <div className="p-3 sm:p-4 rounded-xl border-2 border-border bg-secondary/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={userProfile.avatar_url} 
                          alt="Your face" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground font-korean text-sm sm:text-base truncate">내 얼굴 합성하기</p>
                        <p className="text-xs text-muted-foreground font-korean truncate">AI가 생성한 이미지에 내 얼굴을 합성합니다</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseFaceComposite(!useFaceComposite)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        useFaceComposite ? 'bg-accent' : 'bg-muted'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        useFaceComposite ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Daily Generation Limit Display */}
              <div className="p-3 sm:p-4 rounded-xl border-2 border-border bg-secondary/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {isPremium ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground font-korean text-sm sm:text-base truncate">
                        {isPremium ? '프리미엄 회원' : '오늘 남은 생성 횟수'}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground font-korean truncate">
                        {limitLoading ? (
                          '로딩 중...'
                        ) : isPremium ? (
                          '무제한 스타일 생성'
                        ) : (
                          `${remainingCount}회 남음 (일일 5회)`
                        )}
                      </p>
                    </div>
                  </div>
                  {!isPremium && remainingCount <= 2 && remainingCount > 0 && (
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full font-korean">
                      곧 소진
                    </span>
                  )}
                  {!isPremium && remainingCount === 0 && (
                    <span className="px-3 py-1 bg-destructive/20 text-destructive text-xs font-medium rounded-full font-korean">
                      소진됨
                    </span>
                  )}
                </div>
              </div>

              {/* Generate Button - 데스크탑용 (모바일에서는 하단 고정 버튼 사용) */}
              <Button
                variant="gold"
                size="xl"
                className="w-full font-korean hidden lg:flex"
                onClick={generateStyle}
                disabled={isGenerating || !canGenerate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    생성 중...
                  </>
                ) : !canGenerate ? (
                  <>
                    <Crown className="w-5 h-5" />
                    프리미엄으로 업그레이드
                  </>
                ) : (
                  <>
                    <img src={showmelookLogo} alt="" className="w-5 h-5 object-contain" />
                    {useFaceComposite && userProfile?.avatar_url ? '내 얼굴로 스타일 생성' : '스타일 생성하기'}
                  </>
                )}
              </Button>

              {/* Upgrade Prompt for non-premium users with low remaining */}
              {!isPremium && remainingCount <= 2 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <Crown className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm font-korean">프리미엄으로 업그레이드</p>
                      <p className="text-xs text-muted-foreground mt-1 font-korean">
                        무제한 스타일 생성, 고화질 이미지, 우선 처리 혜택을 누려보세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Generated Result - order-1 on mobile (shows first), order-2 on desktop */}
            {/* 모바일: 생성 중이거나 생성 완료된 경우에만 표시 / 데스크탑: 항상 표시 */}
            <div 
              ref={resultRef}
              className={`order-1 lg:order-2 w-full overflow-hidden space-y-4 self-start ${!isGenerating && !generatedImage ? 'hidden lg:block' : ''}`}
            >
              {/* 모바일: 전체 화면 폭에 맞춤 + 세로로 풀 이미지 표시, 데스크탑: aspect-ratio 유지 */}
              <div className="w-full aspect-[3/4] bg-secondary rounded-xl sm:rounded-2xl overflow-hidden border border-border relative max-h-[70vh] sm:max-h-none animate-fade-in">
                  {isGenerating ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent/5 via-primary/5 to-accent/10 overflow-hidden">
                      {/* 배경 파티클 효과 */}
                      <div className="absolute inset-0 overflow-hidden">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-2 h-2 rounded-full bg-accent/20"
                            style={{
                              left: `${Math.random() * 100}%`,
                              top: `${Math.random() * 100}%`,
                              animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
                              animationDelay: `${Math.random() * 2}s`,
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* 메인 로고 애니메이션 */}
                      <div className="relative z-10">
                        {/* 외부 회전 링 */}
                        <div className="absolute inset-[-20px] sm:inset-[-24px] flex items-center justify-center">
                          <div 
                            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-2 border-dashed border-accent/40"
                            style={{ animation: 'spin 8s linear infinite' }}
                          />
                        </div>
                        
                        {/* 펄스 링 애니메이션 */}
                        <div className="absolute inset-[-10px] sm:inset-[-12px] flex items-center justify-center">
                          <div className="w-24 sm:w-32 h-24 sm:h-32 rounded-full border-2 border-accent/30 animate-ping" style={{ animationDuration: '2s' }} />
                        </div>
                        
                        {/* 회전하는 그라데이션 링 */}
                        <div className="absolute inset-[-8px] sm:inset-[-10px] flex items-center justify-center">
                          <div 
                            className="w-24 sm:w-32 h-24 sm:h-32 rounded-full"
                            style={{
                              background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--accent)) 25%, transparent 50%, hsl(var(--primary)) 75%, transparent 100%)',
                              animation: 'spin 3s linear infinite',
                            }}
                          />
                        </div>
                        
                        {/* 내부 글로우 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div 
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-accent/10 blur-xl"
                            style={{ animation: 'pulse 2s ease-in-out infinite' }}
                          />
                        </div>
                        
                        {/* 로고 컨테이너 */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-2xl border-2 border-accent/30">
                          <img 
                            src={showmelookLogo} 
                            alt="" 
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                            style={{ animation: 'pulse 2s ease-in-out infinite' }}
                          />
                        </div>
                      </div>
                      
                      {/* 로딩 텍스트 with typing effect */}
                      <div className="mt-8 sm:mt-10 text-center px-4 z-10">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-lg sm:text-xl font-semibold text-foreground font-korean">
                            AI가 스타일을 만들고 있어요
                          </span>
                          <span className="flex gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent"
                                style={{
                                  animation: 'bounce 1s ease-in-out infinite',
                                  animationDelay: `${i * 0.2}s`,
                                }}
                              />
                            ))}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-muted-foreground mt-3 font-korean">
                          완벽한 룩을 찾는 중이에요 ✨
                        </p>
                      </div>
                      
                      {/* 프로그레스 바 */}
                      <div className="mt-6 sm:mt-8 w-48 sm:w-64 h-1.5 bg-secondary rounded-full overflow-hidden z-10">
                        <div 
                          className="h-full bg-gradient-to-r from-accent via-primary to-accent rounded-full"
                          style={{
                            animation: 'shimmer 2s ease-in-out infinite',
                            backgroundSize: '200% 100%',
                          }}
                        />
                      </div>
                      
                      {/* 패션 아이콘 애니메이션 */}
                      <div className="flex gap-4 mt-6 sm:mt-8 z-10">
                        {['👗', '👔', '👟', '👜', '🧥'].map((emoji, i) => (
                          <span
                            key={i}
                            className="text-xl sm:text-2xl"
                            style={{
                              animation: 'bounce 1.5s ease-in-out infinite',
                              animationDelay: `${i * 0.15}s`,
                            }}
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : generatedImage ? (
                    <GeneratedStyleImage
                      src={generatedImage}
                      alt="Generated style"
                      logoSrc={showmelookWatermarkFull}
                      isPremium={isPremium}
                      onShare={(platform, result) => {
                        if (result.message) {
                          toast({
                            title: result.success ? '성공' : '알림',
                            description: result.message,
                            variant: result.success ? 'default' : 'destructive',
                          });
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <img src={showmelookLogo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-50" />
                      <p className="text-base sm:text-lg font-medium font-korean">AI 스타일 미리보기</p>
                      <p className="text-xs sm:text-sm mt-2 font-korean">트렌드와 아이템을 선택하고 생성하세요</p>
                    </div>
                  )}
                </div>

              {/* 선택된 트렌드 상품 구매하기 - 모바일 캐러셀 */}
              {selectedTrendProducts.length > 0 && (
                <div className="mt-4 sm:mt-6 w-full">
                  <h3 className="font-medium text-foreground mb-2 sm:mb-3 font-korean text-sm sm:text-base">선택된 아이템 구매하기</h3>
                  
                  {/* 모바일: 가로 스와이프 캐러셀 */}
                  <div className="lg:hidden">
                    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
                      {selectedTrendProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex-shrink-0 w-[140px] snap-start bg-secondary rounded-xl p-3 flex flex-col"
                        >
                          {product.image_url && (
                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                              <ProductImage 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground font-korean text-xs line-clamp-2 mb-1">{product.name}</p>
                            {product.brand && (
                              <p className="text-[10px] text-accent truncate">{product.brand}</p>
                            )}
                            <p className="text-sm font-semibold text-foreground mt-1">
                              ₩{product.price.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addCachedProductToCart(product)}
                              className="flex-1 h-8 p-0"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="minimal"
                              size="sm"
                              onClick={() => handlePurchase(product)}
                              disabled={purchasingProductId === product.id}
                              className="flex-1 h-8 text-xs px-2"
                            >
                              {purchasingProductId === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                '구매'
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-1 font-korean">← 좌우로 스와이프 →</p>
                  </div>
                  
                  {/* 데스크탑: 기존 리스트 뷰 */}
                  <div className="hidden lg:block space-y-2 w-full">
                    {selectedTrendProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 p-3 bg-secondary rounded-xl w-full"
                      >
                        {product.image_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <ProductImage 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-foreground font-korean text-sm truncate">{product.name}</p>
                          {product.brand && (
                            <p className="text-xs text-accent truncate">{product.brand}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addCachedProductToCart(product)}
                            className="font-korean h-8 w-8 p-0"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="minimal"
                            size="sm"
                            onClick={() => handlePurchase(product)}
                            disabled={purchasingProductId === product.id}
                            className="font-korean text-sm px-3 h-8"
                          >
                            {purchasingProductId === product.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '구매'
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addAllToCart}
                      className="w-full font-korean text-xs sm:text-sm h-9 sm:h-10"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      전체 장바구니 담기
                    </Button>
                    <Button
                      variant="hero"
                      size="sm"
                      onClick={() => {
                        selectedTrendProducts.forEach((product, index) => {
                          setTimeout(() => handlePurchase(product), index * 300);
                        });
                      }}
                      className="w-full font-korean text-xs sm:text-sm h-9 sm:h-10"
                    >
                      <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      전체 구매하기
                    </Button>
                  </div>
                  <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-accent/10 rounded-lg sm:rounded-xl text-center">
                    <p className="text-xs sm:text-sm text-accent font-korean">
                      총 ₩{selectedTrendProducts.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* 기존 상품 테이블에서 선택한 아이템 */}
              {generatedImage && selectedProducts.length > 0 && (
                <div className="mt-4 sm:mt-6 w-full">
                  <h3 className="font-medium text-foreground mb-2 sm:mb-3 font-korean text-sm sm:text-base">기본 아이템 구매하기</h3>
                  <div className="space-y-2 w-full">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-secondary rounded-lg sm:rounded-xl w-full"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground font-korean text-xs sm:text-sm truncate">{product.name_ko}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => addToCart(product)}
                          className="font-korean text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8 flex-shrink-0"
                        >
                          담기
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="hero"
                    size="sm"
                    className="w-full mt-3 sm:mt-4 font-korean text-xs sm:text-sm h-9 sm:h-10"
                    onClick={() => navigate('/cart')}
                  >
                    장바구니로 이동
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'mylooks' ? (
          /* My Looks Grid with Infinite Scroll */
          <MyLooksGallery 
            myLooks={myLooks}
            setMyLooks={setMyLooks}
            setActiveTab={setActiveTab}
            toast={toast}
            isPremium={isPremium}
          />
        ) : (
          /* My Page */
          <div className="max-w-2xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-secondary border-4 border-accent/20">
                  {userProfile?.avatar_url ? (
                    <ProgressiveImage 
                      src={userProfile.avatar_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <User className="w-12 h-12 text-muted-foreground" />
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent/90 transition-colors">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <h2 className="font-korean text-2xl text-foreground mt-4">
                {userProfile?.full_name || user?.email?.split('@')[0] || '사용자'}
              </h2>
              <p className="text-muted-foreground font-korean">{user?.email}</p>
            </div>

            {/* Profile Info */}
            <div className="bg-secondary/50 rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-korean text-xl text-foreground">프로필 정보</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/profile-edit')} className="font-korean">
                    <Settings className="w-4 h-4 mr-1" />
                    전체 수정
                  </Button>
                  {!isEditingProfile && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)} className="font-korean">
                      빠른 수정
                    </Button>
                  )}
                {isEditingProfile && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsEditingProfile(false);
                      setEditForm({
                        height: userProfile?.height?.toString() || '',
                        weight: userProfile?.weight?.toString() || '',
                        body_type: userProfile?.body_type || '',
                        style_preferences: userProfile?.style_preferences || [],
                      });
                    }}>
                      취소
                    </Button>
                    <Button variant="hero" size="sm" onClick={saveProfile} disabled={isSavingProfile} className="font-korean">
                      {isSavingProfile ? '저장 중...' : '저장'}
                    </Button>
                  </>
                )}
                </div>
              </div>

              {isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-height" className="font-korean">키 (cm)</Label>
                      <Input
                        id="edit-height"
                        type="number"
                        placeholder="170"
                        value={editForm.height}
                        onChange={(e) => setEditForm(prev => ({ ...prev, height: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-weight" className="font-korean">몸무게 (kg)</Label>
                      <Input
                        id="edit-weight"
                        type="number"
                        placeholder="65"
                        value={editForm.weight}
                        onChange={(e) => setEditForm(prev => ({ ...prev, weight: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-korean">체형</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {bodyTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEditForm(prev => ({ ...prev, body_type: type.id }))}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            editForm.body_type === type.id
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <span className="text-foreground font-medium font-korean">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-korean">선호 스타일</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {styleOptions.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => toggleStylePreference(style.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-center relative ${
                            editForm.style_preferences.includes(style.id)
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          {editForm.style_preferences.includes(style.id) && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                          <span className="text-xl block mb-1">{style.emoji}</span>
                          <span className="text-foreground text-sm font-medium font-korean">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground font-korean">키</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.height ? `${userProfile.height}cm` : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground font-korean">몸무게</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.weight ? `${userProfile.weight}kg` : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2 font-korean">성별</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {userProfile?.gender === 'male' ? '남성' : 
                         userProfile?.gender === 'female' ? '여성' : 
                         userProfile?.gender === 'unisex' ? '유니섹스' : 
                         userProfile?.gender === 'prefer_not_to_say' ? '비공개' : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2 font-korean">체형</p>
                      <p className="text-lg font-medium text-foreground font-korean">
                        {bodyTypes.find(t => t.id === userProfile?.body_type)?.label || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-background rounded-xl">
                    <p className="text-sm text-muted-foreground mb-2 font-korean">선호 스타일</p>
                    <div className="flex flex-wrap gap-2">
                      {userProfile?.style_preferences?.length ? (
                        userProfile.style_preferences.map(styleId => {
                          const style = styleOptions.find(s => s.id === styleId);
                          return style ? (
                            <span key={styleId} className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-korean">
                              {style.emoji} {style.label}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-6 bg-secondary/50 rounded-2xl border border-border text-center">
                <p className="text-3xl font-korean text-foreground">{myLooks.length}</p>
                <p className="text-muted-foreground font-korean">생성된 룩</p>
              </div>
              <div className="p-6 bg-secondary/50 rounded-2xl border border-border text-center">
                <p className="text-3xl font-korean text-foreground">
                  {myLooks.filter(l => l.is_favorite).length}
                </p>
                <p className="text-muted-foreground font-korean">즐겨찾기</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 대체 상품 모달 */}
      {alternativeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* 모달 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur-sm">
              <div>
                <h3 className="font-semibold text-lg font-korean text-foreground">다른 {alternativeCategory} 보기</h3>
                <p className="text-xs text-muted-foreground font-korean">원하는 상품을 선택해 교체하세요</p>
              </div>
              <button
                onClick={() => setAlternativeModalOpen(false)}
                className="w-9 h-9 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {isLoadingAlternatives ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
                  <p className="text-muted-foreground font-korean text-sm">대체 상품을 찾고 있어요...</p>
                </div>
              ) : alternativeProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-korean">같은 카테고리의 다른 상품이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {alternativeProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectAlternative(product)}
                      className="group text-left rounded-xl border border-border hover:border-accent/50 bg-card overflow-hidden transition-all duration-200 hover:shadow-lg"
                    >
                      <div className="relative aspect-square bg-secondary overflow-hidden">
                        {product.image_url ? (
                          <ProductImage 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* 오버레이 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white font-semibold text-sm">
                            ₩{product.price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="p-2.5">
                        {product.brand && (
                          <p className="text-[10px] text-accent uppercase tracking-wide truncate">{product.brand}</p>
                        )}
                        <p className="text-xs font-medium text-foreground line-clamp-2 font-korean leading-tight mt-0.5">
                          {product.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모바일 하단 고정 생성 버튼 */}
      {activeTab === 'generate' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border lg:hidden z-40 animate-fade-in">
          <Button
            variant="gold"
            size="lg"
            className="w-full font-korean shadow-lg shadow-accent/20"
            onClick={generateStyle}
            disabled={isGenerating || !canGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                생성 중...
              </>
            ) : !canGenerate ? (
              <>
                <Crown className="w-5 h-5" />
                프리미엄으로 업그레이드
              </>
            ) : (
              <>
                <img src={showmelookLogo} alt="" className="w-5 h-5 object-contain" />
                {useFaceComposite && userProfile?.avatar_url ? '내 얼굴로 스타일 생성' : '스타일 생성하기'}
              </>
            )}
          </Button>
          {/* 남은 횟수 표시 */}
          {!isPremium && (
            <p className="text-center text-xs text-muted-foreground mt-2 font-korean">
              오늘 {remainingCount}회 남음
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default StyleGenerator;
