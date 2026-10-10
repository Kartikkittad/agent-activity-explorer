import { keepPreviousData, QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { toEventsQuery, type Filters } from '../lib/filters';
import { getJson, isRetryable, MAX_RETRIES, retryDelay } from './client';
import type { EventDetail, EventsPage } from './types';

export const PAGE_SIZE = 100;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => isRetryable(error) && failureCount < MAX_RETRIES,
        retryDelay,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: ({ signal }) => getJson<string[]>('/agents', undefined, signal),
    staleTime: Infinity,
  });
}

export function eventsQueryKey(filters: Filters) {
  return ['events', filters.q.trim(), filters.agents, filters.status] as const;
}

export function useEvents(filters: Filters) {
  return useInfiniteQuery({
    queryKey: eventsQueryKey(filters),
    queryFn: ({ pageParam, signal }) =>
      getJson<EventsPage>('/events', toEventsQuery(filters, pageParam, PAGE_SIZE), signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    // Keep showing the previous results (dimmed) while a new search loads.
    placeholderData: keepPreviousData,
  });
}

export function useEventDetail(id: string | null) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: ({ signal }) => getJson<EventDetail>(`/events/${encodeURIComponent(id!)}`, undefined, signal),
    enabled: id !== null,
    staleTime: Infinity,
  });
}
