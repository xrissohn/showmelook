import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "./paginatedFetch";

function mockTableRows(rows: number[]) {
  const rangeCalls: Array<[number, number]> = [];
  const builder = {
    eq: () => builder,
    range: (from: number, to: number) => {
      rangeCalls.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: () => builder,
  });
  return rangeCalls;
}

describe("fetchAllRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1000행 제한을 넘는 전체 행을 페이지네이션으로 모두 가져온다", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const rangeCalls = mockTableRows(rows);

    const result = await fetchAllRows<number>(
      "products_cache",
      "id",
      (q) => q.eq("is_active", true)
    );

    expect(result).toHaveLength(2500);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("행 수가 페이지 크기의 배수여도 빈 페이지를 확인하고 정확히 멈춘다", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => i);
    mockTableRows(rows);

    const result = await fetchAllRows<number>("products_cache", "id", (q) => q);

    expect(result).toHaveLength(2000);
  });
});
