/**
 * UpgradeModal - 업그레이드 유도 모달
 * 결제 시스템 준비 중 상태로 안내
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Sparkles, Crown, Images, Download, Users, Bell, CheckCircle2 } from 'lucide-react';
import { UPGRADE_MESSAGES, UpgradeReason, PLAN_CONFIG, formatPrice } from '@/lib/planConfig';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: UpgradeReason;
  currentPlan?: 'free' | 'pro' | 'premium';
}

const ReasonIcon = ({ reason }: { reason: UpgradeReason }) => {
  switch (reason) {
    case 'recommend-first':
      return <Sparkles className="w-8 h-8 text-primary" />;
    case 'daily-limit':
      return <Lock className="w-8 h-8 text-amber-500" />;
    case 'gallery-limit':
      return <Images className="w-8 h-8 text-blue-500" />;
    case 'hd-download':
      return <Download className="w-8 h-8 text-green-500" />;
    case 'family-profile':
    case 'family-limit':
      return <Users className="w-8 h-8 text-purple-500" />;
    default:
      return <Crown className="w-8 h-8 text-amber-400" />;
  }
};

export const UpgradeModal = ({ 
  open, 
  onOpenChange, 
  reason,
  currentPlan = 'free' 
}: UpgradeModalProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const message = UPGRADE_MESSAGES[reason];
  const recommendedPlan = message.recommendedPlan;
  const planConfig = PLAN_CONFIG[recommendedPlan];

  const handleViewPricing = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const handleNotifyMe = async () => {
    if (!email.trim()) {
      toast({
        title: '이메일을 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 결제 준비 완료 알림 신청 (product_feedback 테이블 활용)
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('product_feedback').insert({
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        action_type: 'payment_notify_request',
        context: {
          email,
          requested_plan: recommendedPlan,
          reason,
          created_at: new Date().toISOString(),
        },
      });

      setIsSubscribed(true);
      toast({
        title: '알림 신청 완료! 🎉',
        description: '결제 시스템이 준비되면 이메일로 알려드릴게요.',
      });
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: '알림 신청 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <ReasonIcon reason={reason} />
          </div>
          <DialogTitle className="text-xl font-korean">
            {message.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2 font-korean">
            {message.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="font-semibold font-korean">{planConfig.nameKo} 플랜</span>
            <span className="ml-auto font-semibold text-primary">
              {formatPrice(planConfig.monthlyPrice)}/월
            </span>
          </div>
          <ul className="space-y-2">
            {planConfig.highlightFeatures?.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm font-korean">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-400 font-korean">
              결제 시스템 준비 중
            </span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 font-korean">
            곧 멋진 유료 플랜이 준비됩니다! 아래에 이메일을 남겨주시면 출시 시 알려드릴게요.
          </p>

          {isSubscribed ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-korean">알림 신청 완료!</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleNotifyMe}
                disabled={isSubmitting}
                variant="outline"
                className="shrink-0"
              >
                {isSubmitting ? '신청 중...' : '알림 받기'}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 font-korean"
            onClick={() => onOpenChange(false)}
          >
            다음에 할게요
          </Button>
          <Button 
            variant="hero" 
            className="flex-1 font-korean"
            onClick={handleViewPricing}
          >
            요금제 보기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
