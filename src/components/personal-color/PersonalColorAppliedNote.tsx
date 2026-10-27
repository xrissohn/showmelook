import { Link } from 'react-router-dom';
import { Palette } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { isSeason, seasonLabel, SEASON_INFO, type PersonalColorMode } from '@/lib/personalColor';

export interface PersonalColorApplied {
  season: string;
  source: string | null;
  mode: PersonalColorMode;
}

/** Explains, under a recommendation, whether and how the saved tone was used. Without one, links to the studio. */
export default function PersonalColorAppliedNote({ info }: { info: PersonalColorApplied | null | undefined }) {
  const { language } = useLanguage();
  const en = language === 'en';
  if (!info || !isSeason(info.season)) {
    return (
      <Link to="/personal-color" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-personal-color border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary">
        <Palette className="w-3.5 h-3.5 text-primary" />
        {en ? 'Add your personal color for outfits in your tones' : '퍼스널 컬러를 등록하면 내 톤에 맞춰 추천해요'}
      </Link>
    );
  }
  const label = seasonLabel(info.season, en ? 'en' : 'ko');
  const src = info.source === 'ai_photo' ? (en ? 'photo-based estimate' : '사진 기반 추정') : (en ? 'chosen by you' : '직접 선택');
  const swatches = SEASON_INFO[info.season].palette.slice(0, 5);
  const reason = info.mode === 'soft'
    ? (en
      ? `Items whose listed colors suit ${label} were given a gentle preference, after your style, occasion and budget. Product colors are shown as sold.`
      : `상품에 등록된 실제 색이 ${label}에 어울리면 조금 더 우선했어요. 스타일·TPO·예산이 먼저이고, 상품 색은 판매 정보 그대로예요.`)
    : (en
      ? `You asked for specific ${info.mode === 'photo_request' ? 'items from a photo' : 'colors'}, so we followed your request instead of ${label}.`
      : `${info.mode === 'photo_request' ? '사진 속 아이템' : '요청하신 색'}을 우선해서 ${label} 톤은 이번엔 반영하지 않았어요.`);
  return (
    <div className="rounded-2xl bg-gradient-personal-color border border-border p-3 not-italic">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
        <Palette className="w-4 h-4 text-primary" />
        {en ? `Personal color: ${label}` : `퍼스널 컬러: ${label}`}
        <span className="text-[11px] font-normal text-muted-foreground">({src})</span>
        <span className="flex gap-1">
          {swatches.map((s) => <span key={s.hex} className="w-3.5 h-3.5 rounded-full border border-border" style={{ backgroundColor: s.hex }} />)}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}
