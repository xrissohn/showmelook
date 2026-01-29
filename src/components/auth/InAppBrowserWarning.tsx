import { useState } from 'react';
import { ExternalLink, Copy, Check, Smartphone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InAppBrowserInfo, getExternalBrowserUrl, copyToClipboard } from '@/lib/inAppBrowserDetector';

interface InAppBrowserWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  browserInfo: InAppBrowserInfo;
  onContinueAnyway?: () => void;
}

export function InAppBrowserWarning({
  open,
  onOpenChange,
  browserInfo,
  onContinueAnyway,
}: InAppBrowserWarningProps) {
  const [copied, setCopied] = useState(false);
  const currentUrl = window.location.href;
  
  const handleCopyLink = async () => {
    const success = await copyToClipboard(currentUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleOpenExternal = () => {
    const externalUrl = getExternalBrowserUrl(currentUrl, browserInfo.isAndroid);
    if (externalUrl) {
      window.location.href = externalUrl;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-accent/10">
              <AlertTriangle className="w-6 h-6 text-accent" />
            </div>
            <DialogTitle className="font-korean text-lg">
              외부 브라우저에서 열어주세요
            </DialogTitle>
          </div>
          <DialogDescription className="font-korean text-left space-y-2">
            <p>
              <span className="font-medium text-foreground">{browserInfo.browserName || '현재 앱'}</span>의 
              내장 브라우저에서는 Google 로그인이 지원되지 않습니다.
            </p>
            <p className="text-muted-foreground">
              보안 정책에 따라 Chrome, Safari 등 외부 브라우저에서만 Google 로그인이 가능합니다.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          {/* Android: Chrome으로 열기 */}
          {browserInfo.isAndroid && (
            <Button
              variant="default"
              className="w-full gap-2 font-korean"
              onClick={handleOpenExternal}
            >
              <ExternalLink className="w-4 h-4" />
              Chrome에서 열기
            </Button>
          )}
          
          {/* 링크 복사 */}
          <Button
            variant={browserInfo.isIOS ? "default" : "outline"}
            className="w-full gap-2 font-korean"
            onClick={handleCopyLink}
          >
          {copied ? (
              <>
                <Check className="w-4 h-4 text-primary" />
                복사되었습니다!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                링크 복사하기
              </>
            )}
          </Button>
          
          {browserInfo.isIOS && (
            <p className="text-xs text-muted-foreground text-center font-korean">
              링크를 복사한 후 Safari에서 붙여넣기 해주세요
            </p>
          )}
          
          {/* 이메일 로그인 권장 */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground font-korean">또는</span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            className="w-full gap-2 font-korean text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <Smartphone className="w-4 h-4" />
            이메일로 가입/로그인하기
          </Button>
          
          {onContinueAnyway && (
            <button
              onClick={() => {
                onContinueAnyway();
                onOpenChange(false);
              }}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors font-korean"
            >
              그래도 시도해보기 (실패할 수 있음)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
