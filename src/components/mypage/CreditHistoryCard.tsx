import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, Users, MessageSquareHeart, Sparkles } from "lucide-react";

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

const labelFor = (r: CreditDetail, currentUserId?: string) => {
  switch (r.reward_type) {
    case 'bonus_credits':
      if (r.referee_user_id && r.referee_user_id !== currentUserId) {
        // 내가 피추천인일 때: referee_user_id 는 추천인을 가리킴
        return { icon: Gift, label: '친구 추천 가입 보너스', tone: 'bg-emerald-500/10 text-emerald-600' };
      }
      return { icon: Users, label: '친구 추천 보너스', tone: 'bg-emerald-500/10 text-emerald-600' };
    case 'survey_shomi_ab':
    case 'survey_shomi':
      return { icon: MessageSquareHeart, label: '설문 참여 보상', tone: 'bg-violet-500/10 text-violet-600' };
    case 'welcome':
      return { icon: Sparkles, label: '가입 환영 보너스', tone: 'bg-amber-500/10 text-amber-600' };
    default:
      return { icon: Coins, label: r.reward_type || '크레딧', tone: 'bg-primary/10 text-primary' };
  }
};

const fmtDate = (s?: string | null) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
};

export const CreditHistoryCard = ({ total, details, currentUserId }: Props) => {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <CardTitle className="font-korean text-lg">내 크레딧</CardTitle>
        </div>
        <CardDescription className="font-korean">
          추천·설문 등으로 적립된 보너스 크레딧 내역입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
          <p className="text-sm text-muted-foreground font-korean">사용 가능 잔액</p>
          <p className="text-3xl font-bold text-primary mt-1">{total.toLocaleString()} <span className="text-base font-medium text-muted-foreground">크레딧</span></p>
          <p className="text-xs text-muted-foreground mt-1 font-korean">일일 무료 한도 소진 후 자동으로 차감됩니다.</p>
        </div>

        {details.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-korean">
            아직 적립된 크레딧이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground font-korean px-1">적립 내역</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {details.map((r) => {
                const { icon: Icon, label, tone } = labelFor(r, currentUserId);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium font-korean truncate">{label}</p>
                        <p className="text-xs text-muted-foreground font-korean">
                          {fmtDate(r.created_at)}
                          {r.expires_at && !r.is_permanent && ` · 만료 ${fmtDate(r.expires_at)}`}
                          {r.is_permanent && ' · 영구 사용'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">+{r.amount ?? r.remaining}</p>
                      <Badge variant={r.is_active ? 'secondary' : 'outline'} className="text-[10px] font-korean">
                        {r.is_active ? `잔여 ${r.remaining}` : '소진/만료'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground font-korean space-y-1 pt-2 border-t">
          <p>• 친구가 내 추천코드로 가입하면 추천인과 피추천인 모두 5크레딧을 받아요.</p>
          <p>• 설문 참여, 이벤트 등 캠페인을 통해서도 크레딧이 적립됩니다.</p>
        </div>
      </CardContent>
    </Card>
  );
};
