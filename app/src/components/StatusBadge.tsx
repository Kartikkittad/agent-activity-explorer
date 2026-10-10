import type { EventStatus } from '../api/types';

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </span>
  );
}
