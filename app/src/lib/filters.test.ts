import { hasActiveFilters, parseFilters, toEventsQuery, writeFilters } from './filters';

describe('parseFilters', () => {
  it('reads search, repeated agents and status from the URL', () => {
    const filters = parseFilters(new URLSearchParams('q=refund&agent=b&agent=a&status=blocked'));
    expect(filters).toEqual({ q: 'refund', agents: ['a', 'b'], status: 'blocked' });
  });

  it('drops values the API would reject or that make no sense', () => {
    const filters = parseFilters(new URLSearchParams('status=bogus&agent=&agent=a&agent=a'));
    expect(filters).toEqual({ q: '', agents: ['a'], status: null });
  });
});

describe('writeFilters', () => {
  it('round-trips through the URL', () => {
    const original = { q: 'sql', agents: ['z', 'a'], status: 'error' as const };
    expect(parseFilters(writeFilters(new URLSearchParams(), original))).toEqual({ ...original, agents: ['a', 'z'] });
  });

  it('keeps unrelated params such as the open event', () => {
    const next = writeFilters(new URLSearchParams('event=evt_1&q=old'), { q: '', agents: [], status: 'ok' });
    expect(next.toString()).toBe('event=evt_1&status=ok');
  });

  it('trims search and omits empty values', () => {
    expect(writeFilters(new URLSearchParams(), { q: '  ', agents: [], status: null }).toString()).toBe('');
    expect(writeFilters(new URLSearchParams(), { q: ' a b ', agents: [], status: null }).get('q')).toBe('a b');
  });
});

describe('toEventsQuery', () => {
  it('adds paging params', () => {
    const params = toEventsQuery({ q: 'x', agents: ['a'], status: null }, 'abc', 100);
    expect(params.toString()).toBe('q=x&agent=a&limit=100&cursor=abc');
  });
});

describe('hasActiveFilters', () => {
  it('ignores whitespace-only search', () => {
    expect(hasActiveFilters({ q: '   ', agents: [], status: null })).toBe(false);
    expect(hasActiveFilters({ q: '', agents: [], status: 'ok' })).toBe(true);
  });
});
