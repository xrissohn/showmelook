import { Link } from "react-router-dom";
import { GUIDES } from "@/content/guides";
import { useLanguage } from "@/contexts/LanguageContext";

interface LookEditorialNotesProps {
  tags?: string[] | null;
  categories?: string[];
  prompt?: string | null;
}

const CATEGORY_NOTES: Record<string, string> = {
  상의: "상의는 밑단이 골반뼈 어디에서 끝나는지에 따라 비율이 달라집니다. 하의에 넣어 입을지 여부를 먼저 정해보세요.",
  하의: "하의는 밑단이 신발에 닿는 정도가 완성도를 좌우합니다. 발등에 살짝 닿는 기장이 가장 무난해요.",
  아우터: "아우터는 안쪽 옷보다 확실히 길어야 층이 보이면서 정돈된 인상이 됩니다.",
  가방: "가방은 착장의 색을 하나 더 늘리기보다, 이미 쓴 색을 반복할 때 가장 안정적입니다.",
  신발: "신발 색을 하의와 이어주면 다리 선이 끊기지 않아 키가 커 보입니다.",
  액세서리: "눈에 띄는 포인트는 한 벌에 하나면 충분합니다.",
  원피스: "원피스는 허리선 위치가 전부입니다. 벨트나 아우터로 허리선을 조절해 보세요.",
  홈웨어: "홈웨어는 소재의 촉감과 통기성이 우선입니다.",
  수영복: "수영복은 커버업 아이템까지 함께 고려하면 활용도가 올라갑니다.",
};

const CATEGORY_NOTES_EN: Record<string, string> = {
  상의: "For tops, proportions depend on where the hem meets the hip. Decide whether to tuck it in first.",
  하의: "For bottoms, the hem length makes the difference. A hem that lightly meets the shoe is the most versatile.",
  아우터: "Outerwear looks most polished when it is clearly longer than the layer underneath.",
  가방: "A bag feels most cohesive when it repeats a color already used in the outfit.",
  신발: "Matching shoes with the bottoms keeps the leg line uninterrupted and creates a taller silhouette.",
  액세서리: "One standout accessory is usually enough for a balanced look.",
  원피스: "The waistline defines a dress. Adjust it with a belt or outer layer.",
  홈웨어: "For loungewear, prioritize texture and breathability.",
  수영복: "Consider a cover-up as part of the look to make swimwear more versatile.",
};

const LookEditorialNotes = ({ tags, categories = [], prompt }: LookEditorialNotesProps) => {
  const { language } = useLanguage();
  const uniqueCategories = Array.from(new Set(categories.filter(Boolean)));
  const notes = uniqueCategories
    .map((c) => (language === 'en' ? CATEGORY_NOTES_EN : CATEGORY_NOTES)[c])
    .filter(Boolean)
    .slice(0, 3);

  const tagLine = (tags ?? []).slice(0, 5).join(", ");

  return (
    <section className="mb-6 rounded-xl border border-border/50 bg-card/60 p-4">
      <h2 className="text-base font-semibold">{language === 'en' ? 'Styling points for this look' : '이 룩의 코디 포인트'}</h2>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground break-keep">
        {language === 'en'
          ? `${tagLine ? `This outfit is built around a ${tagLine} mood. ` : 'ShowMeLook AI created this outfit for your body profile and occasion. '}${prompt ? 'The silhouette and colors reflect your request.' : 'Use the items below to recreate a similar combination.'}`
          : `${tagLine ? `${tagLine} 분위기를 중심으로 구성한 착장입니다. ` : '쇼미룩 AI가 체형 정보와 상황을 바탕으로 구성한 착장입니다. '}${prompt ? '요청한 상황에 맞춰 실루엣과 색 조합을 정리했어요.' : '아래 상품 구성을 참고해 비슷한 조합을 직접 만들어볼 수 있어요.'}`}
      </p>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm text-foreground break-keep">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {GUIDES.slice(0, 3).map((guide) => (
          <Link
            key={guide.slug}
            to={`/guide/${guide.slug}`}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {guide.title}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default LookEditorialNotes;
