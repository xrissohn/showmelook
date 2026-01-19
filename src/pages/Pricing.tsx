/**
 * Pricing - 요금제 페이지
 * 3단 플랜 카드 레이아웃 + 월간/연간 토글
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import MainNavigation from '@/components/MainNavigation';
import { PlanCard } from '@/components/subscription/PlanCard';
import { BillingToggle } from '@/components/subscription/BillingToggle';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { PLAN_CONFIG, PlanType } from '@/lib/planConfig';
import { CheckCircle2, Crown, HelpCircle } from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlan, isLoading } = useSubscription(user?.id);
  const [isYearly, setIsYearly] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('pro');

  const handleSelectPlan = (plan: PlanType) => {
    if (plan === 'free') {
      navigate('/auth');
      return;
    }
    
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const faqs = [
    {
      question: '언제든지 플랜을 변경할 수 있나요?',
      answer: '네! 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있어요. 업그레이드 시에는 즉시 적용되고, 다운그레이드는 현재 결제 기간이 끝난 후 적용됩니다.',
    },
    {
      question: '가족 프로필은 어떻게 사용하나요?',
      answer: 'Premium 플랜에서는 본인 외에 최대 5명의 가족이나 친구 프로필을 추가할 수 있어요. 각 프로필에 체형 정보와 사진을 등록하면 해당 프로필로 맞춤 스타일 생성이 가능합니다.',
    },
    {
      question: '무료 플랜에서 업그레이드하면 기존 데이터는 어떻게 되나요?',
      answer: '모든 데이터(갤러리, 히스토리 등)가 그대로 유지됩니다. 업그레이드 후에는 추가 기능과 더 많은 저장 공간을 사용할 수 있어요.',
    },
    {
      question: '연간 결제는 어떤 이점이 있나요?',
      answer: '연간 결제 시 2개월 무료 혜택이 적용되어 약 17% 할인된 가격에 이용할 수 있어요. Pro 플랜은 ₩9,800, Premium 플랜은 ₩19,800을 절약할 수 있습니다.',
    },
    {
      question: '결제 수단은 무엇을 지원하나요?',
      answer: '현재 결제 시스템을 준비 중입니다. 곧 신용카드, 카카오페이, 네이버페이 등 다양한 결제 수단을 지원할 예정이에요.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Crown className="w-4 h-4" />
            <span className="text-sm font-medium font-korean">합리적인 요금제</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 font-korean">
            당신에게 딱 맞는 플랜을 선택하세요
          </h1>
          
          <p className="text-lg text-muted-foreground font-korean">
            무료로 시작하고, 필요에 따라 언제든 업그레이드하세요
          </p>
        </div>

        {/* Billing Toggle */}
        <BillingToggle 
          isYearly={isYearly} 
          onToggle={setIsYearly} 
          className="mb-12"
        />

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          <PlanCard
            plan="free"
            config={PLAN_CONFIG.free}
            isYearly={isYearly}
            isCurrentPlan={currentPlan === 'free'}
            onSelect={handleSelectPlan}
          />
          <PlanCard
            plan="pro"
            config={PLAN_CONFIG.pro}
            isYearly={isYearly}
            isCurrentPlan={currentPlan === 'pro'}
            onSelect={handleSelectPlan}
            isPopular
          />
          <PlanCard
            plan="premium"
            config={PLAN_CONFIG.premium}
            isYearly={isYearly}
            isCurrentPlan={currentPlan === 'premium'}
            onSelect={handleSelectPlan}
          />
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 font-korean">
            기능 비교
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-4 px-4 font-korean">기능</th>
                  <th className="text-center py-4 px-4 font-korean">Free</th>
                  <th className="text-center py-4 px-4 font-korean bg-primary/5">Pro</th>
                  <th className="text-center py-4 px-4 font-korean">Premium</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '일일 스타일 생성', free: '5회', pro: '20회', premium: '무제한' },
                  { feature: '스타일 추천 먼저 받기', free: false, pro: true, premium: true },
                  { feature: '갤러리 저장', free: '10장', pro: '50장', premium: '무제한' },
                  { feature: '워터마크 없음', free: false, pro: true, premium: true },
                  { feature: '고화질 다운로드', free: false, pro: true, premium: true },
                  { feature: '히스토리 보관', free: '7일', pro: '30일', premium: '영구' },
                  { feature: '프로필 관리', free: '1명', pro: '1명', premium: '6명' },
                  { feature: '가족 얼굴 합성', free: false, pro: false, premium: true },
                  { feature: '우선 생성 대기열', free: false, pro: false, premium: true },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4 font-korean">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {typeof row.free === 'boolean' ? (
                        row.free ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      ) : (
                        <span className="font-korean">{row.free}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4 bg-primary/5">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      ) : (
                        <span className="font-korean font-medium">{row.pro}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof row.premium === 'boolean' ? (
                        row.premium ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      ) : (
                        <span className="font-korean font-medium text-primary">{row.premium}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason={selectedPlan === 'premium' ? 'family-profile' : 'recommend-first'}
        currentPlan={currentPlan}
      />
    </div>
  );
};

export default Pricing;
