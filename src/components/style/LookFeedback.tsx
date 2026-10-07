import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Meh, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type Rating = 1 | 0 | -1;
const MAX_COMMENT = 1000;

interface LookFeedbackProps {
  lookId: string;
  /** 이 룩을 만들 때 적용된 옷의 성별 (학습 참고용) */
  appliedGender?: string;
  className?: string;
}

/**
 * 생성된 이미지에 대한 피드백: 좋아요 / 보통 / 별로예요 + 선택 주관식 의견.
 * 평점은 누르는 즉시 저장하고, 의견은 따로 보낸다. 평점·의견은 쇼미의 추천을 더 좋게 만드는 데 쓰인다.
 */
export const LookFeedback = ({ lookId, appliedGender, className = '' }: LookFeedbackProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const en = language === 'en';
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState('');
  const [savedComment, setSavedComment] = useState('');
  const [saving, setSaving] = useState(false);

  // 이미 남긴 피드백이 있으면 불러온다 (내 것만 읽을 수 있다)
  useEffect(() => {
    let cancelled = false;
    setRating(null);
    setComment('');
    setSavedComment('');
    if (!user || !lookId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('look_feedback')
          .select('rating, comment')
          .eq('look_id', lookId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled || !data) return;
        setRating(data.rating as Rating);
        setComment(data.comment ?? '');
        setSavedComment(data.comment ?? '');
      } catch {
        /* 불러오지 못해도 새로 남길 수 있다 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookId, user]);

  const submit = async (nextRating: Rating, nextComment: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-look-feedback', {
        body: { lookId, rating: nextRating, comment: nextComment.trim() || undefined, appliedGender },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'failed');
      return true;
    } catch {
      toast({
        title: en ? 'Could not send your feedback' : '피드백을 보내지 못했어요',
        description: en ? 'Please try again in a moment.' : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const choose = async (r: Rating) => {
    if (saving || !user) return;
    const prev = rating;
    setRating(r);
    const ok = await submit(r, savedComment);
    if (!ok) setRating(prev);
  };

  const sendComment = async () => {
    if (saving || rating === null || !comment.trim() || comment.trim() === savedComment) return;
    const ok = await submit(rating, comment);
    if (ok) {
      setSavedComment(comment.trim());
      toast({
        title: en ? 'Thank you for your feedback 💌' : '의견 고마워요 💌',
        description: en ? 'It helps Shomi recommend better looks.' : '쇼미의 추천을 더 좋게 만드는 데 쓰여요.',
      });
    }
  };

  if (!user) return null;

  const options: Array<{ value: Rating; label: string; icon: JSX.Element; active: string }> = [
    { value: 1, label: en ? 'Love it' : '좋아요', icon: <ThumbsUp className="w-4 h-4" />, active: 'bg-green-500 text-white border-green-500' },
    { value: 0, label: en ? 'It\'s okay' : '보통', icon: <Meh className="w-4 h-4" />, active: 'bg-amber-500 text-white border-amber-500' },
    { value: -1, label: en ? 'Not for me' : '별로예요', icon: <ThumbsDown className="w-4 h-4" />, active: 'bg-orange-500 text-white border-orange-500' },
  ];

  return (
    <div className={`w-full max-w-md rounded-2xl border border-border bg-card/70 p-4 ${className}`}>
      <p className="text-sm font-semibold font-korean text-foreground text-center">
        {en ? 'How is this look?' : '이 룩 어땠나요?'}
      </p>
      <p className="text-xs text-muted-foreground font-korean text-center mt-0.5 mb-3">
        {en ? 'Your feedback teaches Shomi your taste.' : '남겨 주신 평가가 쇼미가 취향을 배우는 데 쓰여요.'}
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={en ? 'Rate this look' : '이 룩 평가'}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={rating === o.value}
            disabled={saving}
            onClick={() => choose(o.value)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-korean font-medium transition-all disabled:opacity-60 ${
              rating === o.value ? o.active : 'border-border bg-background text-foreground hover:border-accent/60'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      {rating !== null && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
            rows={3}
            maxLength={MAX_COMMENT}
            placeholder={
              en
                ? 'Tell us more (optional): fit, color, mood, what you wanted instead…'
                : '더 자세히 알려 주세요 (선택): 핏, 색, 분위기, 원했던 스타일 등'
            }
            className="text-sm font-korean resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground font-korean">
              {en ? 'Please do not include personal or sensitive details.' : '개인정보나 민감한 내용은 적지 말아 주세요.'}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={sendComment}
              disabled={saving || !comment.trim() || comment.trim() === savedComment}
              className="font-korean shrink-0"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              {savedComment && comment.trim() === savedComment ? (en ? 'Sent' : '보냈어요') : en ? 'Send' : '의견 보내기'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LookFeedback;
