import type { EventStatus } from '../api/types';

export const STATUSES: readonly EventStatus[] = ['ok', 'blocked', 'error'];

export interface Filters {
  q: string;
  agents: string[];
  status: EventStatus | null;
}

export const EMPTY_FILTERS: Filters = { q: '', agents: [], status: null };

const FILTER_KEYS = ['q', 'agent', 'status'] as const;

function isStatus(value: string | null): value is EventStatus {
  return value !== null && (STATUSES as readonly string[]).includes(value);
}

/**
 * Reads filters from the URL. Anything invalid (an unknown status, empty
 * agents, duplicates) is dropped rather than sent to the API, so a hand-edited
 * or stale link still opens a sensible view.
 */
export function parseFilters(params: URLSearchParams): Filters {
  const agents = [...new Set(params.getAll('agent').filter(Boolean))].sort();
  const status = params.get('status');
  return {
    q: params.get('q') ?? '',
    agents,
    status: isStatus(status) ? status : null,
  };
}

/** Returns a copy of `params` with the filter keys replaced; other keys (e.g. `event`) are kept. */
export function writeFilters(params: URLSearchParams, filters: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  FILTER_KEYS.forEach((key) => next.delete(key));
  const q = filters.q.trim();
  if (q) next.set('q', q);
  [...new Set(filters.agents)].sort().forEach((agent) => next.append('agent', agent));
  if (filters.status) next.set('status', filters.status);
  return next;
}

export function hasActiveFilters(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.agents.length > 0 || filters.status !== null;
}

export function toEventsQuery(filters: Filters, cursor: string | undefined, limit: number): URLSearchParams {
  const params = writeFilters(new URLSearchParams(), filters);
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  return params;
}
