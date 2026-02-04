/**
 * UpgradeModal - 등급 업그레이드 유도 모달
 * 구매 기반 등급 시스템으로 안내
 */

import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, Crown, Images, Download, Users, ShoppingBag, CheckCircle2, TrendingUp, Gift } from 'lucide-react';
import { UPGRADE_MESSAGES, UpgradeReason } from '@/lib/planConfig';
import { TIER_CONFIG, TierType, formatAmountKo } from '@/lib/tierConfig';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: UpgradeReason;
  currentTier?: TierType;
}

const ReasonIcon = ({ reason }: { reason: UpgradeReason }) => {
  switch (reason) {
    case 'recommend-first':
      return <Sparkles className="w-8 h-8 text-primary" />;
    case 'daily-limit':
      return <Lock className="w-8 h-8 text-amber-500" />;
    case 'gallery-limit':
      return <Images className="w-8 h-8 text-blue-500" />;
    case 'hd-download':
      return <Download className="w-8 h-8 text-green-500" />;
    case 'family-profile':
    case 'family-limit':
      return <Users className="w-8 h-8 text-purple-500" />;
    default:
      return <Crown className="w-8 h-8 text-amber-400" />;
  }
};

// 등급별 색상 스타일
const tierGradients: Record<TierType, string> = {
  free: 'from-gray-400 to-gray-500',
  bronze: 'from-amber-600 to-amber-700',
  silver: 'from-gray-400 to-gray-500',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-purple-500 to-pink-500',
};

export const UpgradeModal = ({ 
  open, 
  onOpenChange, 
  reason,
  currentTier = 'free' 
}: UpgradeModalProps) => {
  const navigate = useNavigate();

  const message = UPGRADE_MESSAGES[reason];
  const currentConfig = TIER_CONFIG[currentTier];

  // 다음 등급 계산
  const tierOrder: TierType[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];
  const currentIdx = tierOrder.indexOf(currentTier);
  const nextTier = currentIdx < tierOrder.length - 1 ? tierOrder[currentIdx + 1] : null;
  const nextConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  const handleViewPricing = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const handleStartShopping = () => {
    onOpenChange(false);
    navigate('/style');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <ReasonIcon reason={reason} />
          </div>
          <DialogTitle className="text-xl font-korean">
            {message.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2 font-korean">
            {message.description}
          </DialogDescription>
        </DialogHeader>

        {/* 등급 업그레이드 안내 */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold font-korean">등급 혜택 안내</span>
          </div>
          <p className="text-sm text-muted-foreground font-korean mb-3">
            {message.tierMessage}
          </p>
          
          {/* 다음 등급 미리보기 */}
          {nextTier && nextConfig && (
            <div className="p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${tierGradients[nextTier]} flex items-center justify-center`}>
                  <Crown className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-sm font-korean">{nextConfig.nameKo} 등급</span>
                <span className="ml-auto text-xs text-muted-foreground font-korean">
                  {nextTier === 'bronze' ? '첫 구매 시' : `누적 ${formatAmountKo(nextConfig.minAmount)}`}
                </span>
              </div>
              <ul className="space-y-1">
                {(nextConfig.highlightFeatures || nextConfig.features.slice(0, 3)).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs font-korean">
                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 구매 유도 안내 */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-400 font-korean">
              쇼미룩에서 쇼핑하면 등급 UP!
            </span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 font-korean">
            추천받은 상품을 구매하면 자동으로 등급이 올라가고,
            더 많은 혜택을 누릴 수 있어요!
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 font-korean"
            onClick={() => onOpenChange(false)}
          >
            다음에 할게요
          </Button>
          <Button 
            variant="hero" 
            className="flex-1 font-korean"
            onClick={handleStartShopping}
          >
            <ShoppingBag className="w-4 h-4 mr-1" />
            쇼핑하러 가기
          </Button>
        </div>
        
        <div className="text-center">
          <Button 
            variant="link" 
            size="sm"
            className="text-xs text-muted-foreground font-korean"
            onClick={handleViewPricing}
          >
            등급별 혜택 자세히 보기 →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};