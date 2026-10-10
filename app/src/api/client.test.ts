import { ApiError, getJson, isRetryable } from './client';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterAll(() => vi.unstubAllGlobals());

describe('getJson', () => {
  it('returns parsed JSON and builds the query string', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await expect(getJson('/events', new URLSearchParams('q=a b'))).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/events?q=a+b');
  });

  it("surfaces the API's own error message", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid cursor' }), { status: 400 }));
    await expect(getJson('/events')).rejects.toMatchObject({ status: 400, message: 'invalid cursor' });
  });

  it('falls back to a generic message for non-JSON errors', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(getJson('/events')).rejects.toMatchObject({ status: 502 });
  });

  it('turns network failures into status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getJson('/events')).rejects.toMatchObject({ status: 0 });
  });

  it('rethrows aborts untouched so cancelled queries are not treated as errors', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortError);
    await expect(getJson('/events', undefined, controller.signal)).rejects.toBe(abortError);
  });
});

describe('isRetryable', () => {
  it.each([
    [0, true],
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [404, false],
  ])('status %i -> %s', (status, expected) => {
    expect(isRetryable(new ApiError(status, 'x'))).toBe(expected);
  });

  it('does not retry unknown errors', () => {
    expect(isRetryable(new Error('boom'))).toBe(false);
  });
});
