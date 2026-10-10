import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseFilters, writeFilters, type Filters } from '../lib/filters';

/**
 * The URL is the single source of truth for search, filters and the open
 * event, so refresh, back/forward and shared links all restore the same view.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => parseFilters(params), [params]);
  const selectedId = params.get('event');

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      setParams((prev) => writeFilters(prev, { ...parseFilters(prev), ...patch }));
    },
    [setParams],
  );

  /** Opening a panel adds a history entry (Back closes it); moving between events replaces it. */
  const selectEvent = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set('event', id);
          else next.delete('event');
          return next;
        },
        { replace: id !== null && params.has('event') },
      );
    },
    [setParams, params],
  );

  return { filters, selectedId, setFilters, selectEvent };
}
