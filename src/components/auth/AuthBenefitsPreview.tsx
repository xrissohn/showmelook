import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { TIER_CONFIG } from '@/lib/tierConfig';

interface SampleLook {
  id: string;
  image_url: string;
}

/**
 * 로그인 화면에서 '로그인하면 무엇을 얻는지'를 보여준다: 다른 사용자가 공개한 샘플 룩 + 혜택 요약.
 * 비로그인 무료 생성은 비용 때문에 제공하지 않는다 — 여기서는 보여주기만 한다.
 */
export const AuthBenefitsPreview = () => {
  const { language } = useLanguage();
  const [looks, setLooks] = useState<SampleLook[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('generated_looks_public' as any)
          .select('id, image_url')
          .order('like_count', { ascending: false })
          .limit(4);
        if (!cancelled && data) setLooks((data as any[]).filter((l) => !!l.image_url));
      } catch {
        /* 샘플은 없어도 된다 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const daily = TIER_CONFIG.free.dailyLimit;
  const benefits =
    language === 'en'
      ? [`${daily} free style generations a day`, 'Looks picked for your body type and taste', 'Save looks to your gallery and shop items in one tap']
      : [`매일 ${daily}회 무료 스타일 생성`, '내 체형·취향에 맞춘 룩 추천', '마음에 드는 룩은 갤러리에 저장, 상품은 바로 구매 링크로'];

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4">
      <p className="text-xs font-semibold text-foreground font-korean mb-2">
        {language === 'en' ? 'What you get when you log in' : '로그인하면 이런 걸 받아요'}
      </p>
      {looks.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {looks.map((look) => (
            <img
              key={look.id}
              src={look.image_url}
              alt={language === 'en' ? 'Sample look' : '샘플 룩'}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-lg object-cover bg-secondary"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          ))}
        </div>
      )}
      <ul className="space-y-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground font-korean">
            <Check className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AuthBenefitsPreview;
