/**
 * TierHistorySection - 등급 변동 이력
 */

import { History, ArrowUp, ArrowDown, Minus, ShoppingBag, RotateCcw, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TierType, TIER_CONFIG, formatAmount, getTierName } from '@/lib/tierConfig';
import { TierChangeRecord } from '@/hooks/usePurchaseStats';
import { useLanguage } from '@/contexts/LanguageContext';

interface TierHistorySectionProps {
  tierHistory: TierChangeRecord[];
  isLoading?: boolean;
}

const TierBadge = ({ tier, language }: { tier: TierType; language: 'ko' | 'en' }) => {
  const badgeClasses: Record<TierType, string> = {
    free: 'bg-gray-500 text-white',
    bronze: 'bg-amber-700 text-white',
    silver: 'bg-gray-400 text-white',
    gold: 'bg-yellow-500 text-black',
    platinum: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  };
  return (
    <Badge className={`${badgeClasses[tier]} text-xs`}>
      {getTierName(tier, language)}
    </Badge>
  );
};

const getChangeIcon = (previousTier: TierType, newTier: TierType) => {
  const tierOrder: TierType[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];
  const prevIndex = tierOrder.indexOf(previousTier);
  const newIndex = tierOrder.indexOf(newTier);
  if (newIndex > prevIndex) return <ArrowUp className="w-4 h-4 text-green-500" />;
  if (newIndex < prevIndex) return <ArrowDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

const getReasonIcon = (reason: TierChangeRecord['changeReason']) => {
  switch (reason) {
    case 'purchase': return <ShoppingBag className="w-4 h-4 text-green-500" />;
    case 'refund': return <RotateCcw className="w-4 h-4 text-orange-500" />;
    case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
  }
};

export const TierHistorySection = ({ tierHistory, isLoading }: TierHistorySectionProps) => {
  const { t, language } = useLanguage();

  const getReasonText = (reason: TierChangeRecord['changeReason']) => {
    switch (reason) {
      case 'purchase': return t('tierHistory.reasonPurchase');
      case 'refund': return t('tierHistory.reasonRefund');
      case 'admin': return t('tierHistory.reasonAdmin');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="font-korean">{t('tierHistory.title')}</CardTitle>
        </div>
        <CardDescription className="font-korean">
          {t('tierHistory.description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {tierHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-korean">{t('tierHistory.empty')}</p>
            <p className="text-sm mt-1 font-korean">
              {t('tierHistory.emptyDesc')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {tierHistory.map((record) => (
                <div
                  key={record.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={record.previousTier} language={language} />
                      {getChangeIcon(record.previousTier, record.newTier)}
                      <TierBadge tier={record.newTier} language={language} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {getReasonIcon(record.changeReason)}
                      <span className="font-korean">{getReasonText(record.changeReason)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${
                      record.amountChange > 0 ? 'text-green-600 dark:text-green-400' :
                      record.amountChange < 0 ? 'text-red-600 dark:text-red-400' :
                      'text-muted-foreground'
                    }`}>
                      {record.amountChange > 0 ? '+' : ''}{formatAmount(record.amountChange, language)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(record.createdAt)}
                    </span>
                  </div>

                  {record.relatedOrderId && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {t('tierHistory.orderId')}: {record.relatedOrderId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
