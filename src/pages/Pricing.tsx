/**
 * Pricing - 요금제 페이지
 * 5단계 구매 기반 등급 시스템 안내
 */

import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import MainNavigation from '@/components/MainNavigation';
import { TierPolicyNotice } from '@/components/subscription/TierPolicyNotice';
import { TIER_CONFIG, TierType, formatAmountKo } from '@/lib/tierConfig';
import { CheckCircle2, HelpCircle, ShoppingBag, TrendingUp } from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';

const Pricing = () => {
  const { user } = useAuth();
  const { plan: currentPlan } = useSubscription(user?.id);

  const faqs = [
    {
      question: '등급은 어떻게 결정되나요?',
      answer: '추천 상품을 구매하시면 누적 구매 금액에 따라 등급이 자동으로 결정됩니다. 첫 구매 시 브론즈 등급이 되며, 10만원 이상 실버, 30만원 이상 골드, 100만원 이상 플래티넘 등급이 됩니다.',
    },
    {
      question: '등급은 언제 적용되나요?',
      answer: '구매 확인 후 1~24시간 이내에 등급이 자동으로 적용됩니다. LinkPrice에서 구매 확정 정보를 받는 즉시 처리됩니다.',
    },
    {
      question: '환불하면 등급이 어떻게 되나요?',
      answer: '주문 취소 또는 환불 시 해당 금액이 누적 금액에서 차감되어 등급이 변동될 수 있습니다. 등급이 변동되어도 3일간의 유예 기간이 주어집니다.',
    },
    {
      question: '모델 프로필은 무엇인가요?',
      answer: '플래티넘 등급부터 본인 외에 가족, 연인, 친구 등의 프로필을 추가하여 해당 사람을 위한 맞춤 스타일을 생성할 수 있습니다. 100만원 구매당 1명씩 추가할 수 있어요.',
    },
    {
      question: '무료 회원도 스타일 생성이 가능한가요?',
      answer: '네! 무료 회원은 일일 5회, 월간 25회까지 스타일을 생성할 수 있어요. 상품을 한 번이라도 구매하시면 월간 제한이 해제됩니다.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-sm font-medium font-korean">구매 기반 등급 시스템</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 font-korean">
            구매할수록 더 많은 혜택을!
          </h1>
          
          <p className="text-lg text-muted-foreground font-korean">
            추천 상품 구매 금액에 따라 등급이 자동으로 업그레이드됩니다
          </p>
        </div>

        {/* 5-Tier Progress */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-between mb-4">
            {(['free', 'bronze', 'silver', 'gold', 'platinum'] as TierType[]).map((tier, idx) => (
              <div key={tier} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  tier === 'free' ? 'bg-muted-foreground' :
                  tier === 'bronze' ? 'bg-amber-700' :
                  tier === 'silver' ? 'bg-gray-400' :
                  tier === 'gold' ? 'bg-yellow-500' :
                  'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}>
                  {idx + 1}
                </div>
                <p className="text-xs mt-2 font-korean font-medium">
                  {TIER_CONFIG[tier].nameKo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tier === 'free' ? '0원' : formatAmountKo(TIER_CONFIG[tier].minAmount)}+
                </p>
              </div>
            ))}
          </div>
          
          {/* Progress bar */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-700 via-yellow-500 to-purple-500 w-1/5" />
          </div>
          
          <p className="text-center text-sm text-muted-foreground mt-4 font-korean">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            추천 상품을 구매하면 누적 금액에 따라 등급이 자동 업그레이드!
          </p>
        </div>

        {/* Tier Benefits Cards */}
        <div className="grid md:grid-cols-5 gap-4 max-w-6xl mx-auto mb-16">
          {(['free', 'bronze', 'silver', 'gold', 'platinum'] as TierType[]).map((tier) => {
            const config = TIER_CONFIG[tier];
            const isCurrentTier = currentPlan === tier || (currentPlan === 'pro' && tier === 'bronze') || (currentPlan === 'premium' && tier === 'platinum');
            
            return (
              <div 
                key={tier}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isCurrentTier 
                    ? 'border-primary bg-primary/5 shadow-lg' 
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full mb-3 ${config.badgeColor}`} />
                <h3 className="font-bold font-korean">{config.nameKo}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {tier === 'free' ? '무료 가입' : `${formatAmountKo(config.minAmount)}+`}
                </p>
                
                <ul className="space-y-1 text-xs">
                  <li className="font-korean">
                    일일 {config.dailyLimit === -1 ? '무제한' : `${config.dailyLimit}회`}
                  </li>
                  <li className="font-korean">
                    월간 {config.monthlyLimit === -1 ? '무제한' : `${config.monthlyLimit}회`}
                  </li>
                  <li className="font-korean">
                    {config.hasWatermark ? '워터마크 있음' : '워터마크 없음'}
                  </li>
                  {tier === 'platinum' && (
                    <li className="font-korean text-primary font-medium">
                      모델 프로필 추가 가능
                    </li>
                  )}
                </ul>
                
                {isCurrentTier && (
                  <div className="mt-3 text-xs font-medium text-primary font-korean">
                    ✓ 현재 등급
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table - 5 Tier Version */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 font-korean">
            등급별 혜택 비교
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 px-3 font-korean">혜택</th>
                  <th className="text-center py-3 px-2 font-korean">무료</th>
                  <th className="text-center py-3 px-2 font-korean text-amber-700">브론즈</th>
                  <th className="text-center py-3 px-2 font-korean text-gray-500">실버</th>
                  <th className="text-center py-3 px-2 font-korean text-yellow-600">골드</th>
                  <th className="text-center py-3 px-2 font-korean bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">플래티넘</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '일일 생성', free: '5회', bronze: '5회', silver: '10회', gold: '20회', platinum: '무제한' },
                  { feature: '월간 생성', free: '25회', bronze: '무제한', silver: '무제한', gold: '무제한', platinum: '무제한' },
                  { feature: '워터마크', free: '있음', bronze: '없음', silver: '없음', gold: '없음', platinum: '없음' },
                  { feature: '고화질 다운로드', free: false, bronze: true, silver: true, gold: true, platinum: true },
                  { feature: '갤러리 저장', free: '10장', bronze: '30장', silver: '50장', gold: '100장', platinum: '무제한' },
                  { feature: '히스토리 보관', free: '7일', bronze: '30일', silver: '90일', gold: '영구', platinum: '영구' },
                  { feature: '모델 프로필', free: '본인만', bronze: '본인만', silver: '본인만', gold: '본인만', platinum: '+1명/100만원' },
                  { feature: '우선 대기열', free: false, bronze: false, silver: false, gold: false, platinum: true },
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
            <h2 className="text-2xl font-bold font-korean">자주 묻는 질문</h2>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, idx) => (
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
