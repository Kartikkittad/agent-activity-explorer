const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const fullFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'long',
});

const numberFormat = new Intl.NumberFormat();

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${timeFormat.format(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function formatFullTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : fullFormat.format(date);
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${numberFormat.format(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function formatCount(n: number): string {
  return numberFormat.format(n);
}

export function prettyJson(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') {
    // Some payloads are JSON encoded as a string; show them structured if so.
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}
