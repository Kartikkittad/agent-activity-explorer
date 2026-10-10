import { useEffect, useState } from 'react';

export const SLOW_AFTER_MS = 2500;

/** True once `active` has stayed true for `delay` ms. Used for "still loading" notices. */
export function useIsSlow(active: boolean, delay = SLOW_AFTER_MS): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), delay);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active, delay]);

  return active && slow;
}
