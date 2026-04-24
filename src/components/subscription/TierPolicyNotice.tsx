/**
 * TierPolicyNotice - 등급 정책 안내 컴포넌트
 * 구매 후 등급 적용, 환불 시 변동 등 정책 안내
 */

import { Info, AlertTriangle, Clock, ArrowDownUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface TierPolicyNoticeProps {
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export const TierPolicyNotice = ({
  variant = 'default',
  className,
}: TierPolicyNoticeProps) => {
  const { t } = useLanguage();

  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}>
        <Info className="w-3 h-3 flex-shrink-0" />
        <span className="font-korean">{t('subscription.policyCompact')}</span>
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
          {t('subscription.tierBenefitsTitle')}
        </h4>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">{t('subscription.policyApplyTime')}</p>
              <p>{t('subscription.policyApplyTimeDesc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ArrowDownUp className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">{t('subscription.policyChange')}</p>
              <p>{t('subscription.policyChangeDesc')}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
            <div className="font-korean">
              <p className="font-medium text-foreground">{t('subscription.policyGracePeriod')}</p>
              <p>{t('subscription.policyGracePeriodDesc')}</p>
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
        {t('subscription.tierBenefitsTitle')}
      </h4>
      <ul className="list-disc list-inside space-y-1 font-korean">
        <li>{t('subscription.policyDefault1')}</li>
        <li>{t('subscription.policyDefault2')}</li>
        <li>{t('subscription.policyDefault3')}</li>
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
export const TierBenefitHint = ({ className }: { className?: string }) => {
  const { t } = useLanguage();
  return (
    <p className={cn("text-xs text-muted-foreground font-korean", className)}>
      {t('subscription.benefitHint')}
    </p>
  );
};
