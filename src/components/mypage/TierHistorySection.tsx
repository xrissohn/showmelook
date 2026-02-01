/**
 * TierHistorySection - 등급 변동 이력 표시 컴포넌트
 */

import { History, ArrowUp, ArrowDown, Minus, ShoppingBag, RotateCcw, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TierType, TIER_CONFIG, formatAmountKo } from '@/lib/tierConfig';
import { TierChangeRecord } from '@/hooks/usePurchaseStats';

interface TierHistorySectionProps {
  tierHistory: TierChangeRecord[];
  isLoading?: boolean;
}

const TierBadge = ({ tier }: { tier: TierType }) => {
  const config = TIER_CONFIG[tier];
  const badgeClasses: Record<TierType, string> = {
    free: 'bg-gray-500 text-white',
    bronze: 'bg-amber-700 text-white',
    silver: 'bg-gray-400 text-white',
    gold: 'bg-yellow-500 text-black',
    platinum: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  };

  return (
    <Badge className={`${badgeClasses[tier]} text-xs`}>
      {config.nameKo}
    </Badge>
  );
};

const getChangeIcon = (previousTier: TierType, newTier: TierType) => {
  const tierOrder: TierType[] = ['free', 'bronze', 'silver', 'gold', 'platinum'];
  const prevIndex = tierOrder.indexOf(previousTier);
  const newIndex = tierOrder.indexOf(newTier);
  
  if (newIndex > prevIndex) {
    return <ArrowUp className="w-4 h-4 text-green-500" />;
  } else if (newIndex < prevIndex) {
    return <ArrowDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

const getReasonIcon = (reason: TierChangeRecord['changeReason']) => {
  switch (reason) {
    case 'purchase':
      return <ShoppingBag className="w-4 h-4 text-green-500" />;
    case 'refund':
      return <RotateCcw className="w-4 h-4 text-orange-500" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-blue-500" />;
  }
};

const getReasonText = (reason: TierChangeRecord['changeReason']) => {
  switch (reason) {
    case 'purchase':
      return '구매 확정';
    case 'refund':
      return '환불 처리';
    case 'admin':
      return '관리자 조정';
  }
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const TierHistorySection = ({ tierHistory, isLoading }: TierHistorySectionProps) => {
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
          <CardTitle className="font-korean">등급 변동 이력</CardTitle>
        </div>
        <CardDescription className="font-korean">
          최근 등급 변동 내역을 확인하세요
        </CardDescription>
      </CardHeader>

      <CardContent>
        {tierHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-korean">아직 등급 변동 이력이 없습니다</p>
            <p className="text-sm mt-1 font-korean">
              제휴 링크를 통해 구매하시면 등급이 올라갑니다
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
                  {/* 상단: 등급 변동 표시 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={record.previousTier} />
                      {getChangeIcon(record.previousTier, record.newTier)}
                      <TierBadge tier={record.newTier} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {getReasonIcon(record.changeReason)}
                      <span className="font-korean">{getReasonText(record.changeReason)}</span>
                    </div>
                  </div>

                  {/* 하단: 금액 및 날짜 */}
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${
                      record.amountChange > 0 ? 'text-green-600 dark:text-green-400' : 
                      record.amountChange < 0 ? 'text-red-600 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}>
                      {record.amountChange > 0 ? '+' : ''}{formatAmountKo(record.amountChange)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(record.createdAt)}
                    </span>
                  </div>

                  {/* 주문 ID (있는 경우) */}
                  {record.relatedOrderId && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      주문번호: {record.relatedOrderId}
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
