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
  sub_category?: string | null;
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
  tag_positions?: any;
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
  hasWatermark = true,
  products = [],
  onProductPurchase,
  onProductAddToCart,
  onProductLike,
  likedProducts = new Set(),
  purchasingProductId,
  lookId,
  prompt,
  tags,
  cachedTagPositions,
  onTagPositionsAnalyzed,
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
  cachedTagPositions?: any[];
  onTagPositionsAnalyzed?: (positions: any[]) => void;
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
              cachedPositions={cachedTagPositions}
              onPositionsAnalyzed={onTagPositionsAnalyzed}
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
            sub_category: p.sub_category,
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
                    togglePublic(look);
                  }}
                  className={`absolute top-3 ${look.is_favorite ? 'left-10' : 'left-3'} z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    look.is_public ? 'bg-primary/80 text-primary-foreground' : 'bg-black/40 text-white/70'
                  } backdrop-blur-sm hover:scale-110`}
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
                        hasWatermark={hasWatermark}
                        logoUrl={showmelookWatermarkFull}
                        lookId={look.id}
                        prompt={look.prompt_used || undefined}
                        tags={look.tags || undefined}
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
            {/* 3D 카드 플립 컨테이너 */}
            <div 
              className="perspective-1000 cursor-pointer"
              onClick={() => {
                if (isEditingMemo) return;
                
                // 햅틱 피드백 (모바일)
                if ('vibrate' in navigator) {
                  navigator.vibrate(30);
                }
                
                // 카드/종이 넘기는 효과음
                try {
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const bufferSize = audioContext.sampleRate * 0.12; // 120ms
                  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                  const output = noiseBuffer.getChannelData(0);
                  
                  // 화이트 노이즈 생성 (종이 마찰음)
                  for (let i = 0; i < bufferSize; i++) {
                    output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
                  }
                  
                  const noiseSource = audioContext.createBufferSource();
                  noiseSource.buffer = noiseBuffer;
                  
                  // 밴드패스 필터로 종이 느낌 강조
                  const filter = audioContext.createBiquadFilter();
                  filter.type = 'bandpass';
                  filter.frequency.setValueAtTime(2500, audioContext.currentTime);
                  filter.Q.setValueAtTime(0.8, audioContext.currentTime);
                  
                  // 하이패스로 저음 제거 (바스락 느낌)
                  const highpass = audioContext.createBiquadFilter();
                  highpass.type = 'highpass';
                  highpass.frequency.setValueAtTime(800, audioContext.currentTime);
                  
                  const gainNode = audioContext.createGain();
                  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                  
                  noiseSource.connect(filter);
                  filter.connect(highpass);
                  highpass.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  
                  noiseSource.start(audioContext.currentTime);
                  noiseSource.stop(audioContext.currentTime + 0.12);
                } catch (e) {
                  // Audio context not available, silently fail
                }
                
                setIsFlipped(!isFlipped);
              }}
            >
              <div 
                className={`relative transform-style-3d transition-transform duration-600 ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
                style={{ transitionDuration: '0.6s' }}
              >
                {/* 앞면 - 생성된 이미지 */}
                <div className="backface-hidden relative">
                  <img 
                    src={selectedLook.image_url} 
                    alt="Generated look" 
                    className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-2xl select-none"
                    draggable={false}
                  />
                  
                  {/* 모달 워터마크 (무료 플랜) */}
                  <ModalWatermarkOverlay show={hasWatermark} />
                  
                  {/* 상품 태그 (product_ids가 있고 상품이 로드된 경우) */}
                  {lookProducts.length > 0 && !isEditingMemo && !isFlipped && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <InteractiveProductTags
                        products={lookProducts}
                        onPurchase={handleProductPurchase}
                        onLike={handleProductLike}
                        likedProducts={likedProducts}
                        purchasingProductId={purchasingProductId}
                        imageUrl={selectedLook.image_url}
                        enableAIPositioning={true}
                        cachedPositions={selectedLook.tag_positions as any[] || undefined}
                        isEditable={true}
                        lookId={selectedLook.id}
                        onPositionsAnalyzed={async (positions) => {
                          try {
                            await supabase
                              .from('generated_looks')
                              .update({ tag_positions: positions as any })
                              .eq('id', selectedLook.id);
                            setSelectedLook(prev => prev ? { ...prev, tag_positions: positions } : null);
                          } catch (e) {
                            console.error('Failed to cache tag positions:', e);
                          }
                        }}
                        onTagPositionsSaved={(positions) => {
                          setSelectedLook(prev => prev ? { ...prev, tag_positions: positions } : null);
                        }}
                      />
                    </div>
                  )}
                  
                  {/* 상품 로딩 중 표시 */}
                  {isLoadingProducts && selectedLook.product_ids?.length && (
                    <div className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-background/80 backdrop-blur-sm text-foreground text-xs rounded-full flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      상품 정보 로딩 중...
                    </div>
                  )}
                  
                  {/* 상품 없음 표시 */}
                  {!isLoadingProducts && selectedLook.product_ids?.length && lookProducts.length === 0 && (
                    <div className="absolute top-3 right-3 z-20 px-3 py-1.5 bg-background/80 backdrop-blur-sm text-muted-foreground text-xs rounded-full">
                      상품 정보를 찾을 수 없음
                    </div>
                  )}
                  
                  {/* 플립 힌트 (앞면) - 뒤집히면 숨김 */}
                  {!isFlipped && (
                    <div className="absolute bottom-3 left-3 z-20 text-xs bg-background/70 backdrop-blur-sm text-foreground/80 px-2.5 py-1.5 rounded-full flex items-center gap-1.5 font-korean backface-hidden">
                      <RotateCcw className="w-3.5 h-3.5" />
                      탭하여 상세 정보 보기
                    </div>
                  )}
                </div>
                
                {/* 뒷면 - 스타일 정보 카드 (화려한 그라데이션) */}
                <div 
                  className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg overflow-hidden shadow-2xl flex flex-col"
                  style={{ minHeight: '300px', maxHeight: '55vh' }}
                >
                  {/* 화려한 그라데이션 배경 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900" />
                  <div className="absolute inset-0 bg-gradient-to-t from-accent/20 via-transparent to-primary/10" />
                  
                  {/* 반짝이는 파티클 효과 */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-4 left-8 w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
                    <div className="absolute top-12 right-12 w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    <div className="absolute top-20 left-1/3 w-1 h-1 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
                    <div className="absolute bottom-24 right-8 w-1.5 h-1.5 bg-accent/80 rounded-full animate-pulse" style={{ animationDelay: '0.9s' }} />
                    <div className="absolute bottom-32 left-12 w-1 h-1 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '1.2s' }} />
                  </div>
                  
                  {/* 상단 장식 라인 */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />
                  
                  <div className="relative flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                    {/* AI 스타일리스트 추천 */}
                    <div className="bg-gradient-to-br from-accent/25 via-primary/20 to-accent/15 rounded-xl p-5 border border-accent/40 shadow-lg">
                      {/* 라벨 */}
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent/15 to-primary/15 border border-accent/20 mb-3">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <Sparkles className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-[10px] font-semibold text-accent tracking-wide">AI 스타일리스트 추천</span>
                      </div>
                      
                      {/* 제목 (prompt_used에서 제품명 제외) */}
                      {selectedLook.prompt_used && (
                        <h3 className="text-base font-bold text-white font-korean mb-3 leading-tight">
                          👗 {selectedLook.prompt_used.split(' 스타일,')[0].replace('👗 ', '')}
                        </h3>
                      )}
                      
                      {/* 설명 (styleReasoning) - 스크롤 가능 */}
                      <div className="relative pl-3 border-l-2 border-accent/40 max-h-32 overflow-y-auto scrollbar-hide">
                        <p className="text-sm text-white/90 font-korean leading-relaxed whitespace-pre-wrap">
                          {selectedLook.style_reasoning || (
                            lookProducts.length > 0 
                              ? `이 룩은 ${lookProducts.map(p => p.brand || p.name.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' × ')} 브랜드 조합으로 완성되었어요. 각 아이템의 조화로운 믹스가 스타일리시한 무드를 연출하죠!`
                              : '스타일리시한 코디가 완성되었어요!'
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* 추천 상품 정보 */}
                    {lookProducts.length > 0 && (
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                        <h4 className="text-sm font-semibold text-white font-korean mb-3 flex items-center gap-1.5">
                          <ShoppingBag className="w-4 h-4 text-accent" />
                          추천 상품 ({lookProducts.length}개)
                        </h4>
                        <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-hide">
                          {lookProducts.map((product, idx) => (
                            <div 
                              key={product.id} 
                              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 transition-all rounded-lg px-3 py-2.5 group"
                              style={{ animationDelay: `${idx * 0.1}s` }}
                            >
                              {/* 상품 이미지 썸네일 */}
                              {product.image_url && (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-white/20"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-white/90 truncate block font-korean text-xs">
                                  {product.brand && <span className="text-accent font-medium">{product.brand} </span>}
                                  {product.name}
                                </span>
                                <span className="text-white font-semibold text-sm">
                                  {product.price?.toLocaleString()}원
                                </span>
                                {/* 제휴 공시 문구 */}
                                <span className="text-white/50 block text-[8px] mt-0.5 leading-tight">
                                  {getProductAffiliateDisclosure(product.product_url, product.merchant_id)}
                                </span>
                              </div>
                              {/* 개별 구매 버튼 */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-shrink-0 h-8 px-2.5 text-xs bg-accent/20 border-accent/50 text-white hover:bg-accent hover:text-white transition-all opacity-80 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (product.product_url) {
                                    handleProductPurchase(product);
                                  }
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                구매
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        {/* 총 가격 */}
                        <div className="border-t border-white/20 pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-white font-korean">총 가격</span>
                            <span className="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                              {lookProducts.reduce((sum, p) => sum + (p.price || 0), 0).toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 태그 */}
                    {selectedLook.tags && selectedLook.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-white font-korean mb-2">태그</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLook.tags.map((tag, i) => (
                            <span 
                              key={i} 
                              className="text-xs bg-gradient-to-r from-accent/30 to-primary/30 text-white border border-accent/40 px-2.5 py-1 rounded-full font-korean hover:from-accent/50 hover:to-primary/50 transition-all cursor-default"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 메모 */}
                    {selectedLook.memo && (
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                        <h4 className="text-sm font-semibold text-white font-korean mb-1.5 flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          메모
                        </h4>
                        <p className="text-sm text-white/70 font-korean italic">"{selectedLook.memo}"</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 하단 정보 - 그라데이션 포함 */}
                  <div className="relative border-t border-white/10 px-5 py-3 flex items-center justify-between bg-black/30 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-xs text-white/60 font-korean cursor-pointer hover:text-white/80 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5 hover:animate-spin" />
                      탭하여 이미지로
                    </div>
                    <span className="text-xs text-white/60 font-korean">
                      {new Date(selectedLook.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  
                  {/* 하단 장식 라인 */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
                </div>
              </div>
            </div>
            
            {/* 스와이프 힌트 - 모바일만 */}
            <div className="sm:hidden text-center mt-2">
              <p className="text-white/40 text-xs font-korean">← 스와이프하여 탐색 →</p>
            </div>
            
            {/* 메모/태그 모달 - fixed overlay로 화면 중앙에 표시 */}
            {isEditingMemo && (
              <div 
                className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
                onClick={(e) => { e.stopPropagation(); setIsEditingMemo(false); }}
              >
                <div 
                  className="bg-card rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold text-foreground font-korean mb-4">메모/태그 편집</h3>
                  
                  <div className="space-y-4">
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
                  </div>
                  
                  <div className="flex gap-2 mt-6">
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
              </div>
            )}
            
            {/* 태그/메모 표시 (항상 표시) */}
            {!isEditingMemo && (
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
                  
                  {/* 공개/비공개 토글 버튼 */}
                  <button 
                    onClick={() => togglePublic(selectedLook)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors ${
                      selectedLook.is_public 
                        ? 'bg-primary/30 hover:bg-primary/40' 
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {selectedLook.is_public 
                      ? <Globe className="w-4 h-4 text-primary" /> 
                      : <LockKeyhole className="w-4 h-4 text-white" />
                    }
                    <span className="text-white text-sm font-korean hidden sm:inline">
                      {selectedLook.is_public ? '공개 중' : '비공개'}
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
                    hasWatermark={hasWatermark}
                    logoUrl={showmelookWatermarkFull}
                    compact
                    lookId={selectedLook.id}
                    prompt={selectedLook.prompt_used || undefined}
                    tags={selectedLook.tags || undefined}
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
  const [searchParams] = useSearchParams();
  const { user, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  // 구독 상태 (스타일 추천 먼저 받기 제한용)
  const subscription = useSubscription(user?.id);
  // 구매 기반 등급 정보
  const { stats: purchaseStats } = usePurchaseStats(user?.id);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'recommend-first' | 'gallery-limit' | 'daily-limit'>('recommend-first');

  const { 
    isPremium,
    currentTier,
    remainingCount,
    bonusCredits,
    totalRemaining,
    canGenerate, 
    isLoading: limitLoading, 
    updateAfterGeneration,
    consumeBonusCredit,
    refetch: refetchLimit 
  } = useGenerationLimit(user?.id);

  // 비동기 큐 시스템 훅
  const {
    currentJob,
    isQueued,
    isProcessing,
    progress: queueProgress,
    queueStatus,
    submitJob,
    cancelJob,
  } = useGenerationQueue(user?.id);

  // 프리로드된 데이터 사용 (로그인 시 백그라운드에서 미리 로드됨)
  const { 
    profile: preloadedProfile, 
    looks: preloadedLooks, 
    isProfileLoading: isPreloadingProfile,
    isLooksLoading: isPreloadingLooks,
    refreshProfile,
    refreshLooks: refreshPreloadedLooks,
    addLook: addPreloadedLook,
    updateProfile: updatePreloadedProfile
  } = usePreloadedData();

  const [trends, setTrends] = useState<StyleTrend[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<StyleTrend | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedLookId, setGeneratedLookId] = useState<string | null>(null);
  const [generatedLookIsPublic, setGeneratedLookIsPublic] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [myLooks, setMyLooks] = useState<GeneratedLook[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'mylooks' | 'mypage'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'mylooks') return 'mylooks';
    if (tabParam === 'mypage') return 'mypage';
    return 'generate';
  });
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
  
  // 선택된 프로필 (나 또는 가족/친구)
  const [selectedGenerationProfile, setSelectedGenerationProfile] = useState<SelectedProfile | null>(null);
  
  // 프로필 데이터 준비 상태 (사진, 체형, 나이 등이 모두 로드되었는지)
  const isProfileDataReady = useMemo(() => {
    // 프로필 데이터가 로딩 중이면 false
    if (isPreloadingProfile) return false;
    
    // 선택된 프로필이 없으면 기본 사용자 프로필 체크
    const profileToCheck = selectedGenerationProfile || (userProfile ? {
      id: 'self',
      type: 'self' as const,
      full_name: userProfile.full_name,
      avatar_url: userProfile.avatar_url,
      height: userProfile.height,
      weight: userProfile.weight,
      body_type: userProfile.body_type,
      gender: userProfile.gender,
      age_group: userProfile.age_group,
      style_preferences: userProfile.style_preferences,
    } : null);
    
    // 프로필이 아예 없으면 false
    if (!profileToCheck) return false;
    
    // 최소 필수 정보가 있는지 확인 (성별 또는 연령대 중 하나라도 있으면 OK)
    // 사진이 있는 경우 URL이 유효한지도 확인
    const hasMinimalData = profileToCheck.gender || profileToCheck.age_group;
    
    return !!hasMinimalData;
  }, [isPreloadingProfile, selectedGenerationProfile, userProfile]);
  
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
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const styleImageInputRef = useRef<HTMLInputElement>(null);
  const [styleImageAnalysis, setStyleImageAnalysis] = useState<{
    items: Array<{ type: string; category: string; color: string; material: string; fit: string; pattern: string }>;
    overallStyle: string;
    season: string;
    tpo: string;
  } | null>(null);
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
  
  // 로딩 화면 추천 상품 (모든 회원에게 표시)
  const [loadingAdsProducts, setLoadingAdsProducts] = useState<CachedProduct[]>([]);
  
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

  // 로딩 화면 추천 상품 로드 (모든 회원에게 표시 - 생성 중이거나 추천 검색 중일 때)
  useEffect(() => {
    const loadAdsProducts = async () => {
      // 생성 중이거나 추천 검색 중일 때만 상품 로드
      if (!isGenerating && !isCustomSearching) return;
      if (loadingAdsProducts.length > 0) return; // 이미 로드됨

      try {
        // 다양한 상품을 위해 더 많이 가져와서 랜덤 셔플
        const { data, error } = await supabase
          .from('products_cache')
          .select('id, name, brand, price, image_url, product_url, category, style_tags, merchant_id')
          .eq('is_active', true)
          .eq('is_in_stock', true)
          .not('image_url', 'is', null)
          .not('image_url', 'like', '%ads-partners%')
          .limit(100); // 더 많이 가져와서 다양성 확보

        if (error) throw error;

        if (data && data.length > 0) {
          // 완전 랜덤 셔플 후 10개 선택 (다양한 머천트/카테고리 혼합)
          const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 10);
          setLoadingAdsProducts(shuffled as CachedProduct[]);
        }
      } catch (error) {
        console.error('Error loading recommended products:', error);
      }
    };

    loadAdsProducts();
  }, [isGenerating, isCustomSearching, loadingAdsProducts.length]);

  // 광고 상품 클릭 핸들러
  const handleAdsProductClick = async (product: CachedProduct) => {
    let affiliateUrl = product.affiliate_url || product.product_url;

    // 딥링크가 없으면 생성 시도
    if (!product.affiliate_url && product.product_url) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data } = await supabase.functions.invoke('deeplink', {
          body: { product_url: product.product_url },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
        });
        if (data?.affiliate_url) {
          affiliateUrl = data.affiliate_url;
        }
      } catch (error) {
        console.error('Deeplink generation failed:', error);
      }
    }

    window.open(affiliateUrl, '_blank');
  };

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
      console.log('[handlePurchase] Using cached affiliate_url:', product.affiliate_url);
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
    console.log('[handlePurchase] Calling deeplink for:', product.product_url);

    try {
      // Get auth token for deeplink tracking
      const { data: { session } } = await supabase.auth.getSession();
      // deeplink 함수 호출하여 제휴 링크 변환
      const { data, error } = await supabase.functions.invoke('deeplink', {
        body: { product_url: product.product_url },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined
      });

      console.log('[handlePurchase] Deeplink response:', { data, error });

      if (error) throw error;

      if (data?.success && data?.affiliate_url) {
        // 변환된 제휴 링크로 이동
        console.log('[handlePurchase] Opening affiliate URL:', data.affiliate_url);
        window.open(data.affiliate_url, '_blank', 'noopener,noreferrer');
        toast({
          title: '구매 페이지 이동',
          description: `${product.name} 구매 페이지로 이동합니다.`,
        });
      } else {
        // 딥링크 실패 시 원본 URL로 이동 - 경고 표시
        console.warn('[handlePurchase] Deeplink failed, using original URL:', product.product_url);
        toast({
          title: '딥링크 변환 실패',
          description: '제휴 링크 생성에 실패하여 원본 URL로 이동합니다.',
          variant: 'destructive',
        });
        window.open(product.product_url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('[handlePurchase] Deeplink error:', error);
      toast({
        title: '딥링크 오류',
        description: '제휴 링크 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
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

  // 프리로드된 데이터가 있으면 바로 사용 (로그인 시 백그라운드에서 이미 로드됨)
  useEffect(() => {
    if (preloadedProfile && !userProfile) {
      setUserProfile(preloadedProfile);
      setEditForm({
        height: preloadedProfile.height?.toString() || '',
        weight: preloadedProfile.weight?.toString() || '',
        body_type: preloadedProfile.body_type || '',
        style_preferences: preloadedProfile.style_preferences || [],
      });
      
      // 프로필의 성별 정보로 초기 성별 설정
      if (preloadedProfile.gender) {
        const genderMap: Record<string, 'female' | 'male' | 'unisex' | 'kids'> = {
          'female': 'female',
          'male': 'male',
          '여성': 'female',
          '남성': 'male',
          'unisex': 'unisex',
          '유니섹스': 'unisex',
          'kids': 'kids',
          '키즈': 'kids',
        };
        const mappedGender = genderMap[preloadedProfile.gender.toLowerCase()] || 'female';
        setCustomGender(mappedGender);
        
        // 키즈 모드가 아니면 기본 나이 설정 해제
        if (mappedGender !== 'kids') {
          setCustomAge(undefined);
        }
      }
      
      // 🔥 연령대 기반 로깅 (디버깅용)
      console.log(`[StyleGenerator] Profile loaded: gender=${preloadedProfile.gender}, age_group=${preloadedProfile.age_group}`);
    }
  }, [preloadedProfile, userProfile]);

  // 프리로드된 룩 데이터와 동기화 (새 룩 추가 시에도 반영)
  useEffect(() => {
    if (preloadedLooks.length > 0) {
      setMyLooks(preloadedLooks as GeneratedLook[]);
    }
  }, [preloadedLooks]);

  // 비동기 큐 작업 완료 시 결과 처리
  useEffect(() => {
    if (currentJob?.status === 'completed' && currentJob.result_payload) {
      const { imageUrl, look, lookId } = currentJob.result_payload;
      
      // 생성된 이미지 표시
      if (imageUrl) {
        setGeneratedImage(imageUrl);
      }
      if (lookId) {
        setGeneratedLookId(lookId);
      }
      
      // 추천 결과 반영
      if (look?.items) {
        const transformedItems: CachedProduct[] = look.items.map((item: any) => ({
          id: item.product?.id || item.id,
          name: item.product?.name || item.name,
          brand: item.product?.brand || item.brand,
          price: item.product?.price || item.price,
          image_url: item.product?.image_url || item.image_url,
          product_url: item.product?.product_url || item.product_url,
          category: item.category,
          style_tags: item.product?.style_tags || item.style_tags,
          affiliate_url: item.affiliateUrl,
          isAutoSelected: item.isAutoSelected,
        }));
        
        setCustomResult({
          items: transformedItems,
          styleConcept: look.styleConcept || look.name || '스타일 추천',
          styleReasoning: look.styleReasoning || look.stylingTips || '',
          totalPrice: look.totalPrice || 0,
          autoSelectedTotal: look.autoSelectedTotal || 0,
          autoSelectedCount: look.autoSelectedCount || 0,
          budget: look.budget || customBudget[0],
        });
        setSelectedTrendProducts(transformedItems);
      }
      
      setIsGenerating(false);
      setIsCustomSearching(false);
      refetchLimit();
      
      // 결과 영역으로 스크롤
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    
    if (currentJob?.status === 'failed') {
      setIsGenerating(false);
      setIsCustomSearching(false);
    }
  }, [currentJob, customBudget, refetchLimit]);

  useEffect(() => {
    fetchData();
  }, [user]);

  // 캐시 참조 (재로딩 방지)
  const dataFetchedRef = useRef(false);
  const staticDataLoadedRef = useRef(false);

  const fetchData = async () => {
    // 정적 데이터는 한 번만 로드 (trends, products)
    const shouldFetchStaticData = !staticDataLoadedRef.current;
    
    // 프리로드된 데이터가 있으면 사용자 데이터 로드 건너뛰기
    const hasPreloadedProfile = !!preloadedProfile;
    const hasPreloadedLooks = preloadedLooks.length > 0;
    
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
    
    // 2. 사용자 데이터 (looks, profile) - 프리로드 안 됐을 때만 로드
    if (user && (!hasPreloadedLooks || !hasPreloadedProfile)) {
      if (!hasPreloadedLooks) {
        userPromises.push(
          Promise.resolve(
            supabase
              .from('generated_looks')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
          )
        );
      }
      if (!hasPreloadedProfile) {
        userPromises.push(
          Promise.resolve(
            supabase
              .from('profiles')
              .select('height, weight, body_type, style_preferences, avatar_url, full_name, gender')
              .eq('user_id', user.id)
              .single()
          )
        );
      }
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
    }
    
    // 사용자 데이터 처리 (프리로드 안 됐을 때만)
    if (user && userResults.length > 0) {
      let resultIndex = 0;
      
      // Looks 처리 - 프리로드 안 됐을 때만
      if (!hasPreloadedLooks && userResults[resultIndex]) {
        const looksResult = userResults[resultIndex];
        resultIndex++;
        
        if (looksResult.data && looksResult.data.length > 0) {
          const looksData = looksResult.data;
          
          // Public bucket이므로 직접 URL 사용
          const looksWithUrls = looksData.map((look: any) => {
            let imageUrl = look.image_url;
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
              const { data } = supabase.storage.from('generated-looks').getPublicUrl(imageUrl);
              imageUrl = data.publicUrl;
            }
            return { ...look, image_url: imageUrl };
          });
          
          setMyLooks(looksWithUrls);
        } else {
          setMyLooks([]);
        }
      }
      
      // Profile 처리 - 프리로드 안 됐을 때만
      if (!hasPreloadedProfile && userResults[resultIndex]) {
        const profileResult = userResults[resultIndex];
        
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

  // 트렌드 키워드는 기본값 사용 (analyze-trends 함수 제거됨)

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
          forceRefresh: false,
          stylePreferences: userProfile?.style_preferences
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

  // 📷 사진 업로드 → AI 스타일 분석 핸들러
  const handleStyleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: '이미지가 너무 큽니다', description: '5MB 이하의 이미지를 선택해주세요.', variant: 'destructive' });
      return;
    }

    // 미리보기 생성
    const previewUrl = URL.createObjectURL(file);
    setStyleImagePreview(previewUrl);
    setIsAnalyzingImage(true);

    try {
      // Canvas로 리사이즈 (최대 1024px)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const maxSize = 1024;
            let { width, height } = img;
            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
          img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('analyze-style-image', {
        body: { image_data: base64 },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'AI 분석 실패');

      // 구조화된 분석 결과에서 searchPrompt 사용 (의류 정보만 포함, 인물 묘사 제외)
      const prompt = data.searchPrompt || data.description;
      setCustomStylePrompt(prompt);
      
      // 구조화된 아이템 데이터를 상태에 저장 (style-recommend에 직접 전달용)
      if (data.items?.length) {
        setStyleImageAnalysis({
          items: data.items,
          overallStyle: data.overallStyle || '',
          season: data.season || '',
          tpo: data.tpo || '',
        });
      }
      
      // 분석된 아이템 정보를 토스트로 표시
      const itemSummary = data.items?.length 
        ? data.items.map((item: any) => `${item.color} ${item.category}`).join(', ')
        : '';
      const styleInfo = [data.overallStyle, data.season, data.tpo].filter(Boolean).join(' · ');
      
      toast({ 
        title: '📷 AI가 스타일을 분석했습니다', 
        description: itemSummary 
          ? `${itemSummary} (${styleInfo})` 
          : '프롬프트를 수정하거나 바로 추천을 받아보세요.' 
      });
    } catch (err: any) {
      console.error('[StyleGenerator] Image analysis error:', err);
      toast({ title: '사진 분석 실패', description: err?.message || '다시 시도해주세요.', variant: 'destructive' });
      setStyleImagePreview(null);
    } finally {
      setIsAnalyzingImage(false);
      // input 리셋
      if (styleImageInputRef.current) styleImageInputRef.current.value = '';
    }
  };

  const clearStyleImage = () => {
    setStyleImagePreview(null);
    setStyleImageAnalysis(null);
    if (styleImageInputRef.current) styleImageInputRef.current.value = '';
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
        'kids': '키즈' // 키즈는 키즈로 전달하여 백엔드에서 필터링
      };
      const genderKo = genderMapping[customGender] || '여성';
      
      // 🔥 선택된 프로필의 정보를 우선 사용 (가족 프로필 선택 시 기본 사용자로 폴백 방지)
      const isFamilyProfile = selectedGenerationProfile?.type === 'family';
      
      // 가족 프로필이 선택된 경우: 해당 프로필의 age_group만 사용 (null이라도 기본 사용자 폴백 안함)
      // 자신(self) 프로필이거나 선택 안된 경우: 기본 사용자 프로필 사용
      const effectiveAgeGroup = isFamilyProfile 
        ? (selectedGenerationProfile?.age_group || null)  // 가족 프로필은 폴백 없이 그대로
        : (selectedGenerationProfile?.age_group || userProfile?.age_group);
      
      const effectiveStylePrefs = isFamilyProfile
        ? (selectedGenerationProfile?.style_preferences || null)
        : (selectedGenerationProfile?.style_preferences || userProfile?.style_preferences);
      
      const isKidsRequest = customGender === 'kids' || effectiveAgeGroup === 'child';
      
      console.log(`[StyleGenerator] 🎯 Profile type: ${isFamilyProfile ? 'FAMILY' : 'SELF'}, name: ${selectedGenerationProfile?.full_name || userProfile?.full_name}`);
      console.log(`[StyleGenerator] Recommendation request: gender=${genderKo}, ageGroup=${effectiveAgeGroup}, isKids=${isKidsRequest}, prefs=${JSON.stringify(effectiveStylePrefs)}`);
      
      const { data, error } = await supabase.functions.invoke('style-recommend', {
        body: {
          userRequest: customStylePrompt,
          gender: genderKo,
          budget: customBudget[0],
          forceRefresh: false,
          age: isKidsRequest ? (customAge || 10) : undefined,
          ageGroup: effectiveAgeGroup,
          stylePreferences: effectiveStylePrefs,
          profileName: selectedGenerationProfile?.full_name || userProfile?.full_name,
          // 📷 사진 분석 구조화 데이터 직접 전달 (DB 직접 매칭용)
          ...(styleImageAnalysis ? { photoAnalysisItems: styleImageAnalysis } : {}),
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

  // 새로운 통합 함수: 프롬프트만으로 추천 + 생성을 동시에 실행
  const generateStyleWithRecommendation = async () => {
    if (!user) return;

    // Check limit before generating
    if (!canGenerate) {
      toast({
        title: '일일 생성 횟수 초과',
        description: '등급이 높아지면 더 많이 생성할 수 있어요. 쇼미룩에서 쇼핑하고 등급을 올려보세요!',
        variant: 'destructive',
      });
      return;
    }

    // 보너스 크레딧 사용 여부 확인 (기본 횟수가 0이고 보너스가 있을 때)
    const willUseBonus = remainingCount === 0 && bonusCredits > 0;
    if (willUseBonus) {
      toast({
        title: '✨ 보너스 크레딧 사용',
        description: `보너스 ${bonusCredits}회 중 1회를 사용합니다.`,
      });
    }

    // 프롬프트 필수
    if (!customStylePrompt.trim()) {
      toast({
        title: '스타일 프롬프트를 입력해주세요',
        description: '원하는 스타일을 설명해주세요.',
        variant: 'destructive',
      });
      return;
    }

    // 생성 시작 - 두 작업 동시 시작
    setIsGenerating(true);
    setIsCustomSearching(true);
    
    // 생성 시작 시 결과 영역으로 스크롤
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    // 성별 매핑
    const genderMapping: Record<string, string> = {
      'female': '여성',
      'male': '남성',
      'unisex': '유니섹스',
      'kids': '키즈'
    };
    const genderKo = genderMapping[customGender] || '여성';
    
    // 🔥 선택된 프로필의 정보를 우선 사용 (가족 프로필 선택 시 기본 사용자로 폴백 방지)
    const isFamilyProfile = selectedGenerationProfile?.type === 'family';
    
    // 가족 프로필이 선택된 경우: 해당 프로필의 age_group만 사용 (null이라도 기본 사용자 폴백 안함)
    const effectiveAgeGroup = isFamilyProfile 
      ? (selectedGenerationProfile?.age_group || null)
      : (selectedGenerationProfile?.age_group || userProfile?.age_group);
    
    const effectiveStylePrefs = isFamilyProfile
      ? (selectedGenerationProfile?.style_preferences || null)
      : (selectedGenerationProfile?.style_preferences || userProfile?.style_preferences);
    
    const isKidsRequest = customGender === 'kids' || effectiveAgeGroup === 'child';
    
    console.log(`[StyleGenerator] 🎯 Generation - Profile type: ${isFamilyProfile ? 'FAMILY' : 'SELF'}, name: ${selectedGenerationProfile?.full_name || userProfile?.full_name}`);
    console.log(`[StyleGenerator] Generation request: gender=${genderKo}, ageGroup=${effectiveAgeGroup}, isKids=${isKidsRequest}`);

    // 1. 스타일 추천 시작 (비동기로 진행)
    const recommendationPromise = supabase.functions.invoke('style-recommend', {
      body: {
        userRequest: customStylePrompt,
        gender: genderKo,
        budget: customBudget[0],
        forceRefresh: false,
        age: isKidsRequest ? (customAge || 10) : undefined,
        ageGroup: effectiveAgeGroup,
        stylePreferences: effectiveStylePrefs,
        profileName: selectedGenerationProfile?.full_name || userProfile?.full_name,
      }
    });

    // 2. 이미지 생성 시작 (추천 결과를 기다리지 않고 진행 - 프롬프트 기반)
    const generatePromise = (async () => {
      try {
        // 먼저 추천 결과를 기다려서 상품 정보 획득
        const { data: recData, error: recError } = await recommendationPromise;
        
        if (recError) throw recError;
        
        let transformedItems: CachedProduct[] = [];
        let styleDesc = customStylePrompt;
        let productsDesc = '스타일리시한 아이템';
        // 추천된 styleReasoning을 로컬 변수에 저장 (DB 저장 시 사용)
        let capturedStyleReasoning = '';
        
        if (recData?.success && recData?.look) {
          transformedItems = recData.look.items
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
              isAutoSelected: item.isAutoSelected,
              // 색상 정보 추가 (generate-style에서 사용)
              color: item.product.color,
              dna_meta: item.product.dna_meta,
              color_family: item.product.dna_meta?.color_family || null
            }));

          // styleReasoning 캡처 (DB 저장 시 이 값을 그대로 사용)
          capturedStyleReasoning = recData.look.styleReasoning || recData.look.stylingTips || '';
          console.log('[StyleGenerator] capturedStyleReasoning:', capturedStyleReasoning);
          console.log('[StyleGenerator] recData.look:', JSON.stringify(recData.look, null, 2).slice(0, 500));
          
          // 추천 결과 즉시 UI에 반영
          setCustomResult({
            items: transformedItems,
            styleConcept: recData.look.styleConcept || recData.look.name || '스타일 추천',
            styleReasoning: capturedStyleReasoning,
            totalPrice: recData.look.totalPrice || 0,
            autoSelectedTotal: recData.look.autoSelectedTotal || 0,
            autoSelectedCount: recData.look.autoSelectedCount || 0,
            budget: recData.look.budget || customBudget[0]
          });
          
          setSelectedTrendProducts(transformedItems);
          setIsCustomSearching(false);
          
          styleDesc = recData.look.styleConcept || recData.look.name || customStylePrompt;
          productsDesc = transformedItems.map(p => {
            const brandPart = p.brand ? `${p.brand} ` : '';
            return `${brandPart}${p.name}`;
          }).join(', ') || '기본 아이템';
          
          // 히스토리 저장
          if (user) {
            try {
              const { data: historyData } = await supabase.from('recommendation_history').insert({
                user_id: user.id,
                prompt: customStylePrompt,
                gender: customGender === 'kids' ? '키즈' : customGender === 'unisex' ? '유니섹스' : (customGender === 'female' ? '여성' : '남성'),
                budget: customBudget[0],
                style_concept: recData.look.name || '',
                style_reasoning: recData.look.stylingTips || '',
                items: transformedItems as any,
                total_price: recData.look.totalPrice || 0
              }).select('id').single();
              
              if (historyData) {
                setLastRecommendationId(historyData.id);
                setFeedbackGiven(null);
              }
            } catch (saveError) {
              console.error('Failed to save to history:', saveError);
            }
          }
        } else {
          setIsCustomSearching(false);
        }
        
        // 이미지 생성 - 색상 정보 포함
        const productsWithDetails = transformedItems.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          image_url: p.image_url,
          // 색상 정보 추가
          color: (p as any).color,
          dna_meta: (p as any).dna_meta,
          color_family: (p as any).color_family
        }));
        
        const productImageUrls = productsWithDetails
          .filter(p => p.image_url)
          .map(p => p.image_url);
        
        // 선택된 프로필 정보 (항상 selectedGenerationProfile 우선 사용)
        const profileToUse = selectedGenerationProfile 
          ? {
              ...userProfile,
              full_name: selectedGenerationProfile.full_name,
              avatar_url: selectedGenerationProfile.avatar_url,
              height: selectedGenerationProfile.height,
              weight: selectedGenerationProfile.weight,
              body_type: selectedGenerationProfile.body_type,
              gender: selectedGenerationProfile.gender,
              age_group: selectedGenerationProfile.age_group,
              style_preferences: selectedGenerationProfile.style_preferences,
            }
          : userProfile;
        
        const avatarToUse = selectedGenerationProfile?.avatar_url || userProfile?.avatar_url;
        
        const { data: genData, error: genError } = await supabase.functions.invoke('generate-style', {
          body: {
            style: styleDesc,
            products: productsDesc,
            productDetails: productsWithDetails,
            productImageUrls: productImageUrls,
            userProfile: profileToUse,
            useFaceComposite: useFaceComposite && !!avatarToUse,
            userAvatarUrl: avatarToUse,
            styleTrendId: selectedTrend?.id || null,
            productIds: productsWithDetails.map(p => p.id),
          },
        });
        
        if (genError) throw genError;
        const styleConcept = recData?.look?.styleConcept || recData?.look?.name || styleDesc;
        // 이미 캡처해둔 styleReasoning을 사용 (recData에서 다시 읽지 않음)
        return { genData, productsWithDetails, styleDesc, productsDesc, styleConcept, styleReasoning: capturedStyleReasoning };
      } catch (error) {
        throw error;
      }
    })();

    try {
      const result = await generatePromise;
      const { genData, productsWithDetails, styleDesc, productsDesc, styleConcept, styleReasoning } = result;

      // Handle limit exceeded error
      if (genData?.limitExceeded) {
        toast({
          title: '일일 생성 횟수 초과',
          description: '등급이 높아지면 더 많이 생성할 수 있어요. 쇼미룩에서 쇼핑하고 등급을 올려보세요!',
          variant: 'destructive',
        });
        refetchLimit();
        return;
      }

      if (genData?.imageUrl) {
        setGeneratedImage(genData.imageUrl);
        
        // 생성 완료 시 결과 영역으로 스크롤
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // Update local limit state - 보너스 크레딧 사용 여부 추적
        const usedBonus = remainingCount === 0 && bonusCredits > 0;
        if (typeof genData.remainingCount === 'number') {
          updateAfterGeneration(genData.isPremium, genData.remainingCount, usedBonus);
        } else {
          // Edge function이 remainingCount를 반환하지 않는 경우 로컬에서 업데이트
          updateAfterGeneration(isPremium, remainingCount, usedBonus);
        }
        
        // 보너스 크레딧 사용 시 서버에서도 소비 처리
        if (usedBonus) {
          consumeBonusCredit();
        }

        // Show appropriate toast
        const currentAvatarUrl = selectedGenerationProfile?.avatar_url || userProfile?.avatar_url;
        const toastDescription = useFaceComposite && currentAvatarUrl
          ? selectedGenerationProfile?.type === 'family'
            ? `${selectedGenerationProfile.full_name}님의 얼굴이 합성된 룩이 완성되었습니다.`
            : '당신의 얼굴이 합성된 룩이 완성되었습니다.'
          : '스타일 룩이 완성되었습니다.';
        toast({
          title: '스타일 생성 완료!',
          description: toastDescription,
        });

        // Save to database
        if (!genData.cached) {
          console.log('[StyleGenerator] About to save to DB, styleReasoning:', styleReasoning?.substring(0, 100), 'length:', styleReasoning?.length || 0);
          // 생성 시점 tag_positions 포함
          const generationTagPositions = genData.tagPositions || null;
          console.log('[StyleGenerator] Tag positions from generation:', generationTagPositions?.length || 0);
          
          const { data: insertedLook, error: insertError } = await supabase.from('generated_looks').insert({
            user_id: user.id,
            image_url: genData.imagePath || genData.imageUrl,
            prompt_used: styleConcept,
            style_trend_id: selectedTrend?.id || null,
            product_ids: productsWithDetails.map((p: any) => p.id),
            style_reasoning: styleReasoning || null,
            tag_positions: generationTagPositions,
          }).select('id').single();
          if (insertError) console.error('[StyleGenerator] DB insert error:', insertError);
          if (insertedLook?.id) {
            setGeneratedLookId(insertedLook.id);
            
            // 글로벌 캐시에 새 룩 즉시 추가 (갤러리 동기화)
            addPreloadedLook({
              id: insertedLook.id,
              image_url: genData.imagePath || genData.imageUrl,
              prompt_used: styleConcept,
              is_favorite: false,
              created_at: new Date().toISOString(),
              style_trend_id: selectedTrend?.id || null,
              product_ids: productsWithDetails.map((p: any) => p.id),
              style_reasoning: styleReasoning || null,
              tag_positions: generationTagPositions,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error generating style:', error);
      
      // 에러 코드에 따른 사용자 친화적 메시지
      const errorCode = error?.errorCode || error?.code || '';
      const statusCode = error?.status || error?.statusCode || '';
      
      let errorTitle = '생성 실패';
      let errorMessage = error?.message || '스타일 생성 중 문제가 발생했습니다.';
      let showRetryButton = false;
      
      // Rate Limit (429) 에러
      if (statusCode === 429 || errorCode === '429' || errorMessage?.includes('Rate limit') || errorMessage?.includes('429')) {
        errorTitle = '⏳ 서버가 바쁩니다';
        errorMessage = '잠시 후 다시 시도해주세요. 30초 후에 자동으로 재시도할 수 있습니다.';
        showRetryButton = true;
      }
      // Payment Required (402) 에러  
      else if (statusCode === 402 || errorCode === '402' || errorMessage?.includes('Payment required') || errorMessage?.includes('402')) {
        errorTitle = '💳 크레딧 부족';
        errorMessage = '서비스 크레딧이 부족합니다. 관리자에게 문의해주세요.';
      }
      // 이미지 생성 실패
      else if (errorCode === 'NO_IMAGE' || errorMessage?.includes('No image')) {
        errorTitle = '🖼️ 이미지 생성 실패';
        errorMessage = 'AI가 이미지를 생성하지 못했습니다. 다시 시도해주세요.';
        showRetryButton = true;
      }
      // 네트워크 에러
      else if (errorMessage?.includes('Network') || errorMessage?.includes('fetch')) {
        errorTitle = '📶 네트워크 오류';
        errorMessage = '인터넷 연결을 확인하고 다시 시도해주세요.';
        showRetryButton = true;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: showRetryButton ? 10000 : 5000,
      });
      
      // Rate Limit 시 30초 후 재시도 가능 알림
      if (showRetryButton && (statusCode === 429 || errorCode === '429')) {
        setTimeout(() => {
          toast({
            title: '🔄 재시도 가능',
            description: '이제 다시 생성해보세요!',
            duration: 5000,
          });
        }, 30000);
      }
    } finally {
      setIsGenerating(false);
      setIsCustomSearching(false);
    }
  };

  // 기존 generateStyle 함수 (이미 추천 결과가 있을 때 사용)
  const generateStyle = async () => {
    if (!user) return;

    // Check limit before generating
    if (!canGenerate) {
      toast({
        title: '일일 생성 횟수 초과',
        description: '등급이 높아지면 더 많이 생성할 수 있어요. 쇼미룩에서 쇼핑하고 등급을 올려보세요!',
        variant: 'destructive',
      });
      return;
    }

    // 보너스 크레딧 사용 여부 확인 (기본 횟수가 0이고 보너스가 있을 때)
    const willUseBonus = remainingCount === 0 && bonusCredits > 0;
    if (willUseBonus) {
      toast({
        title: '✨ 보너스 크레딧 사용',
        description: `보너스 ${bonusCredits}회 중 1회를 사용합니다.`,
      });
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
      
      // 상품 정보를 상세하게 구성 (이름, 브랜드, 카테고리, 색상 정보 포함)
      const productsWithDetails = useTrendProducts 
        ? selectedTrendProducts.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
            // 색상 정보 추가
            color: (p as any).color,
            dna_meta: (p as any).dna_meta,
            color_family: (p as any).color_family
          }))
        : selectedProducts.map(p => ({
            id: p.id,
            name: p.name_ko,
            brand: p.brand,
            category: p.category,
            image_url: p.image_url,
            // 색상 정보 추가
            color: (p as any).color,
            dna_meta: (p as any).dna_meta,
            color_family: (p as any).color_family
          }));

      const productsDescription = productsWithDetails.map(p => {
        const brandPart = p.brand ? `${p.brand} ` : '';
        return `${brandPart}${p.name}`;
      }).join(', ') || '기본 아이템';

      // 상품 이미지 URL 목록 (AI가 참고할 수 있도록)
      const productImageUrls = productsWithDetails
        .filter(p => p.image_url)
        .map(p => p.image_url);

      // 선택된 프로필 정보 (항상 selectedGenerationProfile 우선 사용)
      const profileToUse = selectedGenerationProfile 
        ? {
            ...userProfile,
            full_name: selectedGenerationProfile.full_name,
            avatar_url: selectedGenerationProfile.avatar_url,
            height: selectedGenerationProfile.height,
            weight: selectedGenerationProfile.weight,
            body_type: selectedGenerationProfile.body_type,
            gender: selectedGenerationProfile.gender,
            age_group: selectedGenerationProfile.age_group,
            style_preferences: selectedGenerationProfile.style_preferences,
          }
        : userProfile;
      
      const avatarToUse = selectedGenerationProfile?.avatar_url || userProfile?.avatar_url;

      // Call AI generation edge function with face composite option
      const { data, error } = await supabase.functions.invoke('generate-style', {
        body: {
          style: styleDescription,
          products: productsDescription,
          productDetails: productsWithDetails, // 상세 상품 정보 전달
          productImageUrls: productImageUrls, // 상품 이미지 URL 전달
          userProfile: profileToUse,
          useFaceComposite: useFaceComposite && !!avatarToUse,
          userAvatarUrl: avatarToUse,
          styleTrendId: selectedTrend?.id || null,
          productIds: productsWithDetails.map(p => p.id),
        },
      });

      if (error) throw error;

      // Handle limit exceeded error
      if (data?.limitExceeded) {
        toast({
          title: '일일 생성 횟수 초과',
          description: '등급이 높아지면 더 많이 생성할 수 있어요. 쇼미룩에서 쇼핑하고 등급을 올려보세요!',
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

        // Update local limit state - 보너스 크레딧 사용 여부 추적
        const usedBonus = remainingCount === 0 && bonusCredits > 0;
        if (typeof data.remainingCount === 'number') {
          updateAfterGeneration(data.isPremium, data.remainingCount, usedBonus);
        } else {
          updateAfterGeneration(isPremium, remainingCount, usedBonus);
        }
        
        // 보너스 크레딧 사용 시 서버에서도 소비 처리
        if (usedBonus) {
          consumeBonusCredit();
        }

        // Show appropriate toast
        const toastDescription = useFaceComposite && avatarToUse
          ? selectedGenerationProfile?.type === 'family'
            ? `${selectedGenerationProfile.full_name}님의 얼굴이 합성된 룩이 완성되었습니다.`
            : '당신의 얼굴이 합성된 룩이 완성되었습니다.'
          : '스타일 룩이 완성되었습니다.';
        toast({
          title: '스타일 생성 완료!',
          description: toastDescription,
        });

        // Save to database (only if not cached - edge function handles caching)
        if (!data.cached) {
          // customResult에서 styleReasoning 가져오기 (AI 추천 시 생성된 설명)
          const styleReasoningToSave = customResult?.styleReasoning || null;
          console.log('[generateStyle] Saving with styleReasoning:', styleReasoningToSave?.substring(0, 100), 'length:', styleReasoningToSave?.length || 0);
          
          // 생성 시점 tag_positions 포함
          const generationTagPositions2 = data.tagPositions || null;
          console.log('[generateStyle] Tag positions from generation:', generationTagPositions2?.length || 0);
          
          const { data: insertedLook } = await supabase.from('generated_looks').insert({
            user_id: user.id,
            image_url: data.imagePath || data.imageUrl,
            prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
            style_trend_id: selectedTrend?.id || null,
            product_ids: productsWithDetails.map(p => p.id),
            style_reasoning: styleReasoningToSave,
            tag_positions: generationTagPositions2,
          }).select('id').single();
          if (insertedLook?.id) {
            setGeneratedLookId(insertedLook.id);
            
            // 글로벌 캐시에 새 룩 즉시 추가 (갤러리 동기화)
            addPreloadedLook({
              id: insertedLook.id,
              image_url: data.imagePath || data.imageUrl,
              prompt_used: `${styleDescription} 스타일, ${productsDescription}`,
              is_favorite: false,
              created_at: new Date().toISOString(),
              style_trend_id: selectedTrend?.id || null,
              product_ids: productsWithDetails.map(p => p.id),
              style_reasoning: styleReasoningToSave,
              tag_positions: generationTagPositions2,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error generating style:', error);
      
      // 에러 코드에 따른 사용자 친화적 메시지
      const errorCode = error?.errorCode || error?.code || '';
      const statusCode = error?.status || error?.statusCode || '';
      
      let errorTitle = '생성 실패';
      let errorMessage = error?.message || '스타일 생성 중 문제가 발생했습니다.';
      let showRetryButton = false;
      
      // Rate Limit (429) 에러
      if (statusCode === 429 || errorCode === '429' || errorMessage?.includes('Rate limit') || errorMessage?.includes('429')) {
        errorTitle = '⏳ 서버가 바쁩니다';
        errorMessage = '잠시 후 다시 시도해주세요. 30초 후에 자동으로 재시도할 수 있습니다.';
        showRetryButton = true;
      }
      // Payment Required (402) 에러  
      else if (statusCode === 402 || errorCode === '402' || errorMessage?.includes('Payment required') || errorMessage?.includes('402')) {
        errorTitle = '💳 크레딧 부족';
        errorMessage = '서비스 크레딧이 부족합니다. 관리자에게 문의해주세요.';
      }
      // 이미지 생성 실패
      else if (errorCode === 'NO_IMAGE' || errorMessage?.includes('No image')) {
        errorTitle = '🖼️ 이미지 생성 실패';
        errorMessage = 'AI가 이미지를 생성하지 못했습니다. 다시 시도해주세요.';
        showRetryButton = true;
      }
      // 네트워크 에러
      else if (errorMessage?.includes('Network') || errorMessage?.includes('fetch')) {
        errorTitle = '📶 네트워크 오류';
        errorMessage = '인터넷 연결을 확인하고 다시 시도해주세요.';
        showRetryButton = true;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
        duration: showRetryButton ? 10000 : 5000,
      });
      
      // Rate Limit 시 30초 후 재시도 가능 알림
      if (showRetryButton && (statusCode === 429 || errorCode === '429')) {
        setTimeout(() => {
          toast({
            title: '🔄 재시도 가능',
            description: '이제 다시 생성해보세요!',
            duration: 5000,
          });
        }, 30000);
      }
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
      <SEOHead pageKey="style" />
      {/* 비동기 큐 진행률 UI */}
      <GenerationProgress 
        isVisible={isQueued || isProcessing}
        progress={queueProgress}
        status={currentJob?.status || 'queued'}
        queueStatus={queueStatus}
        onCancel={() => currentJob && cancelJob(currentJob.id)}
      />
      {/* Header - using shared MainNavigation */}
      <MainNavigation 
        rightContent={
          <div className="flex items-center gap-1 sm:gap-2">
            {/* 좋아요 상품 버튼 */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/mypage?tab=likes')} 
              className="p-2"
            >
              <Heart className="w-5 h-5" />
            </Button>
            {/* 내 갤러리 버튼 with Badge */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setActiveTab('mylooks')} 
              className={`p-2 relative ${activeTab === 'mylooks' ? 'text-accent bg-accent/10' : ''}`}
            >
              <Images className={`w-5 h-5 ${activeTab === 'mylooks' ? 'text-accent' : ''}`} />
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
              onClick={() => navigate('/mypage')} 
              className="p-2"
            >
              <User className="w-5 h-5" />
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
                        <div className="flex items-center justify-between">
                          <Label className="font-korean text-sm">스타일 프롬프트</Label>
                          <button
                            type="button"
                            onClick={() => styleImageInputRef.current?.click()}
                            disabled={isAnalyzingImage || isCustomSearching}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-korean font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                          >
                            {isAnalyzingImage ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 사진 분석 중...</>
                            ) : (
                              <><Camera className="w-3.5 h-3.5" /> 사진으로 스타일 찾기</>
                            )}
                          </button>
                          <input
                            ref={styleImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleStyleImageUpload}
                          />
                        </div>
                        
                        {/* 업로드된 이미지 미리보기 */}
                        {styleImagePreview && (
                          <div className="relative inline-block">
                            <img
                              src={styleImagePreview}
                              alt="참고 스타일 사진"
                              className="w-20 h-20 object-cover rounded-xl border-2 border-accent/30"
                            />
                            <button
                              type="button"
                              onClick={clearStyleImage}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {isAnalyzingImage && (
                              <div className="absolute inset-0 bg-background/60 rounded-xl flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                              </div>
                            )}
                          </div>
                        )}
                        
                        <Textarea
                          placeholder="예: 봄 데이트룩, 화사하고 로맨틱한 느낌으로 원피스나 블라우스 위주로 추천해줘"
                          value={customStylePrompt}
                          onChange={(e) => {
                            setCustomStylePrompt(e.target.value);
                            // 새로운 프롬프트 입력 시 기존 추천 결과 리셋
                            if (customResult) {
                              setCustomResult(null);
                              setSelectedTrendProducts([]);
                              setFeedbackGiven(null);
                            }
                          }}
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

                      
                      {/* 추천만 먼저 보기 (항상 표시) */}
                      {subscription.canUseRecommendFirst && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-korean text-xs"
                          onClick={handleCustomStyleSearch}
                          disabled={isCustomSearching || !customStylePrompt.trim()}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {customResult ? '새로운 추천 받기' : '상품 추천만 먼저 보기'}
                        </Button>
                      )}
                      
                      {/* 무료 회원용 새로 시작 버튼 */}
                      {!subscription.canUseRecommendFirst && customResult && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-korean text-xs border-accent/30 text-accent hover:bg-accent/10"
                          onClick={() => {
                            setCustomResult(null);
                            setSelectedTrendProducts([]);
                            setCustomStylePrompt('');
                            setFeedbackGiven(null);
                            setGeneratedImage('');
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          새로운 스타일 시작
                        </Button>
                      )}
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
                      onTagPositionsAnalyzed={async (positions) => {
                        // 이미 태그가 있으면 덮어쓰지 않음
                        if (generatedLookId) {
                          try {
                            const { data: existing } = await supabase
                              .from('generated_looks')
                              .select('tag_positions')
                              .eq('id', generatedLookId)
                              .single();
                            if (existing?.tag_positions && Array.isArray(existing.tag_positions) && existing.tag_positions.length > 0) return;
                            await supabase
                              .from('generated_looks')
                              .update({ tag_positions: positions as any })
                              .eq('id', generatedLookId);
                          } catch (e) {
                            console.error('Failed to cache tag positions:', e);
                          }
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
