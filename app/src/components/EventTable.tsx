import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { EventSummary } from '../api/types';
import { formatCount, formatLatency, formatTimestamp } from '../lib/format';
import { scrollTopToReveal, visibleRange } from '../lib/virtual';
import { StatusBadge } from './StatusBadge';

export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 36;
const LOAD_MORE_THRESHOLD = 30; // rows from the end of what's loaded

interface Props {
  items: EventSummary[];
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  nextPageError: string | null;
  onLoadMore: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Changes whenever the result set is replaced (new search); scroll and focus reset to the top. */
  resetKey: string;
  busy: boolean;
}

export interface EventTableHandle {
  focus: () => void;
}

const rowDomId = (id: string) => `event-row-${id}`;

/**
 * A hand-rolled virtualized grid: only the rows in (or near) the viewport are
 * in the DOM, positioned with transforms inside a spacer as tall as all loaded
 * rows. Rows have a fixed height, so the maths is just division.
 */
export const EventTable = forwardRef<EventTableHandle, Props>(function EventTable(
  { items, total, hasNextPage, isFetchingNextPage, nextPageError, onLoadMore, selectedId, onSelect, resetKey, busy },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const frame = useRef(0);

  useImperativeHandle(ref, () => ({ focus: () => scrollerRef.current?.focus() }), []);

  // Track the scroller's height (window resize, panel open/close, tablet rotation).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => setViewportHeight(scroller.clientHeight - HEADER_HEIGHT);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // New result set: back to the top.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setScrollTop(0);
    setActiveIndex(-1);
  }
  useLayoutEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [resetKey]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (scrollerRef.current) setScrollTop(scrollerRef.current.scrollTop);
    });
  }, []);

  const { start, end } = visibleRange(scrollTop, viewportHeight, ROW_HEIGHT, items.length);

  // Infinite loading: fetch the next page when the rendered window nears the end.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !nextPageError && end >= items.length - LOAD_MORE_THRESHOLD) {
      onLoadMore();
    }
  }, [end, items.length, hasNextPage, isFetchingNextPage, nextPageError, onLoadMore]);

  const moveActive = (index: number) => {
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(clamped);
    const scroller = scrollerRef.current;
    if (scroller) {
      const next = scrollTopToReveal(clamped, ROW_HEIGHT, scroller.scrollTop, viewportHeight);
      if (next !== scroller.scrollTop) scroller.scrollTop = next;
    }
  };

  const pageRows = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = activeIndex < 0 ? -1 : activeIndex;
    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        moveActive(current + 1);
        break;
      case 'ArrowUp':
      case 'k':
        moveActive(Math.max(0, current - 1));
        break;
      case 'PageDown':
        moveActive(current + pageRows);
        break;
      case 'PageUp':
        moveActive(current - pageRows);
        break;
      case 'Home':
        moveActive(0);
        break;
      case 'End':
        moveActive(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (items[current]) onSelect(items[current].id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  return (
    <div
      ref={scrollerRef}
      className="table-scroller"
      role="grid"
      aria-label="Events"
      aria-rowcount={total + 1}
      aria-busy={busy}
      aria-activedescendant={activeItem ? rowDomId(activeItem.id) : undefined}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (activeIndex < 0 && items.length) setActiveIndex(Math.min(start + (scrollTop > 0 ? 1 : 0), items.length - 1));
      }}
      style={{ '--row-height': `${ROW_HEIGHT}px`, '--header-height': `${HEADER_HEIGHT}px` } as React.CSSProperties}
    >
      <div className="table-header" role="row" aria-rowindex={1}>
        <span role="columnheader">Time</span>
        <span role="columnheader">Agent</span>
        <span role="columnheader">Tool</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="cell-latency">
          Latency
        </span>
        <span role="columnheader" className="cell-args">
          Args
        </span>
      </div>

      <div className={`table-body${busy ? ' is-busy' : ''}`} style={{ height: items.length * ROW_HEIGHT }} role="rowgroup">
        {items.slice(start, end).map((item, offset) => {
          const index = start + offset;
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              id={rowDomId(item.id)}
              role="row"
              aria-rowindex={index + 2}
              aria-selected={selected}
              className={`table-row${selected ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
              style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
              onClick={() => {
                setActiveIndex(index);
                onSelect(item.id);
              }}
            >
              <span role="gridcell" className="cell-time" title={item.timestamp}>
                {formatTimestamp(item.timestamp)}
              </span>
              <span role="gridcell" className="cell-agent">
                {item.agent}
              </span>
              <span role="gridcell" className="cell-tool">
                {item.tool}
              </span>
              <span role="gridcell">
                <StatusBadge status={item.status} />
              </span>
              <span role="gridcell" className="cell-latency">
                {formatLatency(item.latencyMs)}
              </span>
              <span role="gridcell" className="cell-args" title={item.argsPreview}>
                {item.argsPreview}
              </span>
            </div>
          );
        })}
      </div>

      <div className="table-footer">
        {nextPageError ? (
          <span role="alert">
            Couldn't load more events: {nextPageError}{' '}
            <button type="button" className="link-button" onClick={onLoadMore}>
              Try again
            </button>
          </span>
        ) : isFetchingNextPage ? (
          <span role="status">
            <span className="spinner" aria-hidden="true" /> Loading more events…
          </span>
        ) : hasNextPage ? (
          <span>Scroll for more</span>
        ) : (
          items.length > 0 && <span>End of results · {formatCount(items.length)} events</span>
        )}
      </div>
    </div>
  );
});
