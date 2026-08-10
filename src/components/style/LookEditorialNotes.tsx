import { Link } from "react-router-dom";
import { GUIDES } from "@/content/guides";

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

const LookEditorialNotes = ({ tags, categories = [], prompt }: LookEditorialNotesProps) => {
  const uniqueCategories = Array.from(new Set(categories.filter(Boolean)));
  const notes = uniqueCategories
    .map((c) => CATEGORY_NOTES[c])
    .filter(Boolean)
    .slice(0, 3);

  const tagLine = (tags ?? []).slice(0, 5).join(", ");

  return (
    <section className="mb-6 rounded-xl border border-border/50 bg-card/60 p-4">
      <h2 className="text-base font-semibold">이 룩의 코디 포인트</h2>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground break-keep">
        {tagLine
          ? `${tagLine} 분위기를 중심으로 구성한 착장입니다. `
          : "쇼미룩 AI가 체형 정보와 상황을 바탕으로 구성한 착장입니다. "}
        {prompt
          ? "요청한 상황에 맞춰 실루엣과 색 조합을 정리했어요."
          : "아래 상품 구성을 참고해 비슷한 조합을 직접 만들어볼 수 있어요."}
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
