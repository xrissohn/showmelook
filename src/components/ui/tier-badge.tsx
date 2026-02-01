/**
 * TierBadge - 재사용 가능한 등급 배지 컴포넌트
 * 네비게이션, 마이페이지 등 여러 곳에서 사용
 */

import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TierType, TIER_CONFIG } from '@/lib/tierConfig';
import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: TierType;
  size?: 'sm' | 'md';
  showIcon?: boolean;
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

export const TierBadge = ({ 
  tier, 
  size = 'md', 
  showIcon = false,
  className 
}: TierBadgeProps) => {
  const config = TIER_CONFIG[tier];

  return (
    <Badge 
      className={cn(
        tierStyles[tier],
        sizeStyles[size],
        'font-bold border-0 whitespace-nowrap',
        className
      )}
    >
      {showIcon && <Crown className={cn(iconSizes[size], 'mr-0.5')} />}
      {config.nameKo}
    </Badge>
  );
};

export default TierBadge;
