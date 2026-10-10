export type EventStatus = 'ok' | 'blocked' | 'error';

export interface EventSummary {
  id: string;
  timestamp: string;
  agent: string;
  tool: string;
  status: EventStatus;
  latencyMs: number;
  argsPreview: string;
}

export interface EventsPage {
  items: EventSummary[];
  nextCursor?: string | null;
  total: number;
}

export interface EventDetail extends Omit<EventSummary, 'argsPreview'> {
  args: unknown;
  result: unknown;
  policyMatches: string[];
}
