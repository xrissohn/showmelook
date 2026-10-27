import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadPersonalColor, seasonLabel, type PersonalColor } from '@/lib/personalColor';
import { SwatchRow } from './PersonalColorView';

/** Entry card shown on the profile edit page. Main user only. */
export default function PersonalColorCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'ko';
  const [value, setValue] = useState<PersonalColor | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPersonalColor(user.id).then(setValue).catch(() => setValue(null));
  }, [user]);

  return (
    <Link
      to="/personal-color"
      className="block rounded-3xl bg-gradient-personal-color border border-border p-5 shadow-sm hover:shadow-brand transition-shadow"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-background/80 flex items-center justify-center shrink-0">
          <Palette className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Personal color' : '퍼스널 컬러'}</p>
          {value ? (
            <>
              <p className="font-bold text-foreground">
                {seasonLabel(value.season, lang)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {value.source === 'ai_photo' ? (lang === 'en' ? 'Photo-based estimate' : '사진 기반 추정') : (lang === 'en' ? 'Chosen by you' : '직접 선택')}
                </span>
              </p>
              <div className="mt-2"><SwatchRow swatches={value.palette.slice(0, 6)} size="sm" /></div>
            </>
          ) : (
            <p className="font-bold text-foreground">
              {lang === 'en' ? 'Find colors that flatter you' : '나에게 어울리는 색 찾기'}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
