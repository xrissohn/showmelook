import { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectInAppBrowser, getExternalBrowserUrl, copyToClipboard, InAppBrowserInfo } from '@/lib/inAppBrowserDetector';
import showmelookLogo from '@/assets/showmelook-logo.webp';

/**
 * 인앱 브라우저에서 접속 시 외부 브라우저로 열기를 안내하는 전체화면 컴포넌트
 * Android에서는 Chrome Intent로 자동 열기 시도
 */
export function InAppBrowserRedirect() {
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoRedirectAttempted, setAutoRedirectAttempted] = useState(false);
  
  const currentUrl = window.location.href;
  
  useEffect(() => {
    const info = detectInAppBrowser();
    setBrowserInfo(info);
    
    // 세션에서 이미 dismiss 했는지 확인
    const wasDismissed = sessionStorage.getItem('inapp_browser_dismissed');
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
    
    // Android에서 자동으로 Chrome Intent 시도 (한 번만)
    if (info.isInAppBrowser && info.isAndroid && !wasDismissed) {
      const alreadyTried = sessionStorage.getItem('chrome_intent_tried');
      if (!alreadyTried) {
        sessionStorage.setItem('chrome_intent_tried', 'true');
        setAutoRedirectAttempted(true);
        
        // 약간의 딜레이 후 Chrome Intent 시도
        setTimeout(() => {
          const externalUrl = getExternalBrowserUrl(currentUrl, true);
          if (externalUrl) {
            window.location.href = externalUrl;
          }
        }, 500);
      }
    }
  }, [currentUrl]);
  
  const handleCopyLink = async () => {
    const success = await copyToClipboard(currentUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleOpenExternal = () => {
    if (browserInfo?.isAndroid) {
      const externalUrl = getExternalBrowserUrl(currentUrl, true);
      if (externalUrl) {
        window.location.href = externalUrl;
      }
    }
  };
  
  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('inapp_browser_dismissed', 'true');
  };
  
  // 인앱 브라우저가 아니거나 이미 dismiss 했으면 표시 안함
  if (!browserInfo?.isInAppBrowser || dismissed) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-background via-background to-primary/5 flex flex-col items-center justify-center p-6">
      {/* 닫기 버튼 */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>
      
      {/* 로고 */}
      <div className="mb-8">
        <img 
          src={showmelookLogo} 
          alt="쇼미룩" 
          className="w-20 h-20 object-contain"
        />
      </div>
      
      {/* 아이콘 */}
      <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
        <Smartphone className="w-10 h-10 text-accent" />
      </div>
      
      {/* 제목 */}
      <h1 className="text-2xl font-bold text-foreground mb-3 text-center font-korean">
        외부 브라우저에서 열어주세요
      </h1>
      
      {/* 설명 */}
      <p className="text-muted-foreground text-center mb-2 font-korean max-w-xs">
        <span className="font-medium text-foreground">{browserInfo.browserName}</span>의 
        내장 브라우저에서는 일부 기능이 제한됩니다.
      </p>
      <p className="text-muted-foreground/70 text-sm text-center mb-8 font-korean max-w-xs">
        더 나은 경험을 위해 Chrome이나 Safari에서 열어주세요.
      </p>
      
      {/* 버튼들 */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {/* Android: Chrome으로 열기 */}
        {browserInfo.isAndroid && (
          <Button
            variant="default"
            size="lg"
            className="w-full gap-2 font-korean"
            onClick={handleOpenExternal}
          >
            <ExternalLink className="w-5 h-5" />
            Chrome에서 열기
          </Button>
        )}
        
        {/* 링크 복사 (iOS는 메인 버튼) */}
        <Button
          variant={browserInfo.isIOS ? "default" : "outline"}
          size="lg"
          className="w-full gap-2 font-korean"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-primary" />
              링크가 복사되었습니다!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              링크 복사하기
            </>
          )}
        </Button>
        
        {browserInfo.isIOS && (
          <p className="text-xs text-muted-foreground text-center font-korean">
            링크를 복사한 후 Safari에서 붙여넣기 해주세요
          </p>
        )}
        
        {/* 구분선 */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground font-korean">또는</span>
          </div>
        </div>
        
        {/* 이대로 보기 */}
        <Button
          variant="ghost"
          size="lg"
          className="w-full font-korean text-muted-foreground"
          onClick={handleDismiss}
        >
          이대로 계속하기
        </Button>
      </div>
      
      {/* 하단 힌트 */}
      <div className="absolute bottom-8 left-0 right-0 px-6">
        <p className="text-xs text-muted-foreground/50 text-center font-korean">
          {browserInfo.browserName === '카카오톡' && (
            <>💡 팁: 우측 상단 ⋮ 메뉴 → "다른 브라우저로 열기"</>
          )}
          {browserInfo.browserName === '인스타그램' && (
            <>💡 팁: 우측 상단 ⋮ 메뉴 → "브라우저에서 열기"</>
          )}
          {browserInfo.browserName === '네이버 앱' && (
            <>💡 팁: 하단 ⋮ 메뉴 → "기본 브라우저로 열기"</>
          )}
        </p>
      </div>
    </div>
  );
}
