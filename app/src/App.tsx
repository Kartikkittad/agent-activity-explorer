import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventsQueryKey, useEvents } from './api/queries';
import type { EventSummary } from './api/types';
import { AgentFilter } from './components/AgentFilter';
import { DetailPanel } from './components/DetailPanel';
import { EventTable, ROW_HEIGHT, type EventTableHandle } from './components/EventTable';
import { SearchBox } from './components/SearchBox';
import { RetryingNote, StateMessage } from './components/StateMessage';
import { StatusFilter } from './components/StatusFilter';
import { useIsSlow } from './hooks/useIsSlow';
import { useUrlState } from './hooks/useUrlState';
import { EMPTY_FILTERS, hasActiveFilters } from './lib/filters';
import { formatCount } from './lib/format';

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function App() {
  const { filters, selectedId, setFilters, selectEvent } = useUrlState();
  const events = useEvents(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<EventTableHandle>(null);

  const items = useMemo(() => {
    // The API has been well-behaved, but a duplicate id across pages would break React keys.
    const seen = new Set<string>();
    const out: EventSummary[] = [];
    for (const page of events.data?.pages ?? []) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
    }
    return out;
  }, [events.data]);

  const total = events.data?.pages[0]?.total ?? 0;
  const filtersActive = hasActiveFilters(filters);
  const isRefetching = events.isFetching && !events.isFetchingNextPage && events.data !== undefined;
  const showingStale = events.isPlaceholderData;
  // A failed new search (not a failed "load more") replaces the list with an error.
  const listError = events.isError && !events.isFetchNextPageError ? events.error : null;
  const slow = useIsSlow(events.isFetching && !events.isFetchingNextPage);

  // Reset scroll only once the new result set has actually arrived.
  const currentKey = JSON.stringify(eventsQueryKey(filters));
  const [shownKey, setShownKey] = useState(currentKey);
  if (!showingStale && shownKey !== currentKey) setShownKey(currentKey);

  const closePanel = useCallback(() => {
    selectEvent(null);
    tableRef.current?.focus();
  }, [selectEvent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && selectedId) {
        closePanel();
      } else if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedId, closePanel]);

  const seed = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const onSearch = useCallback((q: string) => setFilters({ q }), [setFilters]);

  let body;
  if (listError) {
    body = (
      <StateMessage
        tone="error"
        title="Couldn't load events"
        action={
          <button type="button" className="button" onClick={() => events.refetch()}>
            Try again
          </button>
        }
      >
        {listError.message}
      </StateMessage>
    );
  } else if (events.isPending) {
    body = (
      <div className="table-loading" role="status" aria-label="Loading events">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton skeleton-row" style={{ height: ROW_HEIGHT - 12 }} />
        ))}
      </div>
    );
  } else if (items.length === 0 && !showingStale) {
    body = filtersActive ? (
      <StateMessage
        title="No events match"
        action={
          <button type="button" className="button" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear search and filters
          </button>
        }
      >
        Try a different search term, or include more agents or statuses.
      </StateMessage>
    ) : (
      <StateMessage title="No events yet">When your agents call tools, they'll show up here.</StateMessage>
    );
  } else {
    body = (
      <EventTable
        ref={tableRef}
        items={items}
        total={total}
        hasNextPage={events.hasNextPage}
        isFetchingNextPage={events.isFetchingNextPage}
        nextPageError={events.isFetchNextPageError ? events.error.message : null}
        onLoadMore={() => void events.fetchNextPage()}
        selectedId={selectedId}
        onSelect={selectEvent}
        resetKey={shownKey}
        busy={showingStale}
      />
    );
  }

  return (
    <div className={`app${selectedId ? ' has-panel' : ''}`}>
      <header className="topbar">
        <h1>Agent Activity</h1>
        <div className="toolbar" role="search">
          <SearchBox ref={searchRef} value={filters.q} onCommit={onSearch} />
          <AgentFilter selected={filters.agents} onChange={(agents) => setFilters({ agents })} />
          <StatusFilter value={filters.status} onChange={(status) => setFilters({ status })} />
          {filtersActive && (
            <button type="button" className="link-button" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear
            </button>
          )}
        </div>
      </header>

      <div className={`progress${isRefetching ? ' is-active' : ''}`} aria-hidden="true" />

      <div className="workspace">
        <main className="list-region">
          <div className="list-meta">
            <span role="status" aria-live="polite">
              {events.isPending
                ? 'Loading events…'
                : listError
                  ? ''
                  : `Showing ${formatCount(items.length)} of ${formatCount(total)} events${showingStale ? ' · updating…' : ''}`}
            </span>
            {slow && <span className="slow-note">The server is responding slowly. Still working…</span>}
            {events.isFetching && <RetryingNote failureCount={events.failureCount} />}
          </div>
          {body}
        </main>

        {selectedId && <DetailPanel id={selectedId} seed={seed} onClose={closePanel} />}
      </div>
    </div>
  );
}
