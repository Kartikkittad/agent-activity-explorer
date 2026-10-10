export interface Range {
  start: number;
  end: number; // exclusive
}

/** Which rows intersect the viewport, plus `overscan` rows either side. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 8,
): Range {
  if (count <= 0 || rowHeight <= 0 || viewportHeight <= 0) return { start: 0, end: Math.min(count, overscan) };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight);
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(count, last + overscan),
  };
}

/** The smallest scrollTop change that brings row `index` fully into view. */
export function scrollTopToReveal(index: number, rowHeight: number, scrollTop: number, viewportHeight: number): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}
