import { useEffect, useRef } from 'react';
import { ApiError } from '../api/client';
import { useEventDetail } from '../api/queries';
import type { EventSummary } from '../api/types';
import { useIsSlow } from '../hooks/useIsSlow';
import { formatFullTimestamp, formatLatency } from '../lib/format';
import { JsonBlock } from './JsonBlock';
import { RetryingNote, StateMessage } from './StateMessage';
import { StatusBadge } from './StatusBadge';

interface Props {
  id: string;
  /** The row from the list, if loaded, so the header renders before the detail request returns. */
  seed?: EventSummary;
  onClose: () => void;
}

export function DetailPanel({ id, seed, onClose }: Props) {
  const detail = useEventDetail(id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const slow = useIsSlow(detail.isFetching);

  // Move focus into the panel when it opens. Switching events while it is open
  // (Enter on another row) leaves focus in the list so arrow-key browsing continues.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const summary = detail.data ?? seed;
  const notFound = detail.error instanceof ApiError && detail.error.status === 404;

  return (
    <aside className="detail-panel" aria-labelledby="detail-heading">
      <header className="detail-header">
        <div>
          <p className="detail-eyebrow">Event</p>
          <h2 id="detail-heading" ref={headingRef} tabIndex={-1}>
            {summary ? summary.tool : notFound ? 'Not found' : 'Loading…'}
          </h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close details" title="Close (Esc)">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
        </button>
      </header>

      <div className="detail-content">
        {summary && (
          <dl className="detail-fields">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={summary.status} />
              </dd>
            </div>
            <div>
              <dt>Agent</dt>
              <dd>{summary.agent}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd title={summary.timestamp}>{formatFullTimestamp(summary.timestamp)}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{formatLatency(summary.latencyMs)}</dd>
            </div>
            <div className="detail-field-wide">
              <dt>ID</dt>
              <dd className="mono">{summary.id}</dd>
            </div>
          </dl>
        )}

        {detail.isPending && !detail.isError && (
          <div className="detail-loading" role="status">
            <div className="skeleton skeleton-block" />
            <div className="skeleton skeleton-block" />
            <p className="muted">
              {slow ? 'Still loading. The server is being slow…' : 'Loading details…'}{' '}
              <RetryingNote failureCount={detail.failureCount} />
            </p>
          </div>
        )}

        {detail.isError &&
          (notFound ? (
            <StateMessage title="This event doesn't exist">
              The link may be wrong, or the event is no longer available.
            </StateMessage>
          ) : (
            <StateMessage
              tone="error"
              title="Couldn't load this event"
              action={
                <button type="button" className="button" onClick={() => detail.refetch()}>
                  Try again
                </button>
              }
            >
              {detail.error.message}
            </StateMessage>
          ))}

        {detail.data && (
          <>
            <section className="policy">
              <h3>Policy matches</h3>
              {detail.data.policyMatches.length ? (
                <ul className="chips">
                  {detail.data.policyMatches.map((rule) => (
                    <li key={rule} className="chip">
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No policy rules fired.</p>
              )}
            </section>
            <JsonBlock label="Args" value={detail.data.args} />
            <JsonBlock label="Result" value={detail.data.result} />
          </>
        )}
      </div>
    </aside>
  );
}
