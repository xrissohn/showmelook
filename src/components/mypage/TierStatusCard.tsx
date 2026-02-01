/**
 * TierStatusCard - 구매 기반 등급 표시 카드
 * 현재 등급, 진행 상황, 다음 등급까지 남은 금액 표시
 */

import { Crown, TrendingUp, ShoppingBag, Sparkles, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { TierType, TIER_CONFIG, formatAmountKo, getTierBenefitsSummary } from '@/lib/tierConfig';
import { PurchaseStats, TierChangeRecord } from '@/hooks/usePurchaseStats';

interface TierStatusCardProps {
  stats: PurchaseStats | null;
  progressToNextTier: number;
  nextTierInfo: { nextTier: TierType | null; amountNeeded: number };
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
    <Badge className={`${badgeClasses[tier]} font-bold`}>
      {config.nameKo}
    </Badge>
  );
};

export const TierStatusCard = ({
  stats,
  progressToNextTier,
  nextTierInfo,
  tierHistory,
  isLoading,
}: TierStatusCardProps) => {
  const navigate = useNavigate();
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

  const isPlatinum = currentTier === 'platinum';

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
            <CardTitle className="font-korean">내 등급</CardTitle>
          </div>
          <TierBadge tier={currentTier} />
        </div>
        <CardDescription className="font-korean">
          쇼미룩 제휴 링크로 구매한 누적 금액 기준
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 누적 구매 금액 */}
        <div className="p-4 rounded-lg bg-background/50">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-korean">누적 구매 금액</p>
          </div>
          <p className="text-2xl font-bold">{formatAmountKo(totalAmount)}</p>
          {stats?.totalPurchases && stats.totalPurchases > 0 && (
            <p className="text-xs text-muted-foreground mt-1 font-korean">
              총 {stats.totalPurchases}건 구매
            </p>
          )}
        </div>

        {/* 다음 등급까지 진행 상황 */}
        {nextTierInfo.nextTier ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-korean">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                다음 등급까지
              </span>
              <span className="font-medium">
                {formatAmountKo(nextTierInfo.amountNeeded)} 남음
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{TIER_CONFIG[currentTier].nameKo}</span>
              <span>{TIER_CONFIG[nextTierInfo.nextTier].nameKo}</span>
            </div>

            {/* 다음 등급 혜택 미리보기 */}
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-primary mb-2 font-korean">
                <ArrowUp className="w-3 h-3 inline mr-1" />
                {TIER_CONFIG[nextTierInfo.nextTier].nameKo} 혜택
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {getTierBenefitsSummary(nextTierInfo.nextTier).slice(0, 3).map((benefit, idx) => (
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
            {/* 플래티넘 - 다음 슬롯까지 */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-korean">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                다음 모델 슬롯까지
              </span>
              <span className="font-medium">
                {formatAmountKo(nextTierInfo.amountNeeded)} 남음
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <p className="text-xs text-muted-foreground font-korean">
              현재 모델 프로필 슬롯: {stats?.modelProfileSlots || 0}명
            </p>
          </div>
        )}

        {/* 현재 등급 주요 혜택 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">일일 생성</p>
            <p className="font-bold font-korean">
              {tierConfig.dailyLimit === -1 ? '무제한' : `${tierConfig.dailyLimit}회`}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">월간 생성</p>
            <p className="font-bold font-korean">
              {tierConfig.monthlyLimit === -1 ? '무제한' : `${tierConfig.monthlyLimit}회`}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">워터마크</p>
            <p className="font-bold font-korean">
              {tierConfig.hasWatermark ? '있음' : '없음'}
            </p>
          </div>
          <div className="p-2 rounded bg-background/50 text-center">
            <p className="text-muted-foreground text-xs font-korean">히스토리</p>
            <p className="font-bold font-korean">
              {tierConfig.historyDays === -1 ? '영구' : `${tierConfig.historyDays}일`}
            </p>
          </div>
        </div>

        {/* 등급 정책 안내 */}
        <p className="text-xs text-muted-foreground font-korean">
          ⓘ 등급은 누적 구매 금액 기준이며, 환불 시 조정될 수 있습니다.
        </p>

        {/* 등급별 혜택 보기 링크 */}
        <Button
          variant="outline"
          size="sm"
          className="w-full font-korean"
          onClick={() => navigate('/pricing')}
        >
          등급별 혜택 자세히 보기
        </Button>
      </CardContent>
    </Card>
  );
};
