/**
 * Pricing - 요금제 페이지
 * 5단계 구매 기반 등급 시스템 안내
 */

import { useAuth } from '@/hooks/useAuth';
import { usePurchaseStats } from '@/hooks/usePurchaseStats';
import MainNavigation from '@/components/MainNavigation';
import { TierPolicyNotice } from '@/components/subscription/TierPolicyNotice';
import { TierBadge } from '@/components/ui/tier-badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { TIER_CONFIG, TierType, TIER_ORDER, formatAmountKo } from '@/lib/tierConfig';
import { CheckCircle2, HelpCircle, ShoppingBag, TrendingUp, Crown, Sparkles } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';

const Pricing = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { stats, nextTierInfo, progressToNextTier, isLoading } = usePurchaseStats(user?.id);
  
  const currentTier = stats?.currentTier || 'free';
  const totalAmount = stats?.totalPurchasedAmount || 0;
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);

  const faqItems = t('pricing.faqItems') as unknown as Array<{ question: string; answer: string }>;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead pageKey="pricing" />
      {Array.isArray(faqItems) && faqItems.length > 0 && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            })}
          </script>
        </Helmet>
      )}
      <MainNavigation />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-sm font-medium font-korean">{t('pricing.purchaseBasedSystem')}</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 font-korean">
            {t('pricing.moreBenefits')}
          </h1>
          
          <p className="text-lg text-muted-foreground font-korean">
            {t('pricing.autoUpgrade')}
          </p>
        </div>

        {/* Current User Status */}
        {user && !isLoading && (
          <Card className="max-w-2xl mx-auto mb-12 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground font-korean">{t('pricing.myCurrentTier')}</span>
                      <TierBadge tier={currentTier} size="md" showIcon />
                    </div>
                    <p className="text-xl font-bold font-korean">
                      {t('pricing.accumPurchase')} {formatAmountKo(totalAmount)}
                    </p>
                  </div>
                </div>
                
                {nextTierInfo.nextTier && (
                  <div className="w-full sm:w-48">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground font-korean">{t('pricing.toNextTier')}</span>
                      <span className="font-medium text-primary">{formatAmountKo(nextTierInfo.amountNeeded)}</span>
                    </div>
                    <Progress value={progressToNextTier} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-right font-korean">
                      → {TIER_CONFIG[nextTierInfo.nextTier].nameKo}
                    </p>
                  </div>
                )}
                
                {!nextTierInfo.nextTier && currentTier === 'platinum' && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-primary">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium font-korean">{t('pricing.topTier')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-korean mt-1">
                      {t('pricing.toNextSlot')} {formatAmountKo(nextTierInfo.amountNeeded)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5-Tier Progress */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-between mb-4">
            {(['free', 'bronze', 'silver', 'gold', 'platinum'] as TierType[]).map((tier, idx) => {
              const isCurrentUserTier = user && currentTier === tier;
              const isPastTier = user && currentTierIndex > idx;
              
              return (
                <div key={tier} className="flex flex-col items-center flex-1 relative">
                  {isCurrentUserTier && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-bold text-primary font-korean whitespace-nowrap">{t('pricing.current')}</span>
                    </div>
                  )}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    tier === 'free' ? 'bg-muted-foreground text-white' :
                    tier === 'bronze' ? 'bg-amber-700 text-white' :
                    tier === 'silver' ? 'bg-gray-400 text-white' :
                    tier === 'gold' ? 'bg-yellow-500 text-black' :
                    'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  } ${isCurrentUserTier ? 'ring-4 ring-primary ring-offset-2 scale-110' : ''} ${isPastTier ? 'opacity-100' : (!user || isCurrentUserTier) ? 'opacity-100' : 'opacity-50'}`}>
                    {isPastTier || isCurrentUserTier ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <p className={`text-xs mt-2 font-korean font-medium ${isCurrentUserTier ? 'text-primary' : ''}`}>
                    {t(`pricing.tierNames.${tier}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tier === 'free' ? '₩0' : formatAmountKo(TIER_CONFIG[tier].minAmount) + '+'}
                  </p>
                </div>
              );
            })}
          </div>
          
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-700 via-yellow-500 to-purple-500 transition-all duration-500" 
              style={{ 
                width: user 
                  ? `${Math.min(100, ((currentTierIndex + 1) / 5) * 100 + (progressToNextTier / 5))}%`
                  : '20%' 
              }}
            />
          </div>
          
          <p className="text-center text-sm text-muted-foreground mt-4 font-korean">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            {t('pricing.autoUpgradeDesc')}
          </p>
        </div>

        {/* Tier Benefits Cards */}
        <div className="grid md:grid-cols-5 gap-4 max-w-6xl mx-auto mb-16">
          {(['free', 'bronze', 'silver', 'gold', 'platinum'] as TierType[]).map((tier, idx) => {
            const config = TIER_CONFIG[tier];
            const isCurrentUserTier = user && currentTier === tier;
            const isPastTier = user && currentTierIndex > idx;
            const isNextTier = user && nextTierInfo.nextTier === tier;
            
            return (
              <div 
                key={tier}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  isCurrentUserTier 
                    ? 'border-primary bg-primary/5 shadow-lg scale-105' 
                    : isNextTier
                    ? 'border-primary/50 bg-primary/5 shadow-md'
                    : isPastTier
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                {isCurrentUserTier && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold font-korean">
                    {t('pricing.currentTier')}
                  </div>
                )}
                
                {isNextTier && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/80 text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold font-korean whitespace-nowrap">
                    {t('pricing.nextGoal')}
                  </div>
                )}
                
                <div className={`w-8 h-8 rounded-full mb-3 flex items-center justify-center ${config.badgeColor}`}>
                  {isPastTier && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <h3 className="font-bold font-korean">{t(`pricing.tierNames.${tier}`)}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {tier === 'free' ? t('pricing.freeSignup') : `${formatAmountKo(config.minAmount)}+`}
                </p>
                
                <ul className="space-y-1 text-xs">
                  <li className="font-korean">
                    {t('pricing.daily')} {config.dailyLimit === -1 ? t('pricing.unlimited') : `${config.dailyLimit}`}
                  </li>
                  <li className="font-korean">
                    {t('pricing.monthly')} {config.monthlyLimit === -1 ? t('pricing.unlimited') : `${config.monthlyLimit}`}
                  </li>
                  <li className="font-korean">
                    {config.hasWatermark ? t('pricing.hasWatermark') : t('pricing.noWatermarkLabel')}
                  </li>
                  {config.canPreviewRecommendations && (
                    <li className="font-korean text-primary font-medium">
                      {t('pricing.previewFirst')}
                    </li>
                  )}
                  {tier === 'platinum' && (
                    <li className="font-korean text-primary font-medium">
                      {t('pricing.modelProfileAdd')}
                    </li>
                  )}
                </ul>
                
                {isNextTier && (
                  <div className="mt-3 pt-2 border-t border-primary/20">
                    <p className="text-xs text-primary font-medium font-korean">
                      {formatAmountKo(nextTierInfo.amountNeeded)} {t('pricing.moreToAchieve')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 font-korean">
            {t('pricing.tierComparison')}
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 px-3 font-korean">{t('pricing.benefit')}</th>
                  <th className="text-center py-3 px-2 font-korean">{t('pricing.free')}</th>
                  <th className="text-center py-3 px-2 font-korean text-amber-700">{t('pricing.bronze')}</th>
                  <th className="text-center py-3 px-2 font-korean text-gray-500">{t('pricing.silver')}</th>
                  <th className="text-center py-3 px-2 font-korean text-yellow-600">{t('pricing.gold')}</th>
                  <th className="text-center py-3 px-2 font-korean bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">{t('pricing.platinum')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: t('pricing.dailyGen'), free: '5', bronze: '5', silver: '10', gold: '20', platinum: t('pricing.unlimited') },
                  { feature: t('pricing.monthlyGen'), free: '25', bronze: t('pricing.unlimited'), silver: t('pricing.unlimited'), gold: t('pricing.unlimited'), platinum: t('pricing.unlimited') },
                  { feature: t('pricing.watermark'), free: t('pricing.yes'), bronze: t('pricing.no'), silver: t('pricing.no'), gold: t('pricing.no'), platinum: t('pricing.no') },
                  { feature: t('pricing.hdDownload'), free: false, bronze: true, silver: true, gold: true, platinum: true },
                  { feature: t('pricing.previewRecommend'), free: false, bronze: false, silver: true, gold: true, platinum: true },
                  { feature: t('pricing.gallerySave'), free: '10', bronze: '30', silver: '50', gold: '100', platinum: t('pricing.unlimited') },
                  { feature: t('pricing.historyKeep'), free: '7d', bronze: '30d', silver: '90d', gold: '∞', platinum: '∞' },
                  { feature: t('pricing.modelProfile'), free: t('pricing.selfOnly'), bronze: t('pricing.selfOnly'), silver: t('pricing.selfOnly'), gold: t('pricing.selfOnly'), platinum: '+1/₩1M' },
                  { feature: t('pricing.priorityQueue'), free: false, bronze: false, silver: false, gold: false, platinum: true },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-3 font-korean font-medium">{row.feature}</td>
                    {(['free', 'bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => (
                      <td key={tier} className="text-center py-3 px-2">
                        {typeof row[tier] === 'boolean' ? (
                          row[tier] ? (
                            <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )
                        ) : (
                          <span className="font-korean text-xs">{row[tier]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tier Policy Notice */}
        <div className="max-w-2xl mx-auto mb-16">
          <TierPolicyNotice variant="detailed" />
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold font-korean">{t('pricing.faq')}</h2>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {Array.isArray(faqItems) && faqItems.map((faq, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`}>
                <AccordionTrigger className="text-left font-korean">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground font-korean">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
