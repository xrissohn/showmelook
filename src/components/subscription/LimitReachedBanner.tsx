/**
 * LimitReachedBanner - 한도 도달 배너
 * 업그레이드 CTA 포함
 */

import { useState } from 'react';
import { X, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UpgradeReason } from '@/lib/planConfig';
import { UpgradeModal } from './UpgradeModal';

interface LimitReachedBannerProps {
  reason: UpgradeReason;
  current: number;
  limit: number;
  onDismiss?: () => void;
  className?: string;
}

export const LimitReachedBanner = ({
  reason,
  current,
  limit,
  onDismiss,
  className = '',
}: LimitReachedBannerProps) => {
  const [showModal, setShowModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const getMessage = () => {
    switch (reason) {
      case 'daily-limit':
        return `오늘의 생성 횟수를 모두 사용했어요 (${current}/${limit}회)`;
      case 'gallery-limit':
        return `갤러리가 꽉 찼어요 (${current}/${limit}장)`;
      case 'family-limit':
        return `가족 프로필이 가득 찼어요 (${current}/${limit}명)`;
      default:
        return '한도에 도달했어요';
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <>
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 p-4 ${className}`}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/10 to-amber-500/5 animate-pulse" />
        
        <div className="relative flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 dark:text-amber-200 font-korean">
              {getMessage()}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-korean">
              업그레이드하면 더 많이 사용할 수 있어요
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowModal(true)}
            className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 font-korean"
          >
            <Crown className="w-4 h-4 mr-1" />
            업그레이드
          </Button>

          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
          >
            <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </button>
        </div>
      </div>

      <UpgradeModal
        open={showModal}
        onOpenChange={setShowModal}
        reason={reason}
      />
    </>
  );
};
