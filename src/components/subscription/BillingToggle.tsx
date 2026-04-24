/**
 * BillingToggle - 월간/연간 결제 토글
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BillingToggleProps {
  isYearly: boolean;
  onToggle: (isYearly: boolean) => void;
  className?: string;
}

export const BillingToggle = ({ isYearly, onToggle, className }: BillingToggleProps) => {
  const { t } = useLanguage();
  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      <button
        onClick={() => onToggle(false)}
        className={cn(
          'px-4 py-2 rounded-lg font-medium transition-all font-korean',
          !isYearly
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t('subscription.monthlyBilling')}
      </button>

      <div className="relative">
        <button
          onClick={() => onToggle(true)}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-all font-korean',
            isYearly
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t('subscription.yearlyBilling')}
        </button>

        <Badge
          className={cn(
            'absolute -top-2 -right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-1.5 py-0.5 shadow-md',
            isYearly ? 'animate-bounce' : ''
          )}
        >
          {t('subscription.twoMonthsFree')}
        </Badge>
      </div>
    </div>
  );
};
