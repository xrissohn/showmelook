/**
 * TierStatusCard - 구매 기반 등급 표시 카드
 */

import { Crown, TrendingUp, ShoppingBag, Sparkles, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { TierType, TIER_CONFIG, formatAmount, getTierName, getTierBenefitsSummary } from '@/lib/tierConfig';
import { PurchaseStats, TierChangeRecord } from '@/hooks/usePurchaseStats';
import { TierBadge } from '@/components/ui/tier-badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface TierStatusCardProps {
  stats: PurchaseStats | null;
  progressToNextTier: number;
  nextTierInfo: { nextTier: TierType | null; amountNeeded: number };
  tierHistory: TierChangeRecord[];
  isLoading?: boolean;
}

// English summaries for next-tier preview
const TIER_BENEFITS_EN: Record<TierType, string[]> = {
  free: [],
  bronze: ['Unlimited monthly generations', 'No watermark', 'HD download'],
  silver: ['10 daily generations', 'Preview recommendations', '50 gallery saves'],
  gold: ['20 daily generations', '100 gallery saves', 'Permanent history'],
  platinum: ['Everything unlimited', 'Add model profiles', 'Priority queue'],
};

export const TierStatusCard = ({
  stats,
  progressToNextTier,
  nextTierInfo,
  tierHistory,
  isLoading,
}: TierStatusCardProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const currentTier = stats?.currentTier || 'free';
  const tierConfig = TIER_CONFIG[currentTier];
  const totalAmount = stats?.totalPurchasedAmount || 0;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded w-full mb-2" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const getBenefitsSummary = (tier: TierType): string[] => {
    return language === 'en' ? TIER_BENEFITS_EN[tier] : getTierBenefitsSummary(tier);
  };

  const fmtTimes = (n: number) =>
    language === 'en' ? `${n}/${t('tierStatus.dailyGen').toLowerCase().includes('daily') ? 'day' : 'mo'}` : `${n}${t('tierStatus.times')}`;

  return (
    <Card className={`overflow-hidden ${
      currentTier === 'platinum' ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20' :
      currentTier === 'gold' ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20' :
      currentTier === 'silver' ? 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20' :
      currentTier === 'bronze' ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' :
      ''
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className={`w-5 h-5 ${
              currentTier === 'platinum' ? 'text-purple-500' :
              currentTier === 'gold' ? 'text-yellow-500' :
              currentTier === 'silver' ? 'text-gray-400' :
              currentTier === 'bronze' ? 'text-amber-700' :
              'text-muted-foreground'
            }`} />
            <CardTitle className="font-korean">{t('tierStatus.myTier')}</CardTitle>
          </div>
          <TierBadge tier={currentTier} />
        </div>
        <CardDescription className="font-korean">
          {t('tierStatus.basedOnPurchases')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 누적 구매 금액 */}
        <div className="p-4 rounded-lg bg-background/50">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-korean">{t('tierStatus.cumulativePurchase')}</p>
          </div>
          <p className="text-2xl font-bold">{formatAmount(totalAmount, language)}</p>
          {stats?.totalPurchases && stats.totalPurchases > 0 && (
            <p className="text-xs text-muted-foreground mt-1 font-korean">
              {t('tierStatus.totalPurchases').replace('{n}', String(stats.totalPurchases))}
            </p>
          )}
        </div>

        {/* 다음 등급까지 진행 상황 */}
        {nextTierInfo.nextTier ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-korean">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                {t('tierStatus.toNextTier')}
              </span>
              <span className="font-medium">
                {formatAmount(nextTierInfo.amountNeeded, language)} {t('tierStatus.remaining')}
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{getTierName(currentTier, language)}</span>
              <span>{getTierName(nextTierInfo.nextTier, language)}</span>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-primary mb-2 font-korean">
                <ArrowUp className="w-3 h-3 inline mr-1" />
                {t('tierStatus.nextTierBenefits').replace('{tier}', getTierName(nextTierInfo.nextTier, language))}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {getBenefitsSummary(nextTierInfo.nextTier).slice(0, 3).map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-korean">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                {t('tierStatus.toNextSlot')}
              </span>
              <span className="font-medium">
                {formatAmount(nextTierInfo.amountNeeded, language)} {t('tierStatus.remaining')}
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <p className="text-xs text-muted-foreground font-korean">
              {t('tierStatus.currentSlots').replace('{n}', String(stats?.modelProfileSlots || 0))}
            </p>
          </div>
        )}

        {/* 현재 등급 주요 혜택 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">{t('tierStatus.dailyGen')}</p>
            <p className="font-bold font-korean">
              {tierConfig.dailyLimit === -1 ? t('tierStatus.unlimited') : `${tierConfig.dailyLimit}${t('tierStatus.times')}`}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">{t('tierStatus.monthlyGen')}</p>
            <p className="font-bold font-korean">
              {tierConfig.monthlyLimit === -1 ? t('tierStatus.unlimited') : `${tierConfig.monthlyLimit}${t('tierStatus.times')}`}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">{t('tierStatus.watermark')}</p>
            <p className="font-bold font-korean">
              {tierConfig.hasWatermark ? t('tierStatus.yes') : t('tierStatus.no')}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">{t('tierStatus.history')}</p>
            <p className="font-bold font-korean">
              {tierConfig.historyDays === -1 ? t('tierStatus.permanent') : `${tierConfig.historyDays}${t('tierStatus.days')}`}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-korean">
          {t('tierStatus.tierNotice')}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-full font-korean"
          onClick={() => navigate('/pricing')}
        >
          {t('tierStatus.viewBenefits')}
        </Button>
      </CardContent>
    </Card>
  );
};
