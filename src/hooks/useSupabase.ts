import { useState, useEffect, useCallback } from 'react';
import { hmso } from '../lib/supabase';

export function useQuery<T>(
  table: string,
  options?: {
    select?: string;
    order?: { column: string; ascending?: boolean };
    filter?: { column: string; operator: string; value: unknown }[];
    limit?: number;
  }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(options?.filter);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = hmso.from(table).select(options?.select || '*');

      if (options?.filter) {
        for (const f of options.filter) {
          query = query.filter(f.column, f.operator, f.value);
        }
      }

      if (options?.order) {
        query = query.order(options.order.column, {
          ascending: options.order.ascending ?? false,
        });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error: err } = await query;

      if (err) {
        setError(err.message);
      } else {
        setData((result as T[]) || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, options?.select, options?.order?.column, options?.order?.ascending, filterKey, options?.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
