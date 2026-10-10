import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { createQueryClient } from './api/queries';
import type { EventDetail, EventSummary } from './api/types';
import { App } from './App';

const event: EventSummary = {
  id: 'evt_1',
  timestamp: '2026-10-09T14:21:07.123Z',
  agent: 'billing-assistant',
  tool: 'http.request',
  status: 'blocked',
  latencyMs: 412,
  argsPreview: '{"url":"https://api.stripe.com"}',
};

const detail: EventDetail = {
  ...event,
  args: { url: 'https://api.stripe.com' },
  result: { blocked: true },
  policyMatches: ['dlp.pii_outbound'],
};

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderApp(url: string) {
  const client = createQueryClient();
  // Keep retries but make them instant.
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterAll(() => vi.unstubAllGlobals());

function routeFetch(handlers: { events?: () => Promise<Response> } = {}) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname === '/agents') return json(['billing-assistant', 'code-reviewer']);
    if (url.pathname === '/events') return handlers.events?.() ?? json({ items: [event], nextCursor: null, total: 1 });
    if (url.pathname === '/events/evt_1') return json(detail);
    return json({ error: 'event not found' }, 404);
  });
}

it('restores search and filters from a shared URL and sends them to the API', async () => {
  routeFetch();
  renderApp('/?q=stripe&agent=code-reviewer&agent=billing-assistant&status=blocked');

  expect(await screen.findByText('billing-assistant')).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toHaveValue('stripe');
  expect(screen.getByRole('radio', { name: 'Blocked' })).toBeChecked();

  const eventsCall = fetchMock.mock.calls.map(([input]) => new URL(String(input))).find((u) => u.pathname === '/events')!;
  expect(eventsCall.searchParams.get('q')).toBe('stripe');
  expect(eventsCall.searchParams.getAll('agent')).toEqual(['billing-assistant', 'code-reviewer']);
  expect(eventsCall.searchParams.get('status')).toBe('blocked');
});

it('retries a flaky 500 instead of showing an error', async () => {
  let calls = 0;
  routeFetch({
    events: () => (++calls === 1 ? json({ error: 'internal server error' }, 500) : json({ items: [event], nextCursor: null, total: 1 })),
  });
  renderApp('/');

  expect(await screen.findByText('http.request')).toBeInTheDocument();
  expect(calls).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows an error with a working retry once retries are exhausted', async () => {
  let fail = true;
  routeFetch({
    events: () => (fail ? json({ error: 'internal server error' }, 500) : json({ items: [event], nextCursor: null, total: 1 })),
  });
  renderApp('/');

  expect(await screen.findByText("Couldn't load events")).toBeInTheDocument();
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('http.request')).toBeInTheDocument();
});

it('shows an empty state that can clear the filters', async () => {
  routeFetch({ events: () => json({ items: [], nextCursor: null, total: 0 }) });
  renderApp('/?q=nothing');

  expect(await screen.findByText('No events match')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^$/));
});

it('opens the detail panel from a row, puts it in the URL and closes it with Escape', async () => {
  routeFetch();
  const user = userEvent.setup();
  renderApp('/?status=blocked');

  await user.click(await screen.findByText('http.request'));
  expect(screen.getByTestId('location')).toHaveTextContent('status=blocked&event=evt_1');
  expect(await screen.findByText('dlp.pii_outbound')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();

  await user.keyboard('{Escape}');
  expect(screen.getByTestId('location')).toHaveTextContent(/^\?status=blocked$/);
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByRole('grid')).toHaveFocus();
});

it('explains when a linked event does not exist', async () => {
  routeFetch();
  renderApp('/?event=evt_missing');
  expect(await screen.findByText("This event doesn't exist")).toBeInTheDocument();
});
