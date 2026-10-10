# Notes

## Repo setup

The clone URL in the brief (`github.com/cm-nikesh/agent-activity-explorer`) returned "Repository not found", so I started from the files I was sent. The first commit is the unmodified starter code, and everything after it is my own work, so `git diff` against that first commit shows exactly what I changed.

## What I built

**Part A** (`app/`, run instructions in [app/README.md](app/README.md)). I picked **Vite + React + TypeScript** over Next.js because this is a purely client-side tool talking to an API I don't control. There is nothing to server-render and no backend of my own, so Next would mostly add concepts without adding value.

- **Event list:** cursor-based infinite loading through the whole 50k dataset, 100 rows per page.
- **Search and filters:** search (debounced), agent multi-select and a status filter. They all live in the URL, so refresh, back/forward and copied links restore the same view. Invalid values in a hand-edited URL (e.g. `status=bogus`) are dropped instead of breaking the page.
- **Detail panel:** linkable with `?event=<id>`. It shows the row data instantly from the list while the full event loads. Focus moves into it on open, and `Esc` closes it and returns focus to the list. A bad link shows "This event doesn't exist".
- **States:** before building, I probed the API. Every endpoint fails with a 500 about 5% of the time, and list calls take 0.2–1.5 s. So the app:
  - retries network errors, 429s and 5xx up to 3 times with backoff, and tells the user it is retrying;
  - doesn't retry other 4xx;
  - shows a "responding slowly" note after 2.5 s;
  - keeps previous results visible but dimmed while a new search loads;
  - has distinct empty, error and "load more failed" states, each with a retry.

**Optional items.** From Polish: keyboard navigation (`/`, arrows, `j`/`k`, Page/Home/End, Enter), dark mode that follows the system, `prefers-reduced-motion`, a tablet layout (the args column hides and the panel overlays the list), and semantic roles and labels throughout.

From Stretch, I went deep on one item, the **hand-built virtualized list**. With a dataset this big, it is what makes "get through the whole dataset" usable: only about 35 rows are in the DOM whether 100 or 5,000 are loaded. I also added **tests** for the parts most likely to break: URL ⇄ filter parsing, the virtualization maths, error classification, and app-level tests for shared links, retry-then-success, the error → retry flow, the empty state, and opening and closing the panel (32 tests, `npm test`).

**Part B:** 10 fixes in `perf-clinic/`, written up in [PERF.md](PERF.md) with before/after numbers, screenshots and traces.

## Tradeoffs / with more time

- **No jumping deep into the list.** Cursors are opaque, so you can't jump to row 40,000; you scroll and pages load. The scrollbar reflects loaded rows, not the full total. With an offset or time-based API I'd size the scroller to the full total.
- **Search history.** Each debounced search adds a history entry. That's good for back/forward, but noisy if someone types slowly. I'd probably `replace` while the search box keeps focus.
- **Fixed row heights.** These keep the virtualization simple and fast, at the cost of truncating long values (they're available in the tooltip and the panel).
- **Testing.** I'd add Playwright end-to-end tests against the real mock API. I checked the flows with a throwaway Puppeteer script but didn't commit it.
- **Not started:** Live mode and the histogram.

## Known gaps

- The detail panel is a non-modal side panel. On tablet it overlays the list, but focus isn't trapped, so you can tab behind it.
- The total comes from the first page. If data changed while you were paging, the "x of y" count could drift.
- Times are shown in the viewer's local timezone. The raw UTC timestamp is in the tooltip.

## How I used AI tools

I used **Claude Code** (Anthropic's coding agent, in VS Code) throughout, as a pair programmer that did a lot of the typing while I steered and reviewed.

- **Part B, diagnosis before changes:** I asked it to read the perf-clinic code and list the problems before touching anything. I went through that list and agreed the plan first. It then measured a baseline in headless Chrome, applied the fixes, and re-measured with the same script, so every number in PERF.md comes from a real before/after run rather than an estimate. When the first draft of PERF.md claimed DevTools panels we hadn't actually used, I had it rewrite those lines to describe how each problem was really found.
- **Part A:** Before writing UI code, it probed the API to learn its real failure rate and latency, and the retry/slow/error design comes from those findings. It scaffolded the app, wrote the components and tests, and drove the app in headless Chrome to check URL sync, back/forward, keyboard and the error states. That check caught a real bug (the agent dropdown closed when you clicked a label's text), which we fixed.
- **What I did myself:** chose the stack and which optional items to do, reviewed the diffs, made the commits by hand (in small steps, not squashed), and handled the repo setup when the original URL didn't exist.

What worked best was treating it like a fast junior engineer: ask for a diagnosis first, insist on measurements over guesses, and read everything before it lands.
