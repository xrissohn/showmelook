/**
 * ShareButtons - Reusable SNS share & download component
 * Extracted from StyleGenerator for use across LookDetailModal, galleries, etc.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Share2, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// 해시태그 생성 함수
const generateHashtags = (prompt?: string, tags?: string[]): string => {
  const baseHashtags = ['#ShowMeLook', '#AI패션', '#스타일추천'];
  const dynamicHashtags: string[] = [];
  
  if (tags && tags.length > 0) {
    tags.slice(0, 5).forEach(tag => {
      const cleanTag = tag.replace(/\s+/g, '').replace(/[^가-힣a-zA-Z0-9]/g, '');
      if (cleanTag && cleanTag.length > 1) {
        dynamicHashtags.push(`#${cleanTag}`);
      }
    });
  }
  
  if (prompt) {
    const styleKeywords = [
      '캐주얼', '미니멀', '스트릿', '클래식', '스포티', '모던', '빈티지', '시크',
      '데일리', '오피스', '데이트', '여행', '파티', '포멀', '럭셔리', '키치',
      '로맨틱', '보헤미안', '프레피', '아티스틱', '이지웨어', '액티브',
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
  
  const allHashtags = [...baseHashtags, ...dynamicHashtags.slice(0, 5)];
  return allHashtags.join(' ');
};

// 이미지에 워터마크 추가
const addWatermarkToImage = async (imageUrl: string, logoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context not available')); return; }
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = () => {
        const watermarkWidth = img.width * 0.45;
        const watermarkHeight = (logo.height / logo.width) * watermarkWidth;
        const urlFontSize = Math.max(20, img.width * 0.035);
        const logoStartY = (img.height - watermarkHeight) / 2 - img.height * 0.10;
        const logoX = (img.width - watermarkWidth) / 2;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(logo, logoX, logoStartY, watermarkWidth, watermarkHeight);
        ctx.globalAlpha = 1.0;
        ctx.font = `bold ${urlFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('showmelook.com', img.width / 2, img.height - 20);
        canvas.toBlob((blob) => {
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 1.0);
      };
      logo.onerror = () => {
        const fontSize = Math.max(24, img.width * 0.05);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ShowMeLook', img.width / 2, img.height / 2);
        canvas.toBlob((blob) => {
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 1.0);
      };
      logo.src = logoUrl;
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

const downloadImage = async (imageUrl: string, fileName: string, addWatermark: boolean, logoUrl?: string) => {
  try {
    let urlToDownload = imageUrl;
    if (addWatermark && logoUrl) {
      try { urlToDownload = await addWatermarkToImage(imageUrl, logoUrl); } catch { /* use original */ }
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
    if (addWatermark && urlToDownload !== imageUrl) URL.revokeObjectURL(urlToDownload);
    return true;
  } catch { return false; }
};

const KAKAO_JS_KEY = 'e5f9085240afd55f52cc0a0a37081761';
const KAKAO_FALLBACK_IMAGE_URL = 'https://showmelook.com/og-image-kakao.png';

const getKakaoShareImageUrl = (url: string) => {
  try {
    if (!/^https?:\/\//i.test(url)) return KAKAO_FALLBACK_IMAGE_URL;
    const parsed = new URL(url);
    const normalized = `${parsed.pathname}${parsed.search}`.toLowerCase();
    if (normalized.includes('/sign/') || normalized.includes('token=')) {
      return KAKAO_FALLBACK_IMAGE_URL;
    }
    return url;
  } catch {
    return KAKAO_FALLBACK_IMAGE_URL;
  }
};

const getKakaoSharePayload = (imageUrl: string, shareUrl: string, prompt?: string) => ({
  objectType: 'feed',
  content: {
    title: '👗 쇼미룩 AI 스타일',
    description: prompt ? prompt.slice(0, 80) : 'AI가 만든 나만의 스타일을 확인해보세요!',
    imageUrl: getKakaoShareImageUrl(imageUrl),
    link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
  },
  buttons: [{ title: '스타일 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
});

export const shareToSNS = async (
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
  const baseUrl = 'https://showmelook.com';
  const shareUrl = lookId ? `${baseUrl}/look/${lookId}` : baseUrl;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const crawlerShareUrl = lookId ? `${supabaseUrl}/functions/v1/share-preview?lookId=${lookId}` : baseUrl;
  const markLookPublic = () => {
    if (lookId) {
      void supabase.from('generated_looks').update({ is_public: true }).eq('id', lookId).then(() => {}, () => {});
    }
  };

  // 모바일 Chrome/Safari는 Kakao SDK 앱스킴이 막히거나 talk-apps 폴백이 뜰 수 있으므로
  // Kakao 공유만큼은 어떤 비동기 작업보다 먼저 네이티브 공유 시트를 호출하고 즉시 종료한다.
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  const isMobileChrome = isMobile && /CriOS|Chrome|Chromium/i.test(navigator.userAgent) && !/Edg|OPR|SamsungBrowser|Whale/i.test(navigator.userAgent);
  if (platform === 'kakao' && isMobile) {
    if (isMobileChrome) {
      markLookPublic();
      try {
        await navigator.clipboard.writeText(shareUrl);
        return { success: true, message: '모바일 Chrome에서는 링크가 복사되었습니다. 카카오톡에 붙여넣어 공유해주세요.' };
      } catch { return { success: false, message: '링크 복사에 실패했습니다.' }; }
    }

    if (typeof navigator.share === 'function') {
      try {
        const sharePromise = navigator.share({
          title: '👗 쇼미룩 AI 스타일',
          text: prompt ? prompt.slice(0, 80) : 'AI가 만든 나만의 스타일을 확인해보세요!',
          url: shareUrl,
        });
        markLookPublic();
        await sharePromise;
        return { success: true };
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          return { success: true, message: '공유가 취소되었습니다.' };
        }
      }
    }

    markLookPublic();
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      return { success: true, message: '공유 시트를 열 수 없어 링크를 복사했습니다.' };
    } catch { return { success: false, message: '공유에 실패했습니다.' }; }
  }

  // 사용자 제스처를 끊지 않기 위해 fire-and-forget (iOS Web Share API는 동기 제스처 컨텍스트 필요)
  markLookPublic();

  switch (platform) {
    case 'instagram': {
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
          try { await navigator.clipboard.writeText(hashtags); } catch {}
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'showmelook-style.jpg', { type: 'image/jpeg' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: '👗 ShowMeLook AI 스타일', text: hashtags });
              return { success: true, message: '📸 공유 완료!\n해시태그가 클립보드에 복사되었습니다.' };
            } catch (e) {
              if ((e as Error).name === 'AbortError') return { success: true, message: '공유가 취소되었습니다.' };
            }
          }
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl; link.download = 'showmelook-style.jpg';
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          setTimeout(() => { window.location.href = 'instagram://story-camera'; }, 1000);
          return { success: true, message: '📸 이미지가 저장되었습니다!' };
        } catch {}
      }
      const downloaded = await downloadImage(imageUrl, 'showmelook-style-instagram.png', addWatermark, logoUrl);
      if (downloaded) {
        try { await navigator.clipboard.writeText(hashtags); } catch {}
        return { success: true, message: '📸 이미지가 저장되었습니다!\n해시태그가 복사되었으니 인스타그램에 붙여넣기 해주세요.' };
      }
      return { success: false, message: '이미지 저장에 실패했습니다.' };
    }
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(crawlerShareUrl)}`, '_blank', 'width=600,height=400');
      return { success: true };
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(crawlerShareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400');
      return { success: true };
    case 'kakao': {
      try {
        const Kakao = (window as any).Kakao;
        if (!Kakao) {
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 SDK 로딩 실패. 링크가 복사되었습니다!' };
        }
        if (!Kakao.isInitialized()) {
          try { Kakao.init(KAKAO_JS_KEY); } catch (initErr) { console.error('[Kakao Share] init error:', initErr); }
        }
        if (!Kakao.isInitialized()) {
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 초기화 실패. 링크가 복사되었습니다!' };
        }
        Kakao.Share.sendDefault(getKakaoSharePayload(imageUrl, shareUrl, prompt));
        return { success: true };
      } catch (err) {
        console.error('[Kakao Share] sendDefault error:', err);
        try {
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          return { success: true, message: '카카오톡 공유 실패. 링크가 복사되었습니다!' };
        } catch { return { success: false, message: '공유에 실패했습니다.' }; }
      }
    }
    case 'copy':
      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        return { success: true, message: '링크와 해시태그가 복사되었습니다!' };
      } catch { return { success: false, message: '복사에 실패했습니다.' }; }
    default:
      return { success: false };
  }
};

interface ShareButtonsProps {
  imageUrl: string;
  onShare?: (platform: string, result: { success: boolean; message?: string }) => void;
  className?: string;
  compact?: boolean;
  hasWatermark?: boolean;
  logoUrl?: string;
  lookId?: string;
  prompt?: string;
  tags?: string[];
  showDownload?: boolean;
}

export const ShareButtons = ({
  imageUrl,
  onShare,
  className = '',
  compact = false,
  hasWatermark = true,
  logoUrl,
  lookId,
  prompt,
  tags,
  showDownload = true,
}: ShareButtonsProps) => {
  const { t } = useLanguage();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const shouldAddWatermark = hasWatermark ?? true;

  const handleDownload = async () => {
    setIsDownloading(true);
    const success = await downloadImage(imageUrl, `showmelook-style-${Date.now()}.png`, shouldAddWatermark, logoUrl);
    setIsDownloading(false);
    const message = success
      ? !shouldAddWatermark ? t('shareUI.saveSuccess') : t('shareUI.saveSuccessWatermark')
      : t('shareUI.saveFailed');
    onShare?.('download', { success, message });
  };

  const handleShare = async (platform: 'instagram' | 'twitter' | 'facebook' | 'kakao' | 'copy') => {
    const result = await shareToSNS(imageUrl, platform, shouldAddWatermark, logoUrl, lookId, prompt, tags);
    setIsShareOpen(false);
    onShare?.(platform, result);
  };

  // 모바일 Chrome에서 navigator.share()는 클릭 핸들러의 동기 컨텍스트에서 호출해야 한다.
  // await로 한 번이라도 끊기면 Chrome이 사용자 제스처로 인정하지 않아 공유 시트가 안 뜬다.
  // 따라서 카카오 버튼 onClick에서 직접 호출하는 전용 핸들러를 둔다.
  const handleKakaoClickSync = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
    const isMobileChrome = isMobile && /CriOS|Chrome|Chromium/i.test(ua) && !/Edg|OPR|SamsungBrowser|Whale/i.test(ua);
    const baseUrl = 'https://showmelook.com';
    const shareUrl = lookId ? `${baseUrl}/look/${lookId}` : baseUrl;

    if (isMobileChrome) {
      setIsShareOpen(false);
      if (lookId) {
        void supabase.from('generated_looks').update({ is_public: true }).eq('id', lookId).then(() => {}, () => {});
      }
      navigator.clipboard?.writeText(shareUrl).then(
        () => onShare?.('kakao', { success: true, message: '모바일 Chrome에서는 링크가 복사되었습니다. 카카오톡에 붙여넣어 공유해주세요.' }),
        () => onShare?.('kakao', { success: false, message: '링크 복사에 실패했습니다.' })
      );
      return;
    }

    if (isMobile && typeof navigator.share === 'function') {
      // 동기 컨텍스트에서 즉시 호출 (await 금지)
      const sharePromise = navigator.share({
        title: '👗 쇼미룩 AI 스타일',
        text: prompt ? prompt.slice(0, 80) : 'AI가 만든 나만의 스타일을 확인해보세요!',
        url: shareUrl,
      });
      // 부수 작업은 이후로 미룬다
      setIsShareOpen(false);
      if (lookId) {
        void supabase.from('generated_looks').update({ is_public: true }).eq('id', lookId).then(() => {}, () => {});
      }
      sharePromise.then(
        () => onShare?.('kakao', { success: true }),
        (e: Error) => {
          if (e?.name === 'AbortError') {
            onShare?.('kakao', { success: true, message: '공유가 취소되었습니다.' });
            return;
          }
          // 실패 시 링크 복사 fallback
          const text = `${shareUrl}`;
          navigator.clipboard?.writeText(text).then(
            () => onShare?.('kakao', { success: true, message: '공유 시트를 열 수 없어 링크를 복사했습니다.' }),
            () => onShare?.('kakao', { success: false, message: '공유에 실패했습니다.' })
          );
        }
      );
      return;
    }

    // === PC (Desktop): Kakao 로그인 후 공유 ===
    try {
      const Kakao = (window as any).Kakao;
      if (!Kakao) throw new Error('Kakao SDK not loaded');
      if (!Kakao.isInitialized()) {
        Kakao.init(KAKAO_JS_KEY);
      }
      if (!Kakao.isInitialized()) throw new Error('Kakao SDK not initialized');

      const markPublic = () => {
        if (lookId) {
          void supabase.from('generated_looks').update({ is_public: true }).eq('id', lookId).then(() => {}, () => {});
        }
      };
      const COPIED_MSG = '링크가 복사되었습니다. 카카오톡 메시지창에 붙여넣어 보내주세요.';
      const fallbackCopy = () => {
        const notifyCopied = () => {
          toast.success(COPIED_MSG, { duration: 5000 });
          onShare?.('kakao', { success: true, message: COPIED_MSG });
        };
        const notifyManual = () => {
          const manualMsg = `링크 복사에 실패했어요. 아래 주소를 복사해 카카오톡에 붙여넣어 주세요: ${shareUrl}`;
          toast.error(manualMsg, { duration: 8000 });
          onShare?.('kakao', { success: false, message: manualMsg });
        };
        try {
          const p = navigator.clipboard?.writeText(shareUrl);
          if (p && typeof p.then === 'function') {
            p.then(notifyCopied, notifyManual);
          } else {
            notifyCopied();
          }
        } catch {
          notifyManual();
        }
      };
      const doShare = () => {
        try {
          Kakao.Share.sendDefault(getKakaoSharePayload(imageUrl, shareUrl, prompt));
          markPublic();
          onShare?.('kakao', { success: true, message: '카카오톡 공유 창이 열렸습니다.' });
        } catch (e) {
          console.error('[Kakao Share] sendDefault error:', e);
          fallbackCopy();
        }
      };

      setIsShareOpen(false);

      const hasToken = typeof Kakao.Auth?.getAccessToken === 'function' && !!Kakao.Auth.getAccessToken();
      if (hasToken) {
        doShare();
        return;
      }

      if (Kakao.Auth?.login) {
        let settled = false;
        const finish = (ok: boolean, err?: unknown) => {
          if (settled) return;
          settled = true;
          if (ok) {
            doShare();
          } else {
            console.error('[Kakao Share] login fail:', err);
            fallbackCopy('카카오 로그인 실패. 링크가 복사되었습니다!');
          }
        };
        try {
          const ret = Kakao.Auth.login({
            scope: 'profile_nickname',
            success: () => finish(true),
            fail: (err: unknown) => finish(false, err),
          });
          // v2 SDK: also returns a Promise
          if (ret && typeof ret.then === 'function') {
            ret.then(() => finish(true)).catch((err: unknown) => finish(false, err));
          }
        } catch (err) {
          finish(false, err);
        }
      } else {
        doShare();
      }
    } catch (err) {
      console.error('[Kakao Share] desktop flow error:', err);
      setIsShareOpen(false);
      navigator.clipboard?.writeText(shareUrl).then(
        () => {
          const msg = '카카오톡 공유 실패. 링크가 복사되었습니다!';
          toast.success(msg);
          onShare?.('kakao', { success: true, message: msg });
        },
        () => {
          toast.error('공유에 실패했습니다.');
          onShare?.('kakao', { success: false, message: '공유에 실패했습니다.' });
        }
      );
    }
  };

  if (compact) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {showDownload && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
            title={!shouldAddWatermark ? t('shareUI.saveTitle') : t('shareUI.saveTitleWatermark')}
          >
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin text-foreground" /> : <Download className="w-5 h-5 text-foreground" />}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setIsShareOpen(!isShareOpen)}
            className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
            title={t('shareUI.share')}
          >
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
          <Popover open={isShareOpen} onOpenChange={setIsShareOpen}>
            <PopoverTrigger asChild>
              <span className="sr-only">{t('shareUI.shareMenu')}</span>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8} className="w-[180px] p-2 z-[9999]" onOpenAutoFocus={(e) => e.preventDefault()}>
              {shouldAddWatermark && (
                <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                    <Crown className="w-3 h-3" />{t('shareUI.watermarkHint')}
                  </p>
                </div>
              )}
              <ShareMenuItem emoji="📸" label="Instagram" onClick={() => handleShare('instagram')} />
              <ShareMenuItem emoji="🐦" label="Twitter" onClick={() => handleShare('twitter')} />
              <ShareMenuItem emoji="📘" label="Facebook" onClick={() => handleShare('facebook')} />
              <ShareMenuItem emoji="💬" label="KakaoTalk" onClick={handleKakaoClickSync} />
              <div className="my-1 border-t border-border" />
              <ShareMenuItem emoji="🔗" label={t('shareUI.copyLink')} onClick={() => handleShare('copy')} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {showDownload && (
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading} className="font-korean"
          title={!shouldAddWatermark ? t('shareUI.saveTitle') : t('shareUI.saveTitleWatermark')}>
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
          {t('shareUI.save')}{shouldAddWatermark && ' 🏷️'}
        </Button>
      )}
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setIsShareOpen(!isShareOpen)} className="font-korean">
          <Share2 className="w-4 h-4 mr-1.5" />{t('shareUI.share')}
        </Button>
        {isShareOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsShareOpen(false)} />
            <div className="absolute right-0 top-10 z-50 bg-background rounded-xl border border-border shadow-xl p-2 min-w-[160px] animate-in slide-in-from-top-2 fade-in duration-200">
              {shouldAddWatermark && (
                <div className="px-3 py-2 mb-1 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-accent font-korean flex items-center gap-1">
                    <Crown className="w-3 h-3" />{t('shareUI.watermarkHint')}
                  </p>
                </div>
              )}
              <ShareMenuItem emoji="📸" label="Instagram" onClick={() => handleShare('instagram')} />
              <ShareMenuItem emoji="🐦" label="Twitter" onClick={() => handleShare('twitter')} />
              <ShareMenuItem emoji="📘" label="Facebook" onClick={() => handleShare('facebook')} />
              <ShareMenuItem emoji="💬" label="KakaoTalk" onClick={handleKakaoClickSync} />
              <div className="my-1 border-t border-border" />
              <ShareMenuItem emoji="🔗" label={t('shareUI.copyLink')} onClick={() => handleShare('copy')} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ShareMenuItem = ({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left">
    <span className="text-lg">{emoji}</span>
    <span className="text-sm font-korean text-foreground">{label}</span>
  </button>
);
