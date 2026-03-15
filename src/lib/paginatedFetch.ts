/**
 * Paginated fetch utility for Supabase queries that exceed the 1000-row default limit.
 * Fetches all rows by iterating with .range() in batches.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (query: any) => any,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = (supabase as any).from(table).select(select);
    const finalQuery = buildQuery(baseQuery).range(from, from + pageSize - 1);

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
