/**
 * PlanCard - 개별 플랜 카드 컴포넌트
 */

import { CheckCircle2, Crown, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanConfig, PlanType, formatPrice, getMonthlyEquivalent, getYearlySavings } from '@/lib/planConfig';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: PlanType;
  config: PlanConfig;
  isYearly: boolean;
  isCurrentPlan: boolean;
  onSelect: (plan: PlanType) => void;
  isPopular?: boolean;
}

export const PlanCard = ({
  plan,
  config,
  isYearly,
  isCurrentPlan,
  onSelect,
  isPopular = false,
}: PlanCardProps) => {
  const price = isYearly ? config.yearlyPrice : config.monthlyPrice;
  const monthlyEquivalent = isYearly ? getMonthlyEquivalent(config.yearlyPrice) : config.monthlyPrice;
  const savings = isYearly ? getYearlySavings(config.monthlyPrice, config.yearlyPrice) : 0;

  const PlanIcon = plan === 'premium' ? Crown : plan === 'pro' ? Zap : Sparkles;

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-6 transition-all duration-300',
        isPopular
          ? 'border-primary bg-gradient-to-b from-primary/5 to-accent/5 shadow-lg shadow-primary/10 scale-105 z-10'
          : 'border-border bg-card hover:border-primary/50',
        isCurrentPlan && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-primary to-accent text-white px-4 py-1 font-korean">
            인기
          </Badge>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="outline" className="bg-background font-korean">
            현재 플랜
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <div className={cn(
          'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3',
          plan === 'premium' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
          plan === 'pro' ? 'bg-gradient-to-br from-primary to-accent' :
          'bg-muted'
        )}>
          <PlanIcon className={cn(
            'w-6 h-6',
            plan === 'free' ? 'text-muted-foreground' : 'text-white'
          )} />
        </div>
        
        <h3 className="text-xl font-bold font-korean">{config.nameKo}</h3>
        <p className="text-sm text-muted-foreground font-korean">{config.name}</p>
      </div>

      {/* Pricing */}
      <div className="text-center mb-6">
        {price === 0 ? (
          <div className="text-3xl font-bold">무료</div>
        ) : (
          <>
            <div className="text-3xl font-bold">
              {formatPrice(isYearly ? monthlyEquivalent : price)}
              <span className="text-base font-normal text-muted-foreground">/월</span>
            </div>
            {isYearly && price > 0 && (
              <div className="mt-1 space-y-1">
                <div className="text-sm text-muted-foreground">
                  연 {formatPrice(price)} 결제
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {formatPrice(savings)} 절약
                </Badge>
              </div>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {config.features.map((feature, idx) => {
          const isHighlight = config.highlightFeatures?.includes(feature);
          return (
            <li 
              key={idx} 
              className={cn(
                'flex items-start gap-2 text-sm font-korean',
                isHighlight && 'font-semibold text-primary'
              )}
            >
              <CheckCircle2 className={cn(
                'w-4 h-4 mt-0.5 flex-shrink-0',
                isHighlight ? 'text-primary' : 'text-green-500'
              )} />
              <span>{feature}</span>
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      <Button
        variant={isCurrentPlan ? 'outline' : (isPopular ? 'hero' : 'default')}
        className="w-full font-korean"
        onClick={() => onSelect(plan)}
        disabled={isCurrentPlan}
      >
        {isCurrentPlan ? '현재 플랜' : plan === 'free' ? '무료로 시작' : '업그레이드'}
      </Button>
    </div>
  );
};
