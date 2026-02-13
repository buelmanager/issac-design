import { supabase } from './supabase';
import type { Database } from '../types/database';

type TableName = keyof Database['public']['Tables'];

interface FetchQuery {
  select?: string;
  filter?: Record<string, string | number | boolean>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

export async function fetchWithFallback<T>(
  table: TableName,
  query: FetchQuery,
  fallback: T[],
): Promise<T[]> {
  try {
    let q = supabase.from(table).select(query.select || '*');

    if (query.filter) {
      for (const [key, value] of Object.entries(query.filter)) {
        q = q.eq(key, value);
      }
    }

    if (query.order) {
      q = q.order(query.order.column, {
        ascending: query.order.ascending ?? true,
      });
    }

    if (query.limit) {
      q = q.limit(query.limit);
    }

    const { data, error } = await q;

    if (error) throw error;
    if (!data || data.length === 0) return fallback;

    return data as T[];
  } catch {
    console.warn(`[Fallback] ${table} DB query failed, using fallback data`);
    return fallback;
  }
}

export async function fetchSingleWithFallback<T>(
  table: TableName,
  query: FetchQuery & { match: Record<string, string | number | boolean> },
  fallback: T,
): Promise<T> {
  try {
    let q = supabase.from(table).select(query.select || '*');

    for (const [key, value] of Object.entries(query.match)) {
      q = q.eq(key, value);
    }

    const { data, error } = await q.single();

    if (error) throw error;
    if (!data) return fallback;

    return data as T;
  } catch {
    console.warn(`[Fallback] ${table} single query failed, using fallback`);
    return fallback;
  }
}

export async function fetchConfigMap(
  category: string,
  fallback: Record<string, string>,
): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('key, value')
      .eq('category', category);

    if (error) throw error;
    if (!data || data.length === 0) return fallback;

    const result: Record<string, string> = {};
    for (const row of data as Array<{ key: string; value: string }>) {
      result[row.key] = row.value;
    }
    return result;
  } catch {
    console.warn(`[Fallback] site_config/${category} failed, using fallback`);
    return fallback;
  }
}
