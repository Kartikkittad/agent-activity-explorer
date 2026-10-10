# Perf Clinic

## How I measured

All numbers are from Chrome 1440×900 on my laptop (no CPU throttling), driven by a small Puppeteer script so before and after run exactly the same steps. For page load I emulated Fast 4G (9 Mbps, 40 ms RTT) with the cache disabled. The script reads Chrome's own counters (`Performance.getMetrics` gives `LayoutCount`, `JSEventListeners`, `Nodes`, `ScriptDuration`), the `largest-contentful-paint`, `layout-shift` and `longtask` PerformanceObservers, and `performance.now()` around the functions in question with a forced layout at the end so layout cost is included.

| | Before | After |
|---|---|---|
| First / largest contentful paint (Fast 4G) | 11.1 s / 14.4 s | 2.5 s / 2.5 s |
| Bytes transferred | 6.5 MB | 0.46 MB |
| Longest main-thread task on load | 8.6 s | 1.1 s |
| Worst single keystroke in search | 6.3 s | 1 ms (render runs once, ~0.1–0.17 s) |
| One scroll step (median) | 1,020 ms | 18 ms |
| Layouts while idle, 3 s | 180 | 0 |
| Listeners after opening/closing ticker 5× | 40 | 10 |

---

### 1. Summary text "fitting" forces up to 1,400 layouts per render
- **Symptom:** The page takes seconds to show anything, every search result render stalls, and resizing the window freezes it.
- **How I found it:** The `longtask` observer showed one 8.6 s task during load. Reading the render path, `fitSummaries` writes a style and reads `scrollWidth` in a loop (the classic forced-reflow pattern). Timing it alone in the page: 1,050 ms per call.
- **Root cause:** For each of the 200 summary cells it sets `font-size`, then reads `scrollWidth`, then shrinks by 0.5px and reads again, up to 7 times. Every read after a write forces the browser to lay out the page synchronously, so one render does hundreds of full layouts. It also ran on every `resize` event. The CSS already had `text-overflow: ellipsis`, so the result was barely visible anyway.
- **Fix:** Deleted `fitSummaries` and let the existing ellipsis do the job. Also added `content-visibility: auto` to rows so the browser skips layout for rows that are off screen.
- **Before / after:** 1,050 ms → 0 ms per render. Five resize events: 6,851 ms → 1 ms.

### 2. Search does all the work on every keystroke
- **Symptom:** Typing in the search box freezes the page. Typing "billing" took 16.5 s and the worst single key took 6.3 s.
- **How I found it:** Timed keystrokes in the page (6.3 s worst key), then timed the pieces separately: `search()` alone was ~500 ms, `formatTime` for 200 rows 117 ms, and the rest was `fitSummaries` (see 1).
- **Root cause:** On every `input` event it ran `JSON.stringify` on all 100,000 events, lowercased them, then sorted the matches with `new Date()` twice per comparison (millions of Date objects). Rendering then called `toLocaleTimeString` per row, which builds a new `Intl` formatter each time (117 ms for 200 rows). Nothing was debounced.
- **Fix:** Build a lowercase search string per event once at startup and sort once (ISO strings sort correctly as strings). Searching is now a single `filter` + `includes`. Debounced input by 150 ms. `formatTime` slices `HH:MM:SS` out of the UTC ISO string.
- **Before / after:** `renderResults` 1.5–2.6 s per query (6.0 s for the empty query) → 0.10–0.17 s. Keystroke handler 6.3 s → 1 ms.

### 3. Scroll handler does seconds of work per scroll event
- **Symptom:** Scrolling the list is extremely janky; the page lags about a second behind the mouse wheel.
- **How I found it:** Chrome's `LayoutCount` counter went up by 1,256 over 60 scroll steps, and each step took about a second. In `onScroll`, the per-row `classList.remove` + `getBoundingClientRect` loop explains the layouts, and timing the "calls that minute" filter alone gave 486 ms.
- **Root cause:** On every scroll event (not once per frame) it removed a class from a row and then read that row's position, 200 times, which forces a layout each time. Then it filtered all 100,000 events, creating a `Date` per event, just to count calls in one minute (486 ms on its own). It also changed the topbar's `padding` on every pixel scrolled, which re-lays-out the whole page, and the progress bar animated `width`.
- **Fix:** Replaced the row measuring with an `IntersectionObserver` on the 30–60% band of the viewport, so the browser tells us which rows are in focus. Pre-computed a `Map` of calls per minute at startup. The remaining scroll work (progress bar, topbar, back-to-top) is batched into one `requestAnimationFrame` per frame, the progress bar uses `transform: scaleX`, and the topbar padding changes once via the `topbar-raised` class. The listener is `passive`. The focus highlight uses an inset `box-shadow` instead of a border plus padding, so toggling it doesn't change layout.
- **Before / after:** median scroll step 1,020 ms → 18 ms (p95 1,171 → 21 ms). Layouts per 60 steps 1,256 → 118.

### 4. Images are 6 MB and much bigger than they are displayed
- **Symptom:** On a normal connection the hero takes ~14 s to appear and the page feels empty for a long time.
- **How I found it:** Looking at file sizes and transferred bytes: `hero.png` is 4.2 MB and each avatar is ~160 KB at 320×320, but avatars are shown at 48×48.
- **Root cause:** The hero is a 1700×950 PNG of a noisy gradient, which PNG compresses very badly. The avatars are 320×320 PNGs shown at 48×48. No `width`/`height`, so the browser can't reserve space.
- **Fix:** Converted to WebP. The hero has a 1700w and an 850w version with `srcset`/`sizes`, `width`/`height` and `fetchpriority="high"` since it is the LCP element. Avatars are 96×96 (2× for retina) with `width`/`height`, `loading="lazy"` and `decoding="async"`.
- **Before / after:** total transfer 6.5 MB → 0.46 MB (hero 4.2 MB → 368 KB, avatars ~1.9 MB → ~5 KB). LCP 14.4 s → 2.5 s.

### 5. Render-blocking resources before the first paint
- **Symptom:** A blank screen for a long time before anything appears.
- **How I found it:** Reading `<head>`: a 327 KB stylesheet and a synchronous script before the body. I grepped `theme.css` for every class the HTML and JS use, and none of them are defined there, so the whole file is unused.
- **Root cause:** `theme.css` is a whole utility framework the page never uses, and the browser must download and parse it before painting. `config.js` was a plain `<script>` in `<head>`, so building 100,000 objects blocked the parser before the body even existed. The web font had no `font-display`, so text stayed invisible until the font arrived.
- **Fix:** Removed `theme.css`. Both scripts are `defer` (order is kept). Added `font-display: swap` and a `<link rel="preload">` for the font.
- **Before / after:** FCP 11.1 s → 2.5 s (together with fixes 1 and 4). 327 KB less CSS to parse.

### 6. Live ticker leaks timers, listeners and DOM nodes
- **Symptom:** After toggling "Show live calls" a few times the page keeps getting slower and memory keeps growing, even with the ticker closed.
- **How I found it:** Opened and closed the ticker 5 times, then watched Chrome's counters for 5 s with it closed: `JSEventListeners` was 40, the `Nodes` count kept rising by ~600, and script was still running.
- **Root cause:** `closeTicker` removed the panel but never called `clearInterval`, so the interval kept adding rows to a detached list forever. Each open added another interval plus another `resize` and `keydown` listener. The `renderedTickerRows` Map cached a DOM node for every event ever shown and was never cleared.
- **Fix:** Store the interval id and clear it on close. Register the `resize` and `keydown` listeners once at startup. Dropped the node cache; creating three spans is cheaper than keeping thousands of nodes alive.
- **Before / after:** after 5 open/close cycles, listeners 40 → 10, new nodes created in the next 5 s with the ticker closed 598 → 0, script time in those 5 s 32 ms → 0 ms.

### 7. "Viewed" tracking rewrites localStorage 200 times per render
- **Symptom:** Searches get slower the longer you use the page.
- **How I found it:** Reading `rememberViewed` while profiling search, and watching the `activity:viewed` key grow in localStorage as I searched.
- **Root cause:** `localStorage.setItem` was inside the loop, so each render serialized the whole growing list 200 times. Every lookup used `Array.includes`, which is O(n) per row and O(n²) overall.
- **Fix:** Keep the ids in a `Set` loaded once, check with `Set.has`, and write to localStorage once per render, only if something changed.
- **Before / after:** 200 writes → 1 write per render. With about 840 viewed ids that's 200 × 6 KB of serializing → 1 × 6 KB, and the gap grows as the list grows.

### 8. Alerts marquee animates `left`
- **Symptom:** The page is never idle: it burns CPU and battery even when nobody is touching it, and other animations stutter.
- **How I found it:** Sampled Chrome's `LayoutCount` and `RecalcStyleCount` for 3 s with nobody touching the page: both went up 60 times a second. The only thing moving is the alerts marquee, which animates `left`.
- **Root cause:** Animating `left` changes the element's geometry, so the browser has to run layout and paint on every frame.
- **Fix:** Animate `transform: translateX()` instead, using container query units (`cqw`) to keep the same start and end positions. Transforms are handled by the compositor without layout. Also stopped the animation for `prefers-reduced-motion`.
- **Before / after:** layouts in 3 s of idle 180 → 0, style recalcs 180 → 0.

### 9. Agent cards equalized with JavaScript
- **Symptom:** The agent grid jumps around while the avatars load and on resize.
- **How I found it:** Reading the code: `equalizeCardHeights` runs once per avatar `load` event (24 times) and on every resize, and interleaves style writes with `offsetTop`/`offsetHeight` reads.
- **Root cause:** It read `offsetTop` / `offsetHeight` right after writing `style.height`, card by card (O(n²) reads with a forced layout each time). CSS grid already does this: the grid had `align-items: start`, which turned the stretching off.
- **Fix:** Deleted the function. Removed `align-items: start` so grid rows stretch cards to equal height, and moved the 220 px minimum to `min-height` in CSS. Avatars have fixed `width`/`height` so loading them doesn't shift anything.
- **Before / after:** about 9 ms per call, 24+ calls on load plus one per resize event → 0. CLS 0.001 → 0. (Smallest win on the list.)

### 10. Hover preview
- **Symptom:** The hover tooltip lags behind the mouse.
- **How I found it:** Timed 100 synthetic `mousemove` events over the rows.
- **Root cause:** Every `mousemove` (they can fire faster than frames) searched the 100,000-event array with `find` and set `top`/`left`, which needs layout. The `wheel` and `touchstart` listeners were not passive, so scrolling had to wait for them.
- **Fix:** Look up by id in a `Map`, update at most once per animation frame, move the tooltip with `transform`, and mark `wheel`/`touchstart` as `passive`.
- **Before / after:** 100 mouse moves 2,009 ms → 10 ms.

## Still not ideal

- Building the 100,000 fake events in `config.js` plus the search index is still a ~1.1 s task on load. In a real app that data would come from a server, paged. Here I'd move generation and search into a Web Worker if I had more time.
- Search is a linear scan over 100k strings (~80 ms). Fine with the debounce, but an inverted index would make it instant.
- The `viewed` list in localStorage still grows without limit. It should be capped (for example, the most recent 5,000 ids).
