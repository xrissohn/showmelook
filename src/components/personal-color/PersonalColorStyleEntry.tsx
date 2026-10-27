import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, ChevronRight, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadPersonalColor, seasonLabel, type PersonalColor } from '@/lib/personalColor';

interface Props {
  userId?: string | null;
  /** True when a family model is selected: the owner's color is never applied to it. */
  isFamilyProfile: boolean;
}

/** Small entry to the personal color studio on the style page, shown before any result. */
export default function PersonalColorStyleEntry({ userId, isFamilyProfile }: Props) {
  const { language } = useLanguage();
  const en = language === 'en';
  const [value, setValue] = useState<PersonalColor | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    setFailed(false);
    loadPersonalColor(userId).then(setValue).catch(() => { setValue(null); setFailed(true); });
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (!userId) return null;

  let line: string;
  if (isFamilyProfile) {
    line = en
      ? 'Your personal color is not applied to family models.'
      : '가족 모델에는 내 퍼스널 컬러가 적용되지 않아요.';
  } else if (value) {
    line = en
      ? `${seasonLabel(value.season, 'en')} will be used as a soft reference for your outfits.`
      : `${seasonLabel(value.season, 'ko')}을(를) 코디 추천에 부드럽게 참고해요.`;
  } else {
    line = en ? 'Find your tone to get outfits in your colors.' : '내 톤을 찾으면 어울리는 색으로 코디를 추천해요.';
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-gradient-personal-color px-3 py-2.5" data-testid="personal-color-style-entry">
      <Palette className="w-5 h-5 text-primary shrink-0" />
      <p className="flex-1 min-w-0 text-xs sm:text-sm text-foreground">{failed ? (en ? "Couldn't load your personal color." : '퍼스널 컬러를 불러오지 못했어요.') : line}</p>
      {failed ? (
        <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />{en ? 'Retry' : '다시 시도'}
        </button>
      ) : (
        <Link to="/personal-color" className="inline-flex items-center gap-0.5 rounded-full bg-background/80 border border-border px-3 py-1 text-xs font-medium text-foreground shrink-0">
          {isFamilyProfile ? (en ? 'Manage my color' : '본인 프로필의 컬러 관리') : value ? (en ? 'Change' : '변경') : (en ? 'Find my color' : '내 컬러 찾기')}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
