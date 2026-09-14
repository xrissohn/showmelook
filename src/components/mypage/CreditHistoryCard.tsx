import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, Users, MessageSquareHeart, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CreditDetail {
  id: string;
  amount?: number;
  remaining: number;
  expires_at: string | null;
  is_permanent: boolean;
  is_active?: boolean;
  reward_type?: string;
  referral_code: string;
  referee_user_id?: string | null;
  created_at?: string;
}

interface Props {
  total: number;
  details: CreditDetail[];
  currentUserId?: string;
}

const labelFor = (r: CreditDetail, currentUserId: string | undefined, t: (key: string) => string) => {
  switch (r.reward_type) {
    case 'bonus_credits':
      if (r.referee_user_id && r.referee_user_id !== currentUserId) {
        // 내가 피추천인일 때: referee_user_id 는 추천인을 가리킴
        return { icon: Gift, label: t('creditHistory.signupReferralBonus'), tone: 'bg-emerald-500/10 text-emerald-600' };
      }
      return { icon: Users, label: t('creditHistory.referralBonus'), tone: 'bg-emerald-500/10 text-emerald-600' };
    case 'survey_shomi_ab':
    case 'survey_shomi':
      return { icon: MessageSquareHeart, label: t('creditHistory.surveyReward'), tone: 'bg-violet-500/10 text-violet-600' };
    case 'welcome':
      return { icon: Sparkles, label: t('creditHistory.welcomeBonus'), tone: 'bg-amber-500/10 text-amber-600' };
    default:
      return { icon: Coins, label: r.reward_type || t('creditHistory.credits'), tone: 'bg-primary/10 text-primary' };
  }
};

const fmtDate = (s: string | null | undefined, language: 'ko' | 'en') => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
};

export const CreditHistoryCard = ({ total, details, currentUserId }: Props) => {
  const { t, language } = useLanguage();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <CardTitle className="font-korean text-lg">{t('creditHistory.title')}</CardTitle>
        </div>
        <CardDescription className="font-korean">
          {t('creditHistory.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
          <p className="text-sm text-muted-foreground font-korean">{t('creditHistory.availableBalance')}</p>
          <p className="text-3xl font-bold text-primary mt-1">{total.toLocaleString(language === 'en' ? 'en-US' : 'ko-KR')} <span className="text-base font-medium text-muted-foreground">{t('creditHistory.credits')}</span></p>
          <p className="text-xs text-muted-foreground mt-1 font-korean">{t('creditHistory.usageNotice')}</p>
        </div>

        {details.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-korean">
            {t('creditHistory.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground font-korean px-1">{t('creditHistory.earnedHistory')}</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {details.map((r) => {
                const { icon: Icon, label, tone } = labelFor(r, currentUserId, t);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium font-korean truncate">{label}</p>
                        <p className="text-xs text-muted-foreground font-korean">
                          {fmtDate(r.created_at, language)}
                          {r.expires_at && !r.is_permanent && ` · ${t('creditHistory.expires')} ${fmtDate(r.expires_at, language)}`}
                          {r.is_permanent && ` · ${t('creditHistory.permanent')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">+{r.amount ?? r.remaining}</p>
                      <Badge variant={r.is_active ? 'secondary' : 'outline'} className="text-[10px] font-korean">
                        {r.is_active ? `${t('creditHistory.remaining')} ${r.remaining}` : t('creditHistory.usedOrExpired')}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground font-korean space-y-1 pt-2 border-t">
          <p>{t('creditHistory.infoReferral')}</p>
          <p>{t('creditHistory.infoCampaigns')}</p>
        </div>
      </CardContent>
    </Card>
  );
};
