/**
 * Paginated fetch utility for Supabase queries that exceed the 1000-row default limit.
 * Fetches all rows by iterating with .range() in batches of pageSize.
 */
import { supabase } from "@/integrations/supabase/client";

type SupabaseTable = 'products_cache' | 'error_logs' | 'generation_jobs' | 'inference_metrics' | 'coupang_daily_reports' | 'product_feedback_scores' | 'pending_products';

interface FetchAllOptions {
  table: SupabaseTable;
  select?: string;
  filters?: Array<{
    type: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'is' | 'not' | 'in' | 'or';
    column?: string;
    value?: unknown;
  }>;
  order?: { column: string; ascending?: boolean };
  pageSize?: number;
}

export async function fetchAllRows<T = Record<string, unknown>>(
  options: FetchAllOptions
): Promise<T[]> {
  const { table, select = '*', filters = [], order, pageSize = 1000 } = options;
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);

    for (const filter of filters) {
      switch (filter.type) {
        case 'eq':
          query = query.eq(filter.column!, filter.value as string);
          break;
        case 'neq':
          query = query.neq(filter.column!, filter.value as string);
          break;
        case 'gte':
          query = query.gte(filter.column!, filter.value as string);
          break;
        case 'lte':
          query = query.lte(filter.column!, filter.value as string);
          break;
        case 'is':
          query = query.is(filter.column!, filter.value as null);
          break;
        case 'not':
          query = query.not(filter.column!, 'is', filter.value as null);
          break;
        case 'in':
          query = query.in(filter.column!, filter.value as string[]);
          break;
        case 'or':
          query = query.or(filter.value as string);
          break;
      }
    }

    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
