import { MAX_RETRIES } from '../api/client';
import type { ReactNode } from 'react';

interface Props {
  tone?: 'neutral' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Shared layout for empty and error states. Errors are announced via role="alert". */
export function StateMessage({ tone = 'neutral', title, children, action }: Props) {
  return (
    <div className={`state-message state-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="state-title">{title}</p>
      {children && <div className="state-body">{children}</div>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function RetryingNote({ failureCount }: { failureCount: number }) {
  if (failureCount === 0) return null;
  return (
    <span className="retrying-note" role="status">
      Request failed. Retrying (attempt {Math.min(failureCount + 1, MAX_RETRIES + 1)} of {MAX_RETRIES + 1})…
    </span>
  );
}
