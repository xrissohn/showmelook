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
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6">
      {/* 닫기 버튼 */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* 로고 */}
        <img 
          src={showmelookLogo} 
          alt="쇼미룩" 
          className="w-16 h-16 object-contain mb-6"
        />
        
        {/* 메인 아이콘 */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <ExternalLink className="w-8 h-8 text-primary" />
        </div>
        
        {/* 제목 */}
        <h1 className="text-xl font-bold text-foreground mb-2 font-korean">
          외부 브라우저로 열어주세요
        </h1>
        
        {/* 간단한 설명 */}
        <p className="text-muted-foreground text-sm mb-6 font-korean">
          {browserInfo.browserName}에서는 로그인이 제한됩니다
        </p>
        
        {/* 메인 버튼 영역 */}
        <div className="w-full flex flex-col gap-3">
          {/* Android: Chrome으로 열기 */}
          {browserInfo.isAndroid && (
            <Button
              size="lg"
              className="w-full gap-2 font-korean text-base"
              onClick={handleOpenExternal}
            >
              <ExternalLink className="w-5 h-5" />
              Chrome에서 열기
            </Button>
          )}
          
          {/* iOS: 링크 복사 */}
          {browserInfo.isIOS && (
            <Button
              size="lg"
              className="w-full gap-2 font-korean text-base"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  복사완료! Safari에서 붙여넣기
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  링크 복사하기
                </>
              )}
            </Button>
          )}
          
          {/* Android에서도 복사 옵션 제공 */}
          {browserInfo.isAndroid && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2 font-korean"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-primary" />
                  복사 완료!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  링크 복사
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* 앱별 힌트 */}
        <div className="mt-6 p-3 bg-muted/50 rounded-lg w-full">
          <p className="text-xs text-muted-foreground font-korean">
            {browserInfo.browserName === '카카오톡' && (
              <>💡 우측 상단 <span className="font-medium">⋮</span> → 다른 브라우저로 열기</>
            )}
            {browserInfo.browserName === '인스타그램' && (
              <>💡 우측 상단 <span className="font-medium">⋮</span> → 브라우저에서 열기</>
            )}
            {browserInfo.browserName === '네이버 앱' && (
              <>💡 하단 <span className="font-medium">⋮</span> → 기본 브라우저로 열기</>
            )}
            {!['카카오톡', '인스타그램', '네이버 앱'].includes(browserInfo.browserName) && (
              <>💡 메뉴에서 "외부 브라우저로 열기"를 찾아보세요</>
            )}
          </p>
        </div>
        
        {/* 이대로 보기 */}
        <button
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 font-korean"
          onClick={handleDismiss}
        >
          이대로 계속하기
        </button>
      </div>
    </div>
  );
}
