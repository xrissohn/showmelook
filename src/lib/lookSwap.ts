// 결과 화면에서 아이템을 교체했을 때 저장된 룩(generated_looks)에 반영하는 순수 함수들

export interface SwapProduct {
  id: string;
  name: string;
  brand: string | null;
}

/** product_ids 에서 교체 전 상품을 교체 후 상품으로 바꾼다. 교체 전 상품이 없으면 null(건드리지 않음). */
export function swapIdInList(ids: string[] | null | undefined, oldId: string, newId: string): string[] | null {
  if (!ids || !ids.includes(oldId)) return null;
  return Array.from(new Set(ids.map((id) => (id === oldId ? newId : id))));
}

const fullLabel = (p: SwapProduct) => (p.brand ? `${p.brand} ${p.name}` : p.name).trim();

/**
 * 설명(style_reasoning)이 교체 전 상품을 '브랜드 상품명' 또는 '상품명' 그대로 말하면 교체 상품 기준으로 고친다.
 * 브랜드만 언급되는 경우처럼 안전하게 바꿀 수 없으면 그대로 두고 changed=false 를 돌려준다
 * (화면의 '이미지는 처음 조합 기준' 안내가 이 경우를 덮는다).
 */
export function replaceProductMention(
  text: string | null | undefined,
  oldP: SwapProduct,
  newP: SwapProduct,
): { text: string | null; changed: boolean } {
  if (!text) return { text: text ?? null, changed: false };
  let out = text;
  if (oldP.brand && out.includes(fullLabel(oldP))) {
    out = out.split(fullLabel(oldP)).join(fullLabel(newP));
  }
  if (oldP.name.trim().length >= 3 && out.includes(oldP.name)) {
    out = out.split(oldP.name).join(newP.name);
  }
  return { text: out, changed: out !== text };
}
