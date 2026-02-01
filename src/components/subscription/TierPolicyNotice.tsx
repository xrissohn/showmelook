/**
 * TierPolicyNotice - 등급 정책 안내 컴포넌트
 * 구매 후 등급 적용, 환불 시 변동 등 정책 안내
 */

import { Info, AlertTriangle, Clock, ArrowDownUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TierPolicyNoticeProps {
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export const TierPolicyNotice = ({ 
  variant = 'default', 
  className 
}: TierPolicyNoticeProps) => {
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}>
        <Info className="w-3 h-3 flex-shrink-0" />
        <span className="font-korean">
          구매 확인 후 1~24시간 내 등급 적용 · 취소/환불 시 변동 가능
        </span>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn(
        "space-y-4 p-5 bg-muted/50 rounded-lg border border-border",
        className
      )}>
        <h4 className="font-semibold text-foreground font-korean flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          등급 적용 안내
        </h4>
        
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">등급 적용 시점</p>
              <p>구매 확인 후 1~24시간 이내에 등급이 자동으로 적용됩니다.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <ArrowDownUp className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">등급 변동</p>
              <p>주문 취소 또는 환불 시 누적 금액이 조정되어 등급이 변동될 수 있습니다.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">모델 프로필 유예</p>
              <p>등급 변동으로 모델 프로필 슬롯이 줄어들 경우, 3일간의 유예 기간이 주어집니다.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn(
      "text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg",
      className
    )}>
      <h4 className="font-medium mb-2 text-foreground font-korean flex items-center gap-2">
        <Info className="w-4 h-4 text-primary" />
        등급 적용 안내
      </h4>
      <ul className="list-disc list-inside space-y-1 font-korean">
        <li>구매 확인 후 1~24시간 이내에 등급이 자동 적용됩니다.</li>
        <li>주문 취소 또는 환불 시 누적 금액이 조정되어 등급이 변동될 수 있습니다.</li>
        <li>등급 변동 시 모델 프로필은 3일간의 유예 기간이 주어집니다.</li>
      </ul>
    </div>
  );
};

// 등급 변경 알림용 토스트 메시지 생성 헬퍼
export const getTierChangeToastConfig = (
  previousTier: string,
  newTier: string,
  reason: 'purchase' | 'refund' | 'admin'
) => {
  const tierNamesKo: Record<string, string> = {
    free: '무료',
    bronze: '브론즈',
    silver: '실버',
    gold: '골드',
    platinum: '플래티넘',
  };

  const isUpgrade = ['bronze', 'silver', 'gold', 'platinum'].indexOf(newTier) >
    ['bronze', 'silver', 'gold', 'platinum'].indexOf(previousTier);

  if (isUpgrade) {
    return {
      title: '🎉 등급 업그레이드!',
      description: `${tierNamesKo[newTier]} 등급으로 업그레이드되었습니다.`,
      variant: 'default' as const,
    };
  }

  if (reason === 'refund') {
    return {
      title: '등급 변경 알림',
      description: `환불 처리로 ${tierNamesKo[newTier]} 등급으로 변경되었습니다.`,
      variant: 'default' as const,
    };
  }

  return {
    title: '등급 변경',
    description: `${tierNamesKo[newTier]} 등급으로 변경되었습니다.`,
    variant: 'default' as const,
  };
};

// 구매 버튼 근처 안내 텍스트 컴포넌트
export const TierBenefitHint = ({ className }: { className?: string }) => (
  <p className={cn(
    "text-xs text-muted-foreground font-korean",
    className
  )}>
    ✨ 구매 시 등급 혜택이 적용됩니다 (1~24시간 소요)
  </p>
);
