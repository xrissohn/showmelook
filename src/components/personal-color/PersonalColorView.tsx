import { Sparkles, Hand } from 'lucide-react';
import { seasonLabel, type PersonalColor } from '@/lib/personalColor';

interface Props {
  value: PersonalColor;
  language: 'ko' | 'en';
  compact?: boolean;
}

const COPY = {
  ko: {
    ai: '사진 기반 추정', manual: '직접 선택', warm: '웜톤', cool: '쿨톤', palette: '추천 팔레트', avoid: '얼굴 가까이는 피하면 좋은 색', tips: '활용 팁',
    confidence: { low: '참고 수준', medium: '보통', high: '비교적 분명' }, confLabel: '판단 근거',
  },
  en: {
    ai: 'Photo-based estimate', manual: 'Chosen by you', warm: 'Warm', cool: 'Cool', palette: 'Your palette', avoid: 'Keep away from your face', tips: 'How to use it',
    confidence: { low: 'Tentative', medium: 'Moderate', high: 'Fairly clear' }, confLabel: 'Signal',
  },
};

export function SwatchRow({ swatches, size = 'md' }: { swatches: PersonalColor['palette']; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-11 h-11 sm:w-12 sm:h-12';
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((s) => (
        <div key={s.hex + s.name} className="flex flex-col items-center gap-1">
          <span className={`${dim} rounded-full border border-border shadow-sm`} style={{ backgroundColor: s.hex }} aria-hidden />
          {size === 'md' && <span className="text-[10px] text-muted-foreground max-w-[52px] text-center leading-tight">{s.name}</span>}
        </div>
      ))}
    </div>
  );
}

export default function PersonalColorView({ value, language, compact }: Props) {
  const c = COPY[language];
  const isAi = value.source === 'ai_photo';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-2xl font-bold text-foreground">{seasonLabel(value.season, language)}</h3>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
          {value.undertone === 'warm' ? c.warm : c.cool}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 border border-border px-3 py-1 text-xs text-muted-foreground">
          {isAi ? <Sparkles className="w-3 h-3" /> : <Hand className="w-3 h-3" />}
          {isAi ? c.ai : c.manual}
        </span>
        {isAi && value.confidence && (
          <span className="text-xs text-muted-foreground">{c.confLabel}: {c.confidence[value.confidence]}</span>
        )}
      </div>
      {value.summary && !compact && <p className="text-sm text-muted-foreground leading-relaxed">{value.summary}</p>}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">{c.palette}</p>
        <SwatchRow swatches={value.palette} size={compact ? 'sm' : 'md'} />
      </div>
      {!compact && value.avoid.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">{c.avoid}</p>
          <SwatchRow swatches={value.avoid} />
        </div>
      )}
      {!compact && value.tips.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">{c.tips}</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
            {value.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
