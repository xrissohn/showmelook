/**
 * Paginated fetch utility for Supabase queries that exceed the 1000-row default limit.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  select: string,
  buildQuery: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = (supabase.from as any)(table).select(select).range(from, from + pageSize - 1);
    const finalQuery = buildQuery ? buildQuery(baseQuery) : baseQuery;

    const { data, error } = await finalQuery;
    if (error) throw error;

    if (data && (data as T[]).length > 0) {
      allData.push(...(data as T[]));
      from += pageSize;
      hasMore = (data as T[]).length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
