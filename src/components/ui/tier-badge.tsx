/**
 * TierBadge - 재사용 가능한 등급 배지 컴포넌트
 * 네비게이션, 마이페이지 등 여러 곳에서 사용
 * 호버 시 혜택 요약 툴팁 표시
 */

import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TierType, TIER_CONFIG } from '@/lib/tierConfig';
import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: TierType;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const tierStyles: Record<TierType, string> = {
  free: 'bg-gray-500 text-white hover:bg-gray-500',
  bronze: 'bg-amber-700 text-white hover:bg-amber-700',
  silver: 'bg-gray-400 text-white hover:bg-gray-400',
  gold: 'bg-yellow-500 text-black hover:bg-yellow-500',
  platinum: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-500 hover:to-pink-500',
};

const sizeStyles = {
  sm: 'text-[10px] px-1.5 py-0.5 h-auto',
  md: 'text-xs px-2.5 py-0.5',
};

const iconSizes = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
};

// 등급별 혜택 요약 (툴팁용)
const getTierBenefits = (tier: TierType): string[] => {
  const config = TIER_CONFIG[tier];
  const benefits: string[] = [];
  
  benefits.push(`일일 ${config.dailyLimit === -1 ? '무제한' : `${config.dailyLimit}회`}`);
  benefits.push(`월간 ${config.monthlyLimit === -1 ? '무제한' : `${config.monthlyLimit}회`}`);
  benefits.push(config.hasWatermark ? '워터마크 있음' : '워터마크 없음');
  
  if (config.hdDownload) benefits.push('고화질 다운로드');
  if (tier === 'platinum') benefits.push('모델 프로필 추가 가능');
  
  return benefits;
};

export const TierBadge = ({ 
  tier, 
  size = 'md', 
  showIcon = false,
  showTooltip = true,
  className 
}: TierBadgeProps) => {
  const config = TIER_CONFIG[tier];
  const benefits = getTierBenefits(tier);

  const badgeElement = (
    <Badge 
      className={cn(
        tierStyles[tier],
        sizeStyles[size],
        'font-bold border-0 whitespace-nowrap cursor-default',
        className
      )}
    >
      {showIcon && <Crown className={cn(iconSizes[size], 'mr-0.5')} />}
      {config.nameKo}
    </Badge>
  );

  if (!showTooltip) {
    return badgeElement;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeElement}
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-[200px] p-3"
          sideOffset={5}
        >
          <div className="space-y-1">
            <p className="font-bold text-sm font-korean">{config.nameKo} 등급</p>
            <ul className="text-xs space-y-0.5">
              {benefits.map((benefit, idx) => (
                <li key={idx} className="text-muted-foreground font-korean">
                  • {benefit}
                </li>
              ))}
            </ul>
            {tier !== 'free' && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-2 font-korean">
                누적 구매 {tier === 'bronze' ? '1원' : `${TIER_CONFIG[tier].minAmount.toLocaleString()}원`} 이상
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TierBadge;
