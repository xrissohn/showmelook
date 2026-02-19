import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreloadedData } from '@/contexts/DataPreloaderContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useGenerationLimit } from '@/hooks/useGenerationLimit';
import { useSubscription } from '@/hooks/useSubscription';
import { usePurchaseStats } from '@/hooks/usePurchaseStats';
import { useFeedback } from '@/hooks/useFeedback';
import { useGenerationQueue } from '@/hooks/useGenerationQueue';
import { ShoppingBag, Heart, LogOut, ChevronRight, Loader2, User, Camera, Check, Zap, Crown, Settings, Sparkles, ExternalLink, Plus, ChevronLeft, Tag, RefreshCw, X, ImageOff, Download, Share2, Trash2, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Images, Lock, RotateCcw, Lightbulb, MessageCircle, Globe, LockKeyhole } from 'lucide-react';
import { TierBadge } from '@/components/ui/tier-badge';
import { TIER_CONFIG } from '@/lib/tierConfig';
import { InteractiveProductTags } from '@/components/style/InteractiveProductTags';
import { Skeleton } from '@/components/ui/skeleton';
import showmelookLogo from '@/assets/showmelook-logo.webp';
import showmelookWatermarkFull from '@/assets/showmelook-watermark-full.png';
import MainNavigation from '@/components/MainNavigation';
import useEmblaCarousel from 'embla-carousel-react';
import { LazyImage } from '@/components/LazyImage';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { LimitReachedBanner } from '@/components/subscription/LimitReachedBanner';
import { ProfileSelector, SelectedProfile } from '@/components/style/ProfileSelector';
import { getProductAffiliateDisclosure } from '@/lib/affiliateDisclosure';
import { LoadingProductAds } from '@/components/style/LoadingProductAds';
import { GenerationProgress } from '@/components/style/GenerationProgress';
import { MobilePurchaseCarousel } from '@/components/style/MobilePurchaseCarousel';
import { WatermarkOverlay, GalleryWatermarkOverlay, ModalWatermarkOverlay } from '@/components/style/WatermarkOverlay';
import { SEOHead } from '@/components/SEOHead';
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
  merchant_id?: string | null;
}

interface GeneratedLook {
  id: string;
  image_url: string;
  is_favorite: boolean;
  is_public?: boolean;
  created_at: string;
  memo?: string | null;
  tags?: string[] | null;
  prompt_used?: string | null;
  style_trend_id?: string | null;
  product_ids?: string[] | null;
  style_reasoning?: string | null;
  like_count?: number;
  caption?: string | null;
}

interface UserProfile {
  height: number | null;
  weight: number | null;
  body_type: string | null;
  style_preferences: string[] | null;
  avatar_url: string | null;
  full_name: string | null;
  gender: string | null;
  age_group: string | null;
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

// Pre-calculated particle positions for consistent animations (no Math.random() during render)
const loadingParticles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size: 4 + (i % 5) * 2,
  left: (i * 5) % 100,
  delay: (i * 0.2) % 4,
  duration: 3 + (i % 4),
  drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 6) * 8),
  color: i % 3,
}));

// Pre-calculated orbit dot positions
const orbitDots = [
  { id: 0, radius: 52, duration: 4, delay: 0 },
  { id: 1, radius: 60, duration: 5.5, delay: 0.6 },
  { id: 2, radius: 68, duration: 7, delay: 1.2 },
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
// 해시태그 생성 함수
const generateHashtags = (prompt?: string, tags?: string[]): string => {
  const baseHashtags = ['#ShowMeLook', '#AI패션', '#스타일추천'];
  const dynamicHashtags: string[] = [];
  
  // 태그에서 해시태그 생성
  if (tags && tags.length > 0) {
    tags.slice(0, 5).forEach(tag => {
      // 공백 제거하고 해시태그로 변환
      const cleanTag = tag.replace(/\s+/g, '').replace(/[^가-힣a-zA-Z0-9]/g, '');
      if (cleanTag && cleanTag.length > 1) {
        dynamicHashtags.push(`#${cleanTag}`);
      }
    });
  }
  
  // 프롬프트에서 키워드 추출
  if (prompt) {
    const styleKeywords = [
      '캐주얼', '미니멀', '스트릿', '클래식', '스포티', '모던', '빈티지', '시크',
      '데일리', '오피스', '데이트', '여행', '파티', '포멀', '럭셔리', '키치',
      '로맨틱', '보헤미안', '프레피', '아티스틱', '이지웨어', '액티브',
      'casual', 'minimal', 'street', 'classic', 'sporty', 'modern', 'vintage', 'chic'
    ];
    
    styleKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword.toLowerCase())) {
        const hashTag = `#${keyword.replace(/\s+/g, '')}`;
        if (!dynamicHashtags.includes(hashTag) && !baseHashtags.includes(hashTag)) {
          dynamicHashtags.push(hashTag);
        }
      }
    });
  }
  
  // 최대 8개의 해시태그로 제한
  const allHashtags = [...baseHashtags, ...dynamicHashtags.slice(0, 5)];
  return allHashtags.join(' ');
};

const shareToSNS = async (
  imageUrl: string, 
  platform: 'instagram' | 'twitter' | 'facebook' | 'kakao' | 'copy',
  addWatermark: boolean = false,
  logoUrl?: string,
  lookId?: string,
  prompt?: string,
  tags?: string[]
) => {
  const hashtags = generateHashtags(prompt, tags);
  const shareText = `👗 ShowMeLook AI가 만든 나만의 스타일을 확인해보세요!\n\n${hashtags}`;
  // 커스텀 도메인 showmelook.com을 기본 URL로 사용
  const baseUrl = 'https://showmelook.com';
  const shareUrl = lookId 
    ? `${baseUrl}/look/${lookId}` 
    : baseUrl;
  
  // Facebook/Twitter 크롤러용 URL: share-preview Edge Function이 OG 메타 태그를 서버사이드로 렌더링
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const crawlerShareUrl = lookId 
    ? `${supabaseUrl}/functions/v1/share-preview?lookId=${lookId}`
    : baseUrl;

  // 공유 시 is_public을 true로 설정하여 다른 사람도 볼 수 있게 함
  if (lookId) {
    try {
      await supabase
        .from('generated_looks')
        .update({ is_public: true })
        .eq('id', lookId);
    } catch (e) {
      console.error('Failed to make look public:', e);
    }
  }

  switch (platform) {
    case 'instagram':
      // 모바일 감지
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        try {
          // 클립보드에 해시태그 복사
          try {
            await navigator.clipboard.writeText(hashtags);
          } catch (err) {
            console.log('해시태그 복사 실패');
          }
          
          // 이미지를 Blob으로 변환하여 Web Share API로 공유 시도
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'showmelook-style.jpg', { type: 'image/jpeg' });
          
          // Web Share API로 직접 공유 (갤러리 저장 및 앱 선택 가능)
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: '👗 ShowMeLook AI 스타일',
                text: hashtags,
              });
              return { 
                success: true, 
                message: '📸 공유 완료!\n해시태그가 클립보드에 복사되었습니다.' 
              };
            } catch (shareErr) {
              // 사용자가 공유 취소한 경우 - 에러 아님
              if ((shareErr as Error).name === 'AbortError') {
                return { success: true, message: '공유가 취소되었습니다.' };
              }
              console.log('Web Share API failed:', shareErr);
            }
          }
          
          // Web Share API 실패 시 - 다운로드 후 인스타그램 딥링크
          // 이미지 다운로드를 위해 a 태그 사용 (모바일 갤러리 저장)
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = 'showmelook-style.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          
          // 다운로드 후 인스타그램 앱 열기
          setTimeout(() => {
            // 인스타그램 스토리 카메라 딥링크
            window.location.href = 'instagram://story-camera';
          }, 1000);
          
          return { 
            success: true, 
            message: '📸 이미지가 저장되었습니다!\n\n1️⃣ 인스타그램이 열리면\n2️⃣ 갤러리에서 저장된 이미지를 선택하세요\n3️⃣ 해시태그를 붙여넣기 해주세요' 
          };
        } catch (err) {
          console.log('Instagram share failed:', err);
        }
      }
      
      // 데스크톱이거나 딥링크 실패시 기존 방식
      const downloadedDesktop = await downloadImage(
        imageUrl, 
        'showmelook-style-instagram.png',
        addWatermark,
        logoUrl
      );
      if (downloadedDesktop) {
        // 클립보드에 해시태그 복사
        try {
          await navigator.clipboard.writeText(hashtags);
        } catch (err) {
          console.log('해시태그 복사 실패');
        }
        return { 
          success: true, 
          message: '📸 이미지가 저장되었습니다!\n해시태그가 복사되었으니 인스타그램에 붙여넣기 해주세요.' 
        };
      }
      return { success: false, message: '이미지 저장에 실패했습니다.' };

    case 'twitter':
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(crawlerShareUrl)}`,
        '_blank',
        'width=600,height=400'
      );
      return { success: true };

    case 'facebook':
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(crawlerShareUrl)}&quote=${encodeURIComponent(shareText)}`,
        '_blank',
        'width=600,height=400'
      );
      return { success: true };

    case 'kakao':
      // 카카오톡 SDK 공유
      try {
        const Kakao = (window as any).Kakao;
        
        if (!Kakao) {
          console.error('Kakao SDK not loaded');
          // SDK 로드 실패 시 링크 복사로 fallback
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 SDK 로딩 실패. 링크가 복사되었습니다!' };
        }
        
        // main.tsx에서 초기화 시도했지만 실패했을 수 있으므로 재시도
        if (!Kakao.isInitialized()) {
          const kakaoKey = 'e5f9085240afd55f52cc0a0a37081761';
          try {
            Kakao.init(kakaoKey);
            console.log('Kakao SDK initialized in shareToSNS');
          } catch (initErr) {
            console.error('Kakao init error:', initErr);
          }
        }
        
        if (!Kakao.isInitialized()) {
          console.error('Kakao SDK not initialized. Key available:', !!import.meta.env.VITE_KAKAO_JS_KEY);
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 초기화 실패. 링크가 복사되었습니다!' };
        }
        
        // 카카오톡 이미지: 원본 세로 이미지 그대로 사용 (카카오가 자체 크롭하지만 해상도가 높아 전신이 더 잘 보임)
        let kakaoImageUrl = imageUrl;
        
        // 카카오톡 공유 URL - 카카오 SDK는 등록된 도메인(showmelook.com)만 허용
        // Edge Function URL(supabase.co 도메인)을 넣으면 홈페이지로 리다이렉트됨
        const kakaoShareUrl = shareUrl; // shareUrl = showmelook.com/look/${lookId}
        
        // 카카오톡 공유하기
        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: '👗 쇼미룩 AI 스타일',
            description: prompt ? prompt.slice(0, 80) : 'AI가 만든 나만의 스타일을 확인해보세요!',
            imageUrl: kakaoImageUrl,
            link: {
              mobileWebUrl: kakaoShareUrl,
              webUrl: kakaoShareUrl,
            },
          },
          buttons: [
            {
              title: '스타일 보기',
              link: {
                mobileWebUrl: kakaoShareUrl,
                webUrl: kakaoShareUrl,
              },
            },
          ],
        });
        return { success: true };
      } catch (err) {
        console.error('Kakao share error:', err);
        // 에러 시 링크 복사로 fallback
        try {
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 공유 실패. 링크가 복사되었습니다!' };
        } catch {
          return { success: false, message: '공유에 실패했습니다.' };
        }
      }

    case 'copy':
      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        return { success: true, message: '링크와 해시태그가 복사되었습니다!' };
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
  hasWatermark = true, // Pro 이상이면 false
  logoUrl,
  lookId,
  prompt,
  tags
}: {
  imageUrl: string; 
  onShare?: (platform: string, result: { success: boolean; message?: string }) => void;
  className?: string;
  compact?: boolean;
  hasWatermark?: boolean; // Pro 이상이면 false
  logoUrl?: string;
  lookId?: string;
  prompt?: string;
  tags?: string[];
}) => {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // hasWatermark가 true면 워터마크 추가 (Free 회원)
  const shouldAddWatermark = hasWatermark ?? true;

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
      ? !shouldAddWatermark 
        ? '이미지가 저장되었습니다!' 
        : '이미지가 저장되었습니다! (워터마크 포함)'
      : '저장에 실패했습니다.';
    onShare?.('download', { success, message });
  };

  const handleShare = async (platform: 'instagram' | 'twitter' | 'facebook' | 'kakao' | 'copy') => {
    const result = await shareToSNS(imageUrl, platform, shouldAddWatermark, logoUrl, lookId, prompt, tags);
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
          title={!shouldAddWatermark ? '이미지 저장' : '이미지 저장 (워터마크 포함)'}
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
          <Popover open={isShareOpen} onOpenChange={setIsShareOpen}>
            <PopoverTrigger asChild>
              <span className="sr-only">공유 메뉴 열기</span>
            </PopoverTrigger>
            <PopoverContent 
              align="end" 
              side="bottom" 
              sideOffset={8}
              className="w-[180px] p-2 z-[9999]"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {shouldAddWatermark && (
                <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    첫 구매 시 워터마크 없이 저장
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
            </PopoverContent>
          </Popover>
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
        title={!shouldAddWatermark ? '이미지 저장' : '이미지 저장 (워터마크 포함)'}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <Download className="w-4 h-4 mr-1.5" />
        )}
        저장{shouldAddWatermark && ' 🏷️'}
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
              {shouldAddWatermark && (
                <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    첫 구매 시 워터마크 없이 저장
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

// 메인 생성 이미지용 컴포넌트 (로고 워터마크 + 퍼센트 로딩 + 파티클 + 인터랙티브 태그)
interface GeneratedStyleImageProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
  product_url: string;
  category: string;
  affiliate_url?: string;
}

const GeneratedStyleImage = ({ 
  src, 
  alt,
  logoSrc,
  onShare,
  hasWatermark = true, // Pro 이상이면 false
  products = [],
  onProductPurchase,
  onProductAddToCart,
  onProductLike,
  likedProducts = new Set(),
  purchasingProductId,
  lookId,
  prompt,
  tags,
}: { 
  src: string; 
  alt: string;
  logoSrc: string;
  onShare?: (platform: string, result: { success: boolean; message?: string }) => void;
  hasWatermark?: boolean;
  products?: GeneratedStyleImageProduct[];
  onProductPurchase?: (product: GeneratedStyleImageProduct) => void;
  onProductAddToCart?: (product: GeneratedStyleImageProduct) => void;
  onProductLike?: (product: GeneratedStyleImageProduct) => void;
  likedProducts?: Set<string>;
  purchasingProductId?: string | null;
  lookId?: string;
  prompt?: string;
  tags?: string[];
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
            className={`w-full h-full object-contain transition-all duration-1000 ease-out ${
              isLoading 
                ? 'blur-2xl scale-110 opacity-0' 
                : 'blur-0 scale-100 opacity-100'
            }`}
          />
          {/* 무료 플랜 워터마크 오버레이 */}
          {!isLoading && <WatermarkOverlay show={hasWatermark} size="medium" />}
          {/* 인터랙티브 상품 태그 */}
          {!isLoading && products.length > 0 && onProductPurchase && (
            <InteractiveProductTags
              products={products}
              onPurchase={onProductPurchase}
              onAddToCart={onProductAddToCart}
              onLike={onProductLike}
              likedProducts={likedProducts}
              purchasingProductId={purchasingProductId}
              imageUrl={src}
              enableAIPositioning={true}
            />
          )}
          {/* 저장/공유 버튼 오버레이 */}
          {!isLoading && (
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <ShareButtons imageUrl={src} onShare={onShare} compact hasWatermark={hasWatermark} logoUrl={logoSrc} lookId={lookId} prompt={prompt} tags={tags} />
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
  hasWatermark: boolean; // Pro 이상이면 false
}

const MyLooksGallery = ({ myLooks, setMyLooks, setActiveTab, toast, hasWatermark }: MyLooksGalleryProps) => {
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
  
  // 상품 태그 상태
  const [lookProducts, setLookProducts] = useState<CachedProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set());
  
  // 카드 플립 상태
  const [isFlipped, setIsFlipped] = useState(false);
  
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
  
  // 선택된 룩의 상품 정보 로드
  useEffect(() => {
    if (!selectedLook?.product_ids?.length) {
      setLookProducts([]);
      return;
    }
    
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const { data, error } = await supabase
          .from('products_cache')
          .select('*')
          .in('id', selectedLook.product_ids!)
          .eq('is_active', true);
        
        if (error) throw error;
        
        if (data) {
          const products: CachedProduct[] = data.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            price: p.price,
            image_url: p.image_url,
            product_url: p.product_url,
            category: p.category,
            style_tags: p.style_tags,
          }));
          setLookProducts(products);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
        setLookProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    
    loadProducts();
  }, [selectedLook?.id, selectedLook?.product_ids]);
  
  // 좋아요 상품 로드
  useEffect(() => {
    const loadLikedProducts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('liked_products')
        .select('product_id')
        .eq('user_id', user.id);
      
      if (data) {
        setLikedProducts(new Set(data.map(d => d.product_id)));
      }
    };
    
    loadLikedProducts();
  }, []);
  
  // 상품 구매 핸들러
  const handleProductPurchase = async (product: CachedProduct) => {
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
      // Get auth token for deeplink tracking
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: product.product_url },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });
      
      if (error) throw error;
      
      if (data?.success && data?.affiliate_url) {
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
      } else {
        window.open(product.product_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Deeplink error:', error);
      window.open(product.product_url, '_blank', 'noopener,noreferrer');
    } finally {
      setPurchasingProductId(null);
    }
  };
  
  // 상품 좋아요 토글
  const handleProductLike = async (product: CachedProduct) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: '로그인 필요',
        description: '좋아요를 하려면 로그인이 필요합니다.',
        variant: 'destructive',
      });
      return;
    }
    
    const isLiked = likedProducts.has(product.id);
    
    try {
      if (isLiked) {
        await supabase
          .from('liked_products')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        
        setLikedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
      } else {
        await supabase
          .from('liked_products')
          .insert({
            user_id: user.id,
            product_id: product.id,
            product_name: product.name,
            product_brand: product.brand,
            product_price: product.price,
            product_image_url: product.image_url,
            product_url: product.product_url,
            product_category: product.category,
            style_tags: product.style_tags,
          });
        
        setLikedProducts(prev => new Set([...prev, product.id]));
      }
    } catch (error) {
      console.error('Like toggle error:', error);
    }
  };
  
  // 룩 클릭 핸들러
  const handleLookClick = (look: GeneratedLook, index: number) => {
    if (isSelectMode) {
      toggleSelect(look.id);
    } else {
      setSelectedLook(look);
      setCurrentIndex(index);
      setIsEditingMemo(false);
      setIsFlipped(false); // 플립 상태 초기화
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

  // 공개/비공개 토글
  const togglePublic = async (look: GeneratedLook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newPublic = !look.is_public;
    const { error } = await supabase
      .from('generated_looks')
      .update({ is_public: newPublic })
      .eq('id', look.id);
    
    if (!error) {
      setMyLooks(prev => prev.map(l => 
        l.id === look.id ? { ...l, is_public: newPublic } : l
      ));
      if (selectedLook?.id === look.id) {
        setSelectedLook({ ...look, is_public: newPublic });
      }
      toast({
        title: newPublic ? '갤러리에 공개됨' : '비공개로 전환',
        description: newPublic ? '이 룩이 스타일 갤러리에 공개됩니다.' : '이 룩이 비공개로 전환되었습니다.',
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
              {showFavoritesOnly ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFavoritesOnly(false)}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="font-korean">전체 갤러리</span>
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFavoritesOnly(true)}
                    className="flex items-center gap-1"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="font-korean hidden sm:inline">즐겨찾기</span>
                    {favoriteCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                        {favoriteCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const allPublic = myLooks.every(l => l.is_public);
                      const newPublic = !allPublic;
                      const ids = myLooks.map(l => l.id);
                      const { error } = await supabase
                        .from('generated_looks')
                        .update({ is_public: newPublic })
                        .in('id', ids);
                      if (!error) {
                        setMyLooks(prev => prev.map(l => ({ ...l, is_public: newPublic })));
                        toast({
                          title: newPublic ? '전체 공개됨 🌐' : '전체 비공개됨 🔒',
                          description: newPublic ? '모든 룩이 커뮤니티에 공개됩니다.' : '모든 룩이 비공개로 전환되었습니다.',
                        });
                      }
                    }}
                    className="flex items-center gap-1"
                  >
                    {myLooks.every(l => l.is_public) ? <LockKeyhole className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    <span className="font-korean hidden sm:inline">
                      {myLooks.every(l => l.is_public) ? '전체 비공개' : '전체 공개'}
                    </span>
                  </Button>
                </>
              )}
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
              
              {/* 무료 플랜 워터마크 오버레이 */}
              <GalleryWatermarkOverlay show={hasWatermark} />
              
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
              
              {/* 공개/비공개 표시 */}
              {!isSelectMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    togglePublic(look);
                  }}
                  className={`absolute top-3 ${look.is_favorite ? 'left-10' : 'left-3'} z-20 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    look.is_public ? 'bg-primary/80 text-primary-foreground hover:bg-primary' : 'bg-black/40 text-white/70 hover:bg-black/60'
                  } backdrop-blur-sm`}
                  title={look.is_public ? '공개 중 (클릭하여 비공개로 변경)' : '비공개 (클릭하여 공개로 변경)'}
                >
                  {look.is_public ? <Globe className="w-3.5 h-3.5" /> : <LockKeyhole className="w-3.5 h-3.5" />}
                </button>
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
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 더 보기 */}
      {visibleItems.length < filteredLooks.length && (
        <div className="text-center mt-6">
          <Button
            variant="outline"
            onClick={() => setVisibleCount(prev => prev + 12)}
            className="font-korean"
          >
            더 보기 ({filteredLooks.length - visibleItems.length}개 남음)
          </Button>
        </div>
      )}

      {/* 벌크 삭제 확인 다이얼로그 */}
      {showBulkDeleteConfirm && (
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-korean">선택한 룩 삭제</AlertDialogTitle>
              <AlertDialogDescription className="font-korean">
                {selectedIds.size}개의 룩을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-korean">취소</AlertDialogCancel>
              <AlertDialogAction
                className="font-korean bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleBulkDelete}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

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


              {/* Profile Selection for Style Generation (Premium: can select family) */}
              <ProfileSelector
                userId={user?.id}
                userProfile={userProfile}
                isPremium={isPremium}
                canUseFamilyProfiles={subscription.canUseFamilyProfiles}
                selectedProfile={selectedGenerationProfile}
                isProfileLoading={isPreloadingProfile}
                onProfileSelect={(profile) => {
                  setSelectedGenerationProfile(profile);
                  // 선택된 프로필의 성별을 customGender에 자동 반영
                  if (profile.gender) {
                    const genderMap: Record<string, 'female' | 'male' | 'unisex' | 'kids'> = {
                      '여성': 'female',
                      '남성': 'male',
                      'female': 'female',
                      'male': 'male',
                      'unisex': 'unisex',
                      '유니섹스': 'unisex',
                      'kids': 'kids',
                      '키즈': 'kids',
                    };
                    const mappedGender = genderMap[profile.gender.toLowerCase()] || genderMap[profile.gender];
                    if (mappedGender) {
                      setCustomGender(mappedGender);
                    }
                  }
                }}
              />


              {/* Daily Generation Limit Display */}
              <div className="p-3 sm:p-4 rounded-xl border-2 border-border bg-secondary/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* 등급별 아이콘 */}
                    {currentTier === 'platinum' ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    ) : currentTier === 'gold' ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                      </div>
                    ) : currentTier === 'silver' ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    ) : currentTier === 'bronze' ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-700 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TierBadge tier={currentTier} size="sm" showTooltip={true} />
                        <span className="font-medium text-foreground font-korean text-sm sm:text-base truncate">
                          {isPremium ? '무제한 생성' : '오늘 남은 횟수'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground font-korean truncate">
                        {limitLoading ? (
                          '로딩 중...'
                        ) : isPremium ? (
                          '모든 기능 무제한'
                        ) : bonusCredits > 0 ? (
                          `기본 ${remainingCount}회 + 보너스 ${bonusCredits}회`
                        ) : (
                          `${remainingCount}회 남음 (일일 ${TIER_CONFIG[currentTier]?.dailyLimit || 5}회)`
                        )}
                      </p>
                    </div>
                  </div>
                  {!isPremium && totalRemaining <= 2 && totalRemaining > 0 && (
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full font-korean">
                      곧 소진
                    </span>
                  )}
                  {!isPremium && totalRemaining === 0 && (
                    <span className="px-3 py-1 bg-destructive/20 text-destructive text-xs font-medium rounded-full font-korean">
                      소진됨
                    </span>
                  )}
                  {!isPremium && bonusCredits > 0 && totalRemaining > 2 && (
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-xs font-medium rounded-full font-korean flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      보너스
                    </span>
                  )}
                </div>
              </div>

              {/* Generate Button - 데스크탑용 (모바일에서는 하단 고정 버튼 사용) */}
              <Button
                variant="gold"
                size="xl"
                className="w-full font-korean hidden lg:flex"
                onClick={(customStylePrompt.trim() && !customResult) ? generateStyleWithRecommendation : generateStyle}
                disabled={isGenerating || isCustomSearching || !canGenerate || !isProfileDataReady || (!customStylePrompt.trim() && selectedTrendProducts.length === 0)}
              >
                {isGenerating || isCustomSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isCustomSearching && !isGenerating ? 'AI가 스타일을 분석중...' : '생성 중...'}
                  </>
                ) : !isProfileDataReady ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    프로필 로딩 중...
                  </>
                ) : !canGenerate ? (
                  <>
                    <Crown className="w-5 h-5" />
                    한도 도달 - 쇼핑으로 등급 UP!
                  </>
                ) : (
                  <>
                    <img src={showmelookLogo} alt="" className="w-5 h-5 object-contain" />
                    스타일 생성
                  </>
                )}
              </Button>

              {/* Upgrade Prompt for users with low remaining */}
              {remainingCount <= 2 && remainingCount > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30">
                  <div className="flex items-start gap-3">
                    <Crown className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm font-korean">등급이 높아지면 더 많이!</p>
                      <p className="text-xs text-muted-foreground mt-1 font-korean">
                        쇼미룩에서 상품을 구매하면 등급이 올라가고 일일 한도가 늘어나요.
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
              className={`order-1 lg:order-2 w-full overflow-hidden space-y-4 self-start ${!isGenerating && !isCustomSearching && !generatedImage ? 'hidden lg:block' : ''} ${(isGenerating || isCustomSearching) ? 'mt-2 sm:mt-0' : ''}`}
            >
              {/* 모바일/태블릿/PC: 각 디바이스에 맞게 전신이 보이도록 최적화 */}
              <div className={`w-full bg-secondary rounded-xl sm:rounded-2xl overflow-hidden border border-border relative animate-fade-in ${(isGenerating || isCustomSearching) ? 'h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] lg:h-[calc(100vh-100px)]' : 'aspect-[3/4] max-h-[calc(100vh-120px)] md:max-h-[calc(100vh-80px)] lg:max-h-[calc(100vh-100px)] mx-auto lg:mx-0'}`}>
                  {(isGenerating || isCustomSearching) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent/5 via-primary/5 to-accent/10 overflow-hidden relative">
                      {/* 배경 파티클 효과 - 고정된 위치 */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {loadingParticles.map((p) => (
                          <div
                            key={p.id}
                            className="absolute rounded-full animate-float-particle"
                            style={{
                              width: p.size,
                              height: p.size,
                              left: `${p.left}%`,
                              bottom: 0,
                              background: p.color === 0 
                                ? 'hsl(var(--accent))' 
                                : p.color === 1 
                                  ? 'hsl(var(--primary))' 
                                  : 'hsl(var(--magenta))',
                              animationDelay: `${p.delay}s`,
                              animationDuration: `${p.duration}s`,
                              '--drift': `${p.drift}px`,
                            } as React.CSSProperties}
                          />
                        ))}
                      </div>
                      
                      {/* 메인 로고 애니메이션 - 개선된 버전 */}
                      <div className="relative z-10">
                        {/* 확장되는 링 이펙트 */}
                        <div className="absolute inset-[-40px] sm:inset-[-48px] flex items-center justify-center">
                          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border-2 border-accent/30 animate-ring-expand" />
                        </div>
                        <div className="absolute inset-[-40px] sm:inset-[-48px] flex items-center justify-center">
                          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border border-primary/20 animate-ring-expand" style={{ animationDelay: '1s' }} />
                        </div>
                        
                        {/* 외부 점선 회전 링 */}
                        <div className="absolute inset-[-32px] sm:inset-[-36px] flex items-center justify-center">
                          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-dashed border-accent/40 animate-spin-slow" />
                        </div>
                        
                        {/* 회전하는 그라데이션 링 */}
                        <div className="absolute inset-[-16px] sm:inset-[-20px] flex items-center justify-center">
                          <div 
                            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full animate-spin-reverse"
                            style={{
                              background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--accent)) 15%, transparent 30%, hsl(var(--primary)) 50%, transparent 65%, hsl(var(--magenta)) 85%, transparent 100%)',
                              filter: 'blur(2px)',
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        
                        {/* 내부 글로우 효과 */}
                        <div className="absolute inset-[-8px] sm:inset-[-10px] flex items-center justify-center">
                          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-accent/30 via-primary/20 to-magenta/30 animate-pulse-glow" />
                        </div>
                        
                        {/* 로고 컨테이너 - 회전 그라데이션 배경을 로고 뒤로 이동하여 투명도 유지 */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center">
                          {/* 배경 원 (로고 뒤) */}
                          <div className="absolute inset-0 rounded-full bg-background shadow-2xl border-2 border-accent/40" />
                          {/* 회전하는 글로우 링 (로고 뒤) */}
                          <div 
                            className="absolute inset-[-4px] rounded-full opacity-60"
                            style={{
                              background: 'conic-gradient(from 0deg, hsl(var(--accent)), hsl(var(--primary)), hsl(var(--magenta)), hsl(var(--accent)))',
                              filter: 'blur(8px)',
                              animation: 'spin 8s linear infinite',
                            }}
                          />
                          {/* 로고 이미지 - 글로우 애니메이션, 투명 배경 유지 */}
                          <img 
                            src={showmelookLogo} 
                            alt="" 
                            className="w-14 h-14 sm:w-16 sm:h-16 object-contain relative z-10"
                            style={{
                              animation: 'logo-glow 3s ease-in-out infinite',
                            }}
                          />
                        </div>
                        
                        {/* 궤도를 도는 작은 점들 */}
                        {orbitDots.map((dot) => (
                          <div
                            key={dot.id}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ 
                              animation: `orbit ${dot.duration}s linear infinite`,
                              animationDelay: `${dot.delay}s`,
                              '--orbit-radius': `${dot.radius}px`,
                            } as React.CSSProperties}
                          >
                            <div 
                              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
                              style={{ 
                                background: dot.id === 0 
                                  ? 'hsl(var(--accent))' 
                                  : dot.id === 1 
                                    ? 'hsl(var(--primary))' 
                                    : 'hsl(var(--magenta))',
                                boxShadow: `0 0 12px ${dot.id === 0 ? 'hsl(var(--accent))' : dot.id === 1 ? 'hsl(var(--primary))' : 'hsl(var(--magenta))'}`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* 로딩 텍스트 - 상품 추천 중일 때는 다른 문구 */}
                      <div className="mt-12 sm:mt-14 text-center px-4 z-10">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-lg sm:text-xl font-semibold text-foreground font-korean">
                            {isCustomSearching ? 'AI가 스타일을 분석중' : 'AI가 스타일을 만들고 있어요'}
                          </span>
                          <span className="flex gap-0.5 ml-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r from-accent to-primary animate-bounce-dot"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-muted-foreground mt-3 font-korean">
                          {isCustomSearching ? '딱 맞는 상품을 찾고 있어요 🔍' : '완벽한 룩을 찾는 중이에요 ✨'}
                        </p>
                      </div>
                      
                      {/* 모든 회원에게 추천 상품 슬라이드 표시 */}
                      {loadingAdsProducts.length > 0 && (
                        <LoadingProductAds
                          products={loadingAdsProducts}
                          onProductClick={handleAdsProductClick}
                        />
                      )}
                      
                      {/* 프로그레스 바 - 개선된 shimmer */}
                      <div className="mt-6 sm:mt-8 w-48 sm:w-64 h-2.5 bg-secondary/50 rounded-full overflow-hidden z-10 relative">
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-accent via-primary via-60% to-magenta rounded-full animate-shimmer"
                          style={{ backgroundSize: '200% 100%' }}
                        />
                        {/* 글로우 오버레이 */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full animate-shimmer"
                          style={{ backgroundSize: '200% 100%', animationDelay: '0.5s' }}
                        />
                      </div>
                      
                      {/* 패션 아이콘 애니메이션 - 추천 상품이 없을 때만 표시 */}
                      {loadingAdsProducts.length === 0 && (
                        <div className="flex gap-4 mt-6 sm:mt-8 z-10">
                          {['👗', '👔', '👟', '👜', '🧥'].map((emoji, i) => (
                            <span
                              key={i}
                              className="text-xl sm:text-2xl drop-shadow-md animate-bounce-dot"
                              style={{ animationDelay: `${i * 0.12}s` }}
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : generatedImage ? (
                    <GeneratedStyleImage
                      src={generatedImage}
                      alt="Generated style"
                      logoSrc={showmelookWatermarkFull}
                      hasWatermark={subscription.hasWatermark}
                      products={selectedTrendProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        brand: p.brand,
                        price: p.price,
                        image_url: p.image_url,
                        product_url: p.product_url,
                        category: p.category,
                        affiliate_url: p.affiliate_url,
                      }))}
                      onProductPurchase={(product) => handlePurchase(product as CachedProduct)}
                      onProductAddToCart={(product) => addCachedProductToCart(product as CachedProduct)}
                      onProductLike={(product) => toggleLike(product as CachedProduct)}
                      likedProducts={likedProducts}
                      purchasingProductId={purchasingProductId}
                      onShare={(platform, result) => {
                        if (result.message) {
                          toast({
                            title: result.success ? '성공' : '알림',
                            description: result.message,
                            variant: result.success ? 'default' : 'destructive',
                          });
                        }
                      }}
                      lookId={generatedLookId || undefined}
                      prompt={customStylePrompt}
                      tags={selectedTrendProducts.map(p => p.category)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <img src={showmelookLogo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-50" />
                      <p className="text-base sm:text-lg font-medium font-korean">AI 스타일 미리보기</p>
                      <p className="text-xs sm:text-sm mt-2 font-korean">트렌드와 아이템을 선택하고 생성하세요</p>
                    </div>
                  )}
                </div>
                
                {/* 커뮤니티 공개 토글 + 다른 스타일 시도하기 버튼 */}
                {generatedImage && !isGenerating && (
                  <div className="mt-4 flex flex-col items-center gap-3">
                    {/* 커뮤니티 공개 토글 */}
                    {generatedLookId && (
                      <button
                        onClick={async () => {
                          const newPublic = !generatedLookIsPublic;
                          setGeneratedLookIsPublic(newPublic);
                          const { error } = await supabase
                            .from('generated_looks')
                            .update({ is_public: newPublic })
                            .eq('id', generatedLookId);
                          if (error) {
                            setGeneratedLookIsPublic(!newPublic);
                            toast({ title: '변경 실패', description: '다시 시도해주세요.', variant: 'destructive' });
                          } else {
                            // 로컬 myLooks 동기화
                            setMyLooks(prev => prev.map(l => l.id === generatedLookId ? { ...l, is_public: newPublic } : l));
                            toast({
                              title: newPublic ? '커뮤니티에 공개됨 🌐' : '비공개로 전환됨 🔒',
                              description: newPublic ? '스타일 갤러리에서 다른 사람들이 볼 수 있어요.' : '나만 볼 수 있는 비공개 상태입니다.',
                            });
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-korean transition-all ${
                          generatedLookIsPublic
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {generatedLookIsPublic ? <Globe className="w-4 h-4" /> : <LockKeyhole className="w-4 h-4" />}
                        {generatedLookIsPublic ? '커뮤니티 공개 중' : '비공개 (커뮤니티에 공개하기)'}
                      </button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-korean text-sm border-accent/30 text-accent hover:bg-accent/10"
                      onClick={() => {
                        setCustomResult(null);
                        setSelectedTrendProducts([]);
                        setCustomStylePrompt('');
                        setFeedbackGiven(null);
                        setGeneratedImage('');
                        setGeneratedLookId(null);
                        setGeneratedLookIsPublic(false);
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      다른 스타일 시도하기
                    </Button>
                  </div>
                )}

              {/* 선택된 트렌드 상품 구매하기 - 모바일 캐러셀 */}
              {selectedTrendProducts.length > 0 && (
                <div className="mt-4 sm:mt-6 w-full">
                  <h3 className="font-medium text-foreground mb-2 sm:mb-3 font-korean text-sm sm:text-base">선택된 아이템 구매하기</h3>
                  
                  {/* 모바일/태블릿: Embla 캐러셀 사용 */}
                  <div className="lg:hidden">
                    <MobilePurchaseCarousel 
                      products={selectedTrendProducts}
                      onAddToCart={addCachedProductToCart}
                      onPurchase={handlePurchase}
                      purchasingProductId={purchasingProductId}
                    />
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
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-korean">
                            {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
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
            hasWatermark={subscription.hasWatermark}
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
            onClick={(customStylePrompt.trim() && !customResult) ? generateStyleWithRecommendation : generateStyle}
            disabled={isGenerating || isCustomSearching || !canGenerate || !isProfileDataReady || (!customStylePrompt.trim() && selectedTrendProducts.length === 0)}
          >
            {isGenerating || isCustomSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isCustomSearching && !isGenerating ? 'AI가 스타일을 분석중...' : '생성 중...'}
              </>
            ) : !isProfileDataReady ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                프로필 로딩 중...
              </>
            ) : !canGenerate ? (
              <>
                <Crown className="w-5 h-5" />
                한도 도달 - 쇼핑으로 등급 UP!
              </>
            ) : (
              <>
                <img src={showmelookLogo} alt="" className="w-5 h-5 object-contain" />
                스타일 생성
              </>
            )}
          </Button>
          {/* 남은 횟수 표시 */}
          {!isPremium && (
            <p className="text-center text-xs text-muted-foreground mt-2 font-korean">
              {!isProfileDataReady 
                ? '프로필 정보를 불러오는 중...'
                : bonusCredits > 0 
                  ? `기본 ${remainingCount}회 + 보너스 ${bonusCredits}회` 
                  : `오늘 ${remainingCount}회 남음`}
            </p>
          )}
        </div>
      )}

      {/* 업그레이드 모달 */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason={upgradeReason}
        currentTier={purchaseStats?.currentTier || 'free'}
      />
    </div>
  );
};

export default StyleGenerator;
